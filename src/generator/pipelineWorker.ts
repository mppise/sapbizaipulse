import { Response } from 'express';
import { generateEmbedding, generateCompletionStream } from '../ai';
import { vectorSearch, getContentEntry } from '../db';
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

// Persona-specific query suffixes per section (C02 C_Specialized_Specs §6)
const PERSONA_SUFFIX: Record<SectionName, string> = {
  'executive-summary': 'business impact strategic value executive',
  'leadership-execution': 'implementation adoption roadmap leadership',
  'technical-insight': 'technical architecture API integration developer',
};

export interface ClusteredTopic {
  type: 'clustered';
  title: string;
  entryIds: string[];
}

export type TopicInput = ClusteredTopic;

export interface GeneratedTopic {
  title: string;
  sections: Record<SectionName, string>;
  sources: { title: string; url: string }[];
}

// [F-C02-VECSEARCH, F-C02-GENERATE] Per-topic generation pipeline with persona-specific vector search
export async function runTopicPipeline(
  topic: TopicInput,
  topicIndex: number,
  totalTopics: number,
  res: Response
): Promise<GeneratedTopic | null> {
  sseEvent(res, 'topic_start', { topicTitle: topic.title, topicIndex, totalTopics });

  try {
    const sections: Record<string, string> = {};
    const seenUrls = new Set<string>();
    const sources: { title: string; url: string }[] = [];

    // Seed sources from every entry that was clustered into this topic —
    // these are the direct source pages and must all appear in Additional Reading.
    for (const entryId of topic.entryIds) {
      try {
        const entry = await getContentEntry(entryId);
        if (entry.sourceRef && !seenUrls.has(entry.sourceRef)) {
          seenUrls.add(entry.sourceRef);
          sources.push({ title: entry.title, url: entry.sourceRef });
        }
      } catch {
        // entry may have been deleted — skip silently
      }
    }

    for (const section of Object.keys(SECTION_PROMPTS) as SectionName[]) {
      // Build persona-specific query and retrieve targeted supporting content
      const personaQuery = `${topic.title} ${PERSONA_SUFFIX[section]}`;
      const queryVec = await generateEmbedding(personaQuery);
      const chunks = await vectorSearch(queryVec, 5);

      // Accumulate unique sources across all persona searches
      for (const c of chunks) {
        if (c.entry.sourceRef && !seenUrls.has(c.entry.sourceRef)) {
          seenUrls.add(c.entry.sourceRef);
          sources.push({ title: c.entry.title, url: c.entry.sourceRef });
        }
      }

      const supportingContent = formatChunks(chunks);
      const sourcesList = formatSourcesList(sources);

      let fullText = '';
      const stream = generateCompletionStream(SECTION_PROMPTS[section], {
        topic: topic.title,
        supporting_content: supportingContent,
        sources: sourcesList,
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

// [F-C02-VECSEARCH] Format persona vector search results for prompt injection
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
