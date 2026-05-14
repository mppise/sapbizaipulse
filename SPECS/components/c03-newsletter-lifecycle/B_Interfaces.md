---
name: c03-newsletter-lifecycle-interfaces
description: Interface specification for C03 Newsletter Lifecycle — REST API routes, internal function signatures, and Object Store client contract.
license: Apache-2.0 (see LICENSE in project root)
---

# C03 Newsletter Lifecycle — Interfaces

---

## 1. Module Structure

```
src/
  lifecycle/
    index.ts          -- Express router; mounts all REST routes
    draftService.ts   -- saveDraft() internal function (called by C02)
    publishService.ts -- publish logic: retrieve md, convert, write html, update C05
    previewService.ts -- retrieve .md from Object Store for preview
    deleteService.ts  -- delete Object Store objects + C05 record
    objectStore.ts    -- S3 client init + putObject/getObject/deleteObject wrappers
    converter.ts      -- markdown-it instance + render()
    types.ts          -- shared TypeScript types
  publisher/
    (markdown-it instance shared here if used by other components — at MVP only C03 uses it)
```

---

## 2. Internal Function (consumed by C02)

```typescript
// draftService.ts

/**
 * Save a generated newsletter draft to Object Store and create the HANA record.
 * Called in-process by C02 at the end of the generation pipeline.
 * Returns the new newsletter record ID and Object Store key.
 * Throws LifecycleError (LIFECYCLE_STORE_WRITE_FAILED) if Object Store write fails.
 * Throws DataStoreError if HANA insert fails (HANA record not created).
 */
export async function saveDraft(input: SaveDraftInput): Promise<SaveDraftResult>;

export interface SaveDraftInput {
  filename: string;         // e.g. 'newsletter_2026-05-03' (no extension)
  topicList: string[];
  markdownContent: string;
}

export interface SaveDraftResult {
  id: string;               // new newsletter UUID from C05
  filename: string;
  status: 'draft';
  objectStoreKey: string;   // e.g. 'drafts/newsletter_2026-05-03.md'
}
```

---

## 3. REST API

All routes mounted under `/api/v1/`. All routes except `GET /published/:filename.html` require the `X-API-Key` header.

### 3.1 `GET /api/v1/newsletters`

List all newsletter records ordered by `created_at` descending.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "filename": "newsletter_2026-05-03",
      "status": "draft",
      "createdAt": "2026-05-03T10:00:00Z",
      "publishedAt": null,
      "topicList": ["SAP AI Core", "Generative AI on BTP"]
    }
  ],
  "meta": { "requestId": "<uuid>", "total": 5 }
}
```

---

### 3.2 `GET /api/v1/newsletters/:id`

Get full detail for a single newsletter record.

**Response `200`:**
```json
{
  "data": {
    "id": "<uuid>",
    "filename": "newsletter_2026-05-03",
    "status": "published",
    "createdAt": "2026-05-03T10:00:00Z",
    "publishedAt": "2026-05-03T12:00:00Z",
    "topicList": ["SAP AI Core"],
    "objectStoreKey": "published/newsletter_2026-05-03.html"
  },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `404 LIFECYCLE_NOT_FOUND`

---

### 3.3 `GET /api/v1/newsletters/:id/preview`

Retrieve raw Markdown content of a draft newsletter for UI editing and preview.

**Response `200`:**
```json
{
  "data": { "markdownContent": "# Newsletter\n\n..." },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `404 LIFECYCLE_NOT_FOUND` · `409 LIFECYCLE_NOT_DRAFT` · `502 LIFECYCLE_STORE_READ_FAILED`

---

### 3.4 `PUT /api/v1/newsletters/:id/content`

Overwrite the Markdown content of a draft newsletter. Draft-only — rejected if already published.

**Request body:**
```json
{ "markdownContent": "# Updated Newsletter\n\n..." }
```

**Validation:** `markdownContent` must be a non-empty string.

**Response `200`:**
```json
{
  "data": { "id": "<uuid>", "filename": "newsletter_2026-05-03" },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `400 LIFECYCLE_INVALID_INPUT` · `404 LIFECYCLE_NOT_FOUND` · `409 LIFECYCLE_ALREADY_PUBLISHED` · `502 LIFECYCLE_STORE_WRITE_FAILED`

---

### 3.5 `POST /api/v1/newsletters/:id/publish`

Convert draft to published HTML and update the newsletter record.

**Request:** No body.

**Response `200`:**
```json
{
  "data": {
    "id": "<uuid>",
    "filename": "newsletter_2026-05-03",
    "status": "published",
    "publishedAt": "2026-05-03T12:00:00Z",
    "htmlPath": "/published/newsletter_2026-05-03.html"
  },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `404 LIFECYCLE_NOT_FOUND` · `409 LIFECYCLE_ALREADY_PUBLISHED` · `502 LIFECYCLE_STORE_READ_FAILED` · `502 LIFECYCLE_STORE_WRITE_FAILED` · `500 LIFECYCLE_CONVERT_FAILED`

---

### 3.6 `POST /api/v1/newsletters/:id/email-summary`

Generate an AI-written email teaser for a newsletter using its full Markdown content as context.

**Response `200`:**
```json
{
  "data": { "summary": "<3–4 sentence plain-text summary>" },
  "meta": { "requestId": "<uuid>" }
}
```

**Behaviour:**
- Always reads from `drafts/<filename>.md` in Object Store — the draft markdown is preserved after publish and contains clean content for summarisation.
- Passes the full Markdown to C04 `generateCompletion('generate-email-summary', { newsletter_content })` at temperature 0.5, max 256 tokens.
- Returns the trimmed completion string as `summary`.

**Error responses:** `404 LIFECYCLE_NOT_FOUND` · `502 LIFECYCLE_STORE_READ_FAILED` · `500 LIFECYCLE_ERROR`

---

### 3.7 `DELETE /api/v1/newsletters/:id`

Delete a newsletter and its associated Object Store files.

**Response `204`:** No body.

**Error responses:** `404 LIFECYCLE_NOT_FOUND`

---

### 3.8 `GET /published/:filename.html` (unauthenticated)

Stream the published HTML file from Object Store to the browser.

**Response `200`:**
- `Content-Type: text/html; charset=utf-8`
- Body: streamed HTML content from Object Store.

**Error responses:** `404` (plain text — "Newsletter not found") · `502` (plain text — "File unavailable")

> This route is handled directly by an Express route handler (not API key middleware). Express static middleware is **not** used — the file lives in Object Store, not on the local filesystem.

---

## 4. Object Store Client Wrappers

```typescript
// objectStore.ts

/**
 * Initialise the S3 client from env vars. Called once at application startup.
 * Throws if any required env var is missing.
 */
export function initObjectStore(): void;

/**
 * Write a string or Buffer to Object Store.
 * Throws LifecycleError (LIFECYCLE_STORE_WRITE_FAILED) on failure.
 */
export async function putObject(
  key: string,
  body: string | Buffer,
  contentType: string
): Promise<void>;

/**
 * Read an Object Store object as a UTF-8 string.
 * Throws LifecycleError (LIFECYCLE_STORE_READ_FAILED) on failure.
 */
export async function getObjectAsString(key: string): Promise<string>;

/**
 * Stream an Object Store object to an Express response.
 * Used by the /published/:filename.html route.
 * Throws LifecycleError (LIFECYCLE_STORE_READ_FAILED) on failure.
 */
export async function streamObjectToResponse(
  key: string,
  res: express.Response
): Promise<void>;

/**
 * Delete an Object Store object.
 * NoSuchKey errors are silently ignored (idempotent).
 * Throws LifecycleError (LIFECYCLE_STORE_WRITE_FAILED) on other failures.
 */
export async function deleteObject(key: string): Promise<void>;
```

---

## 5. Converter

```typescript
// converter.ts

/**
 * Convert a Markdown string to an HTML string using markdown-it v14.
 * HTML escaping is on by default (markdown-it default).
 * Throws LifecycleError (LIFECYCLE_CONVERT_FAILED) if render throws.
 */
export function renderMarkdown(markdownContent: string): string;
```

`markdown-it` is initialised once as a module-level singleton with default options (html: false, xhtmlOut: false, linkify: true).

---

## 6. Error Class

```typescript
// types.ts

export type LifecycleErrorCode =
  | 'LIFECYCLE_NOT_FOUND'
  | 'LIFECYCLE_ALREADY_PUBLISHED'
  | 'LIFECYCLE_NOT_DRAFT'
  | 'LIFECYCLE_STORE_WRITE_FAILED'
  | 'LIFECYCLE_STORE_READ_FAILED'
  | 'LIFECYCLE_CONVERT_FAILED';

export class LifecycleError extends Error {
  readonly code: LifecycleErrorCode;
  readonly cause?: Error;
  constructor(code: LifecycleErrorCode, message: string, cause?: Error);
}
```

---

## 7. Consumed Services (in-process)

| Service | Function(s) called | Notes |
| :------ | :----------------- | :---- |
| C05 Data Store | `insertNewsletter()`, `getNewsletter()`, `listNewsletters()`, `updateNewsletter()`, `deleteNewsletter()` | All newsletter record persistence |
| Object Store (S3) | `putObject()`, `getObjectAsString()`, `streamObjectToResponse()`, `deleteObject()` | All file I/O |

---

## 8. Events

C03 produces no events and consumes no events.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
