import { listContentEntriesInTimeframe, listNewsletters } from '../db';
import { generateCompletion } from '../ai';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const log = (level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ level, component: 'suggestService', message, ...extra }));

export interface ClusteredTopic {
  title: string;
  entryIds: string[];
}

export interface SuggestResult {
  topics: ClusteredTopic[];
  timeframeFrom: string;
  timeframeTo: string;
  entryCount: number;
  message: string;
}

// [F-C02-SUGGEST] Two-pass LLM topic clustering over Newsletter-ready HANA entries
export async function suggestTopics(): Promise<SuggestResult> {
  const timeframeTo = new Date();
  const timeframeFrom = await computeTimeframeFrom();
  log('info', 'Suggest timeframe computed', { from: timeframeFrom.toISOString(), to: timeframeTo.toISOString() });

  const entries = await listContentEntriesInTimeframe(timeframeFrom);
  log('info', 'Newsletter-ready entries in timeframe', { count: entries.length });

  if (entries.length === 0) {
    return {
      topics: [],
      timeframeFrom: timeframeFrom.toISOString(),
      timeframeTo: timeframeTo.toISOString(),
      entryCount: 0,
      message: 'No Newsletter-ready content entries found in the active timeframe.',
    };
  }

  // Pass 1: extract candidate topics per entry
  const candidates: { topic: string; entryId: string }[] = [];
  for (const entry of entries) {
    try {
      const result = await generateCompletion('extract-topics', { body_text: entry.bodyText }, { maxTokens: 256, temperature: 0.3 });
      const parsed = parseJsonArray<string>(result.content);
      for (const topic of parsed) {
        if (typeof topic === 'string' && topic.trim().length > 0) {
          candidates.push({ topic: topic.trim(), entryId: entry.id });
        }
      }
      log('info', 'Pass 1: extracted topics for entry', { entryId: entry.id, count: parsed.length });
    } catch (err) {
      log('warn', 'Pass 1: failed to extract topics for entry — skipping', { entryId: entry.id, error: (err as Error).message });
    }
  }

  if (candidates.length === 0) {
    return {
      topics: [],
      timeframeFrom: timeframeFrom.toISOString(),
      timeframeTo: timeframeTo.toISOString(),
      entryCount: entries.length,
      message: 'Topic extraction produced no candidates.',
    };
  }

  log('info', 'Pass 1 complete', { candidateCount: candidates.length });

  // Pass 2: consolidate and deduplicate candidates into final topic list
  let consolidated: ClusteredTopic[] = [];
  try {
    const result = await generateCompletion(
      'consolidate-topics',
      { candidate_topics: JSON.stringify(candidates) },
      { maxTokens: 2048, temperature: 0.2 }
    );
    consolidated = parseJsonArray<ClusteredTopic>(result.content);
    log('info', 'Pass 2 complete', { topicCount: consolidated.length });
  } catch (err) {
    log('error', 'Pass 2: consolidation failed', { error: (err as Error).message });
    throw Object.assign(new Error('Topic consolidation failed'), { code: 'SUGGEST_CONSOLIDATION_FAILED' });
  }

  // Deduplicate by normalised title as a safety net against LLM non-compliance
  const seen = new Set<string>();
  const deduplicated = consolidated.filter(t => {
    const key = t.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    topics: deduplicated,
    timeframeFrom: timeframeFrom.toISOString(),
    timeframeTo: timeframeTo.toISOString(),
    entryCount: entries.length,
    message: '',
  };
}

// Timeframe start = max(most recent PUBLISHED newsletter publishedAt, 2 weeks ago)
// approved_at > floor (strict) so entries used in the last newsletter are excluded.
// Drafts (including failed ones) do not advance the timeframe floor.
async function computeTimeframeFrom(): Promise<Date> {
  const twoWeeksAgo = new Date(Date.now() - TWO_WEEKS_MS);
  try {
    const newsletters = await listNewsletters();
    const published = newsletters.filter((n) => n.status === 'published' && n.publishedAt != null);
    if (published.length === 0) return twoWeeksAgo;
    const mostRecentPublishedAt = published[0].publishedAt!; // DESC order; [0] is most recent
    return mostRecentPublishedAt > twoWeeksAgo ? mostRecentPublishedAt : twoWeeksAgo;
  } catch {
    log('warn', 'Could not determine last newsletter date — falling back to 2-week timeframe');
    return twoWeeksAgo;
  }
}

function parseJsonArray<T>(raw: string): T[] {
  // Strip markdown code fences if the LLM wrapped the JSON
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array');
  return parsed as T[];
}
