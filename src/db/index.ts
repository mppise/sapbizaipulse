export { initPool, getConnection, closePool } from './pool';
export { insertContentEntry, updateContentEntryEmbedding, updateContentEntryBodyText, getContentEntry, listContentEntries, listContentEntriesInTimeframe, updateContentEntry, deleteContentEntry, contentEntryExistsBySourceRef } from './contentEntries';
export { insertNewsletter, getNewsletter, listNewsletters, updateNewsletter, deleteNewsletter } from './newsletters';
export { vectorSearch, ping } from './vectorSearch';
export { DataStoreError } from './errors';
export type { ContentEntry, ContentEntryMeta, Newsletter, VectorSearchResult, InsertContentEntryInput, UpdateContentEntryInput, InsertNewsletterInput, UpdateNewsletterInput, SourceType, Sensitivity, NewsletterStatus } from './types';
