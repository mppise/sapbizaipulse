export type SourceType = 'auto-fetch' | 'pdf' | 'url';
export type Sensitivity = 'Internal' | 'Newsletter-ready';
export type NewsletterStatus = 'draft' | 'published';

export interface ContentEntry {
  id: string;
  title: string;
  bodyText: string;
  sourceType: SourceType;
  sourceRef: string;
  ingestionDate: Date;
  publishedDate: Date | null;
  approvedAt: Date | null;
  sensitivity: Sensitivity;
  embedding: number[] | null;
}

export type ContentEntryMeta = Omit<ContentEntry, 'bodyText' | 'embedding'>;

export interface Newsletter {
  id: string;
  filename: string;
  status: NewsletterStatus;
  createdAt: Date;
  publishedAt: Date | null;
  topicList: string[];
  objectStoreKey: string | null;
}

export interface VectorSearchResult {
  entry: ContentEntry;
  score: number;
}

export interface InsertContentEntryInput {
  title: string;
  bodyText?: string;
  sourceType: SourceType;
  sourceRef: string;
  sensitivity: Sensitivity;
  publishedDate?: Date | null;
}

export interface UpdateContentEntryInput {
  title?: string;
  sensitivity?: Sensitivity;
  approvedAt?: Date;
}

export interface InsertNewsletterInput {
  filename: string;
  topicList: string[];
  objectStoreKey?: string;
}

export interface UpdateNewsletterInput {
  status?: NewsletterStatus;
  publishedAt?: Date | null;
  objectStoreKey?: string;
}
