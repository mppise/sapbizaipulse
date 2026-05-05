import { getContentEntry, updateContentEntryEmbedding, updateContentEntryBodyText, updateContentEntry } from '../db';
import { generateEmbedding, generateCompletion } from '../ai';
import { extractPageContent } from '../scraper/browser';

// [F-C01-APPROVE] Fetch page → synthesize → embed → promote to Newsletter-ready
export async function approveEntry(id: string): Promise<{ id: string; sensitivity: 'Newsletter-ready' }> {
  const entry = await getContentEntry(id);

  if (entry.sensitivity === 'Newsletter-ready') {
    throw Object.assign(new Error('Entry is already Newsletter-ready'), { code: 'CURATOR_ALREADY_APPROVED' });
  }

  if (entry.sourceType === 'pdf') {
    // PDF: body_text was extracted at upload — synthesize from it, then embed
    const result = await generateCompletion('synthesize-content', {
      url: entry.sourceRef,
      raw_content: entry.bodyText.slice(0, 20_000),
    });
    const synthesized = result.content;

    if (synthesized.trim() === 'INSUFFICIENT_CONTENT') {
      throw Object.assign(new Error('Page did not contain sufficient content to synthesize'), { code: 'CURATOR_INSUFFICIENT_CONTENT' });
    }

    await updateContentEntryBodyText(id, synthesized);
    const embedding = await generateEmbedding(synthesized);
    await updateContentEntryEmbedding(id, embedding);
    await updateContentEntry(id, { sensitivity: 'Newsletter-ready', approvedAt: new Date() });
  } else {
    // URL / auto-fetch: fetch fresh content, synthesize, save body_text, then embed
    const { title: fetchedTitle, bodyText: fetched } = await extractPageContent(entry.sourceRef);
    const betterTitle = fetchedTitle && fetchedTitle.length > 5 && fetchedTitle !== entry.sourceRef
      ? fetchedTitle : null;

    if (betterTitle && betterTitle !== entry.title) {
      await updateContentEntry(id, { title: betterTitle });
    }

    const result = await generateCompletion('synthesize-content', {
      url: entry.sourceRef,
      raw_content: fetched.slice(0, 20_000),
    });
    const synthesized = result.content;

    if (synthesized.trim() === 'INSUFFICIENT_CONTENT') {
      throw Object.assign(new Error('Page did not contain sufficient content to synthesize'), { code: 'CURATOR_INSUFFICIENT_CONTENT' });
    }

    await updateContentEntryBodyText(id, synthesized);
    const embedding = await generateEmbedding(synthesized);
    await updateContentEntryEmbedding(id, embedding);
    await updateContentEntry(id, { sensitivity: 'Newsletter-ready', approvedAt: new Date() });
  }

  return { id, sensitivity: 'Newsletter-ready' };
}
