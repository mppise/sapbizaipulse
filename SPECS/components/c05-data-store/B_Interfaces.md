---
name: c05-data-store-interfaces
description: Interface specification for C05 Data Store — all exported function signatures and their contracts.
license: Apache-2.0 (see LICENSE in project root)
---

# C05 Data Store — Interfaces

> C05 exposes in-process TypeScript functions only. No REST endpoints. No events.

---

## 1. Module Structure

```
src/
  db/
    index.ts          -- public exports (re-exports from sub-modules)
    pool.ts           -- connection pool lifecycle (initPool, getConnection, closePool)
    contentEntries.ts -- all content_entries query functions
    newsletters.ts    -- all newsletters query functions
    vectorSearch.ts   -- vector similarity search
    health.ts         -- ping()
    errors.ts         -- DataStoreError class and error codes
    types.ts          -- shared TypeScript types/interfaces
```

---

## 2. Shared Types

```typescript
// types.ts

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
  sensitivity: Sensitivity;
  embedding: number[] | null;   // null when not yet embedded
}

export type ContentEntryMeta = Omit<ContentEntry, 'bodyText' | 'embedding'>;

export interface Newsletter {
  id: string;
  filename: string;
  status: NewsletterStatus;
  createdAt: Date;
  publishedAt: Date | null;
  topicList: string[];          // parsed from NCLOB JSON
  objectStoreKey: string | null;
}

export interface VectorSearchResult {
  entry: ContentEntryMeta;
  score: number;                // cosine similarity, 0–1
}

export interface InsertContentEntryInput {
  title: string;
  bodyText: string;
  sourceType: SourceType;
  sourceRef: string;
  sensitivity: Sensitivity;
}

export interface UpdateContentEntryInput {
  title?: string;
  sensitivity?: Sensitivity;
}

export interface InsertNewsletterInput {
  filename: string;
  topicList: string[];
  objectStoreKey?: string;
}

export interface UpdateNewsletterInput {
  status?: NewsletterStatus;
  publishedAt?: Date;
  objectStoreKey?: string;
}
```

---

## 3. Pool Lifecycle

```typescript
// pool.ts

/**
 * Initialise the HANA Cloud connection pool.
 * Must be called once at application startup before any query function is used.
 * Reads HANA_HOST, HANA_PORT, HANA_USER, HANA_PASSWORD from process.env.
 * Throws DataStoreError (DS_CONN_FAILED) if the pool cannot be established.
 */
export async function initPool(): Promise<void>;

/**
 * Acquire a connection from the pool.
 * Throws DataStoreError (DS_CONN_FAILED) if no connection is available.
 */
export async function getConnection(): Promise<hana.Connection>;

/**
 * Drain and close the connection pool.
 * Called on process shutdown.
 */
export async function closePool(): Promise<void>;
```

**Pool configuration:**

| Parameter | Value | Notes |
| :-------- | :---- | :---- |
| `min` connections | 2 | Always-warm connections |
| `max` connections | 10 | Upper bound; sufficient for MVP load |
| `acquire timeout` | 5000ms | Throw DS_CONN_FAILED if exceeded |
| `idle timeout` | 30000ms | Release idle connections after 30s |

---

## 4. Content Entries Functions

```typescript
// contentEntries.ts

/**
 * Insert a new content entry. Returns the generated UUID.
 * Does not set the embedding — call updateContentEntryEmbedding() after AI processing.
 */
export async function insertContentEntry(
  input: InsertContentEntryInput
): Promise<string>;  // returns new entry id

/**
 * Update the embedding vector for a content entry.
 * Called by C01 after C04 returns the embedding.
 */
export async function updateContentEntryEmbedding(
  id: string,
  embedding: number[]   // 1536 dimensions
): Promise<void>;

/**
 * Retrieve a single content entry (including body_text and embedding).
 * Throws DataStoreError (DS_NOT_FOUND) if id does not exist.
 */
export async function getContentEntry(id: string): Promise<ContentEntry>;

/**
 * List content entries. Returns metadata fields only (no body_text, no embedding).
 * Optional filter: if sensitivity is provided, only entries with that tag are returned.
 * Results ordered by ingestion_date descending.
 */
export async function listContentEntries(
  filter?: { sensitivity?: Sensitivity }
): Promise<ContentEntryMeta[]>;

/**
 * Update mutable fields of a content entry.
 * Throws DataStoreError (DS_NOT_FOUND) if id does not exist.
 */
export async function updateContentEntry(
  id: string,
  input: UpdateContentEntryInput
): Promise<void>;

/**
 * Delete a content entry by ID.
 * Throws DataStoreError (DS_NOT_FOUND) if id does not exist.
 */
export async function deleteContentEntry(id: string): Promise<void>;

/**
 * Check whether a content entry with the given source_ref already exists.
 * Used by C01 for duplicate URL/filename detection before insert.
 */
export async function contentEntryExistsBySourceRef(
  sourceRef: string
): Promise<boolean>;
```

---

## 5. Vector Search Function

```typescript
// vectorSearch.ts

/**
 * Perform cosine similarity search against Newsletter-ready content entries.
 * Returns the top K results ordered by similarity score descending.
 *
 * Only entries with sensitivity = 'Newsletter-ready' AND a non-null embedding
 * are considered.
 */
export async function vectorSearch(
  queryEmbedding: number[],   // 1536 dimensions
  topK: number                // number of results to return (typically 5–10)
): Promise<VectorSearchResult[]>;
```

**SQL pattern used:**

```sql
SELECT TOP :topK
  id, title, source_type, source_ref, ingestion_date, sensitivity,
  COSINE_SIMILARITY(embedding, TO_REAL_VECTOR(:queryVec)) AS score
FROM content_entries
WHERE sensitivity = 'Newsletter-ready'
  AND embedding IS NOT NULL
ORDER BY score DESC;
```

---

## 6. Newsletter Functions

```typescript
// newsletters.ts

/**
 * Insert a new newsletter record. Returns the generated UUID.
 * Status defaults to 'draft'.
 */
export async function insertNewsletter(
  input: InsertNewsletterInput
): Promise<string>;  // returns new newsletter id

/**
 * Retrieve a single newsletter record by ID.
 * Throws DataStoreError (DS_NOT_FOUND) if id does not exist.
 */
export async function getNewsletter(id: string): Promise<Newsletter>;

/**
 * List all newsletter records ordered by created_at descending.
 */
export async function listNewsletters(): Promise<Newsletter[]>;

/**
 * Update newsletter record fields.
 * Throws DataStoreError (DS_NOT_FOUND) if id does not exist.
 */
export async function updateNewsletter(
  id: string,
  input: UpdateNewsletterInput
): Promise<void>;

/**
 * Delete a newsletter record by ID.
 * Throws DataStoreError (DS_NOT_FOUND) if id does not exist.
 */
export async function deleteNewsletter(id: string): Promise<void>;
```

---

## 7. Health Function

```typescript
// health.ts

/**
 * Execute SELECT 1 FROM DUMMY to verify HANA connectivity.
 * Returns true if successful.
 * Throws DataStoreError (DS_CONN_FAILED) if the query fails.
 * Used by the Express /health endpoint.
 */
export async function ping(): Promise<true>;
```

---

## 8. Error Codes

```typescript
// errors.ts

export type DataStoreErrorCode =
  | 'DS_CONN_FAILED'    // pool init or connection acquire failed
  | 'DS_QUERY_FAILED'   // SQL execution error
  | 'DS_NOT_FOUND'      // requested record does not exist
  | 'DS_DUPLICATE'      // insert rejected due to duplicate constraint

export class DataStoreError extends Error {
  readonly code: DataStoreErrorCode;
  readonly cause?: Error;
  constructor(code: DataStoreErrorCode, message: string, cause?: Error);
}
```

---

## 9. Consumed Services

| Service | How consumed | Auth |
| :------ | :----------- | :--- |
| HANA Cloud | `@sap/hana-client` connection pool | Username + password from env vars |

---

## 10. Events

C05 produces no events and consumes no events. All interactions are synchronous in-process function calls.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
