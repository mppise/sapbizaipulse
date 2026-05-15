import { listContentEntriesInTimeframe, listNewsletters } from '../db';
import { generateCompletion } from '../ai';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const log = (level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ level, component: 'suggestService', message, ...extra }));

export interface ClusteredTopic {
  title: string;
  entryIds: string[];
  contentPlan?: string[];
}

export interface SuggestResult {
  topics: ClusteredTopic[];
  timeframeFrom: string;
  timeframeTo: string;
  entryCount: number;
  message: string;
}

// [F-C02-SUGGEST] Two-pass LLM topic clustering: Pass 1 extracts insight phrases per entry, Pass 2 consolidates into topics with plan steps
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

  // Pass 1: extract insight phrases per entry (full sentences, no body_text forwarded — token safety).
  const candidates: { phrase: string; entryId: string }[] = [];
  for (const entry of entries) {
    try {
      const result = await generateCompletion('extract-topics', { body_text: entry.bodyText }, { maxTokens: 512, temperature: 0.3 });
      const parsed = parseJsonArray<string>(result.content);
      for (const phrase of parsed) {
        if (typeof phrase === 'string' && phrase.trim().length > 0) {
          candidates.push({ phrase: phrase.trim(), entryId: entry.id });
        }
      }
      log('info', 'Pass 1: extracted phrases for entry', { entryId: entry.id, count: parsed.length });
    } catch (err) {
      log('warn', 'Pass 1: failed to extract phrases for entry — skipping', { entryId: entry.id, error: (err as Error).message });
    }
  }

  if (candidates.length === 0) {
    return {
      topics: [],
      timeframeFrom: timeframeFrom.toISOString(),
      timeframeTo: timeframeTo.toISOString(),
      entryCount: entries.length,
      message: 'Phrase extraction produced no candidates.',
    };
  }

  log('info', 'Pass 1 complete', { candidateCount: candidates.length });

  // Pass 2: consolidate phrases into final topic list (no body_text — phrases are specific enough)
  let consolidated: ClusteredTopic[] = [];
  try {
    const result = await generateCompletion(
      'consolidate-topics',
      { candidate_phrases: JSON.stringify(candidates) },
      { maxTokens: 4096, temperature: 0.2 }
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
