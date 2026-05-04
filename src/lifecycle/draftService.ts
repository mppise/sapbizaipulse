import { putObject } from './objectStore';
import { insertNewsletter } from '../db';

export interface SaveDraftInput {
  filename: string;
  topicList: string[];
  markdownContent: string;
}

export interface SaveDraftResult {
  id: string;
  filename: string;
  status: 'draft';
  objectStoreKey: string;
}

// [F-C03-SAVEDRAFT] Called in-process by C02 after generation
export async function saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  const key = `drafts/${input.filename}.md`;
  await putObject(key, input.markdownContent, 'text/markdown; charset=utf-8');
  const id = await insertNewsletter({ filename: input.filename, topicList: input.topicList, objectStoreKey: key });
  return { id, filename: input.filename, status: 'draft', objectStoreKey: key };
}
