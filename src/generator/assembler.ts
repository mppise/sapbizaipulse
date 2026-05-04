import type { GeneratedTopic, SectionName } from './pipelineWorker';
import { SECTION_LABELS } from './pipelineWorker';

// [F-C02-FILENAME] Generate unique filename — [C_Specialized_Specs §4]
export function generateFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = Math.random().toString(16).slice(2, 6);
  return `newsletter_${date}_${suffix}`;
}

// Extract the first `> blockquote` line from a section body (the LLM-generated teaser)
function extractTeaser(sectionBody: string): string {
  const match = sectionBody.match(/^>\s*(.+)/m);
  return match ? match[1].trim() : '';
}

// Assemble final newsletter Markdown — [A_Core_Spec §4]
export function assembleNewsletter(topics: GeneratedTopic[]): string {
  const now = new Date().toISOString();

  // Collect all unique sources across topics (deduplicate by URL)
  const seenUrls = new Set<string>();
  const allSources: { title: string; url: string }[] = [];

  const lines: string[] = [];

  for (const topic of topics) {
    const slug = toSlug(topic.title);
    const topicTeaser = extractTeaser(topic.sections['executive-summary']);
    lines.push(`## ${topic.title} {#${slug}}`, '');
    if (topicTeaser) lines.push(`> ${topicTeaser}`, '');
    lines.push(`### ${SECTION_LABELS['executive-summary']}`, '', topic.sections['executive-summary'], '');
    lines.push(`### ${SECTION_LABELS['leadership-execution']}`, '', topic.sections['leadership-execution'], '');
    lines.push(`### ${SECTION_LABELS['technical-insight']}`, '', topic.sections['technical-insight'], '');

    lines.push('', '---', '');

    for (const s of topic.sources) {
      if (!seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        allSources.push(s);
      }
    }
  }

  // Consolidated Additional Reading section at the bottom
  if (allSources.length > 0) {
    lines.push('## Additional Reading {#additional-reading}', '');
    for (const s of allSources) {
      lines.push(`- [${s.title}](${s.url})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
