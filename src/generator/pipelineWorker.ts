import { Response } from 'express';
import { generateEmbedding, generateCompletionStream } from '../ai';
import { vectorSearch } from '../db';
import { sseEvent } from './sseEmitter';
import type { VectorSearchResult } from '../db/types';

export type SectionName = 'executive-summary' | 'leadership-execution' | 'technical-insight';

export const SECTION_LABELS: Record<SectionName, string> = {
  'executive-summary': 'The Big Picture',
  'leadership-execution': 'Strategy in Motion',
  'technical-insight': 'Under the Hood',
};

const SECTION_PROMPTS: Record<SectionName, string> = {
  'executive-summary': 'generate-executive-summary',
  'leadership-execution': 'generate-leadership-execution',
  'technical-insight': 'generate-technical-insight',
};

export interface ClusteredTopic {
  type: 'clustered';
  title: string;
  entryIds: string[];
  contentPlan?: string[];
}

export type TopicInput = ClusteredTopic;

export interface GeneratedTopic {
  title: string;
  sections: Record<SectionName, string>;
  sources: { title: string; url: string }[];
}

// [F-C02-VECSEARCH, F-C02-GENERATE] Per-topic generation pipeline with plan-step-driven vector search
export async function runTopicPipeline(
  topic: TopicInput,
  topicIndex: number,
  totalTopics: number,
  res: Response,
  timeframeFrom?: Date
): Promise<GeneratedTopic | null> {
  sseEvent(res, 'topic_start', { topicTitle: topic.title, topicIndex, totalTopics });

  try {
    const sections: Record<string, string> = {};
    const seenUrls = new Set<string>();
    const sources: { title: string; url: string }[] = [];

    // Build pooled supporting content from plan-step vector searches.
    // Each plan step is embedded and used as a retrieval query; results are pooled and deduplicated.
    const planSteps = topic.contentPlan && topic.contentPlan.length > 0
      ? topic.contentPlan
      : [topic.title];

    const seenEntryIds = new Set<string>();
    const pooledChunks: VectorSearchResult[] = [];

    for (const step of planSteps) {
      const vec = await generateEmbedding(step);
      const results = await vectorSearch(vec, 5, timeframeFrom);
      for (const r of results) {
        if (!seenEntryIds.has(r.entry.id)) {
          seenEntryIds.add(r.entry.id);
          pooledChunks.push(r);
          if (r.entry.sourceRef && !seenUrls.has(r.entry.sourceRef)) {
            seenUrls.add(r.entry.sourceRef);
            sources.push({ title: r.entry.title, url: r.entry.sourceRef });
          }
        }
      }
    }

    const supportingContent = formatChunks(pooledChunks);
    const sourcesList = formatSourcesList(sources);
    const contentPlan = topic.contentPlan && topic.contentPlan.length > 0
      ? topic.contentPlan.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : '';

    for (const section of Object.keys(SECTION_PROMPTS) as SectionName[]) {
      let fullText = '';
      const stream = generateCompletionStream(SECTION_PROMPTS[section], {
        topic: topic.title,
        supporting_content: supportingContent,
        sources: sourcesList,
        content_plan: contentPlan,
      });
      for await (const chunk of stream) {
        fullText += chunk;
        sseEvent(res, 'section_chunk', { topicTitle: topic.title, section, chunk });
      }
      sections[section] = fullText;
      sseEvent(res, 'section_complete', { topicTitle: topic.title, section, fullText });
    }

    sseEvent(res, 'topic_complete', { topicTitle: topic.title, topicIndex });

    return { title: topic.title, sections: sections as Record<SectionName, string>, sources };
  } catch (e) {
    sseEvent(res, 'topic_error', { topicTitle: topic.title, topicIndex, message: (e as Error).message });
    return null;
  }
}

function formatChunks(chunks: VectorSearchResult[]): string {
  if (!chunks.length) return 'No supporting content available.';
  return chunks
    .map((c, i) => `[${i + 1}] ${c.entry.title}\n${c.entry.bodyText.slice(0, 2_000)}`)
    .join('\n\n---\n\n');
}

function formatSourcesList(sources: { title: string; url: string }[]): string {
  if (!sources.length) return 'No sources available.';
  return sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join('\n');
}
