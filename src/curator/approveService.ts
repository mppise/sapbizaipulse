import { getContentEntry, updateContentEntryEmbedding, updateContentEntryBodyText, updateContentEntry } from '../db';
import { generateEmbedding, generateCompletion } from '../ai';
import { extractPageContent } from '../scraper/browser';

// [F-C01-APPROVE] Fetch page → synthesize → embed → promote to Newsletter-ready
export async function approveEntry(id: string): Promise<{ id: string; sensitivity: 'Newsletter-ready' }> {
  const entry = await getContentEntry(id);

  if (entry.sensitivity === 'Newsletter-ready') {
    throw Object.assign(new Error('Entry is already Newsletter-ready'), { code: 'CURATOR_ALREADY_APPROVED' });
  }

  let rawText: string;
  let betterTitle: string | null = null;

  if (entry.sourceType === 'pdf') {
    // PDF body text was already extracted at upload time — use it directly
    rawText = entry.bodyText;
  } else {
    // Re-fetch the actual page content via Playwright for url/auto-fetch entries
    const { title: fetchedTitle, bodyText: fetched } = await extractPageContent(entry.sourceRef);
    rawText = fetched;
    betterTitle = fetchedTitle && fetchedTitle.length > 5 && fetchedTitle !== entry.sourceRef
      ? fetchedTitle
      : null;
  }

  // Update title if improved
  if (betterTitle && betterTitle !== entry.title) {
    await updateContentEntry(id, { title: betterTitle });
  }

  // Synthesize raw text into a clean structured summary via LLM
  const result = await generateCompletion('synthesize-content', {
    url: entry.sourceRef,
    raw_content: rawText.slice(0, 20_000),
  });
  const synthesized = result.content;

  if (synthesized.trim() === 'INSUFFICIENT_CONTENT') {
    throw Object.assign(new Error('Page did not contain sufficient content to synthesize'), { code: 'CURATOR_INSUFFICIENT_CONTENT' });
  }

  // Persist synthesized body text
  await updateContentEntryBodyText(id, synthesized);

  // Generate embedding from the synthesized summary
  const embedding = await generateEmbedding(synthesized);
  await updateContentEntryEmbedding(id, embedding);
  await updateContentEntry(id, { sensitivity: 'Newsletter-ready', approvedAt: new Date() });

  return { id, sensitivity: 'Newsletter-ready' };
}
