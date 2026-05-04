---
name: c01-content-curator-interfaces
description: Interface specification for C01 Content Curator — REST API routes and request/response contracts.
license: Apache-2.0 (see LICENSE in project root)
---

# C01 Content Curator — Interfaces

---

## 1. Module Structure

```
src/
  curator/
    index.ts          -- Express router; mounts all routes
    fetchService.ts   -- auto-fetch logic (ai-topics.md + Playwright)
    pdfService.ts     -- PDF upload handling + pdfjs-dist extraction
    urlService.ts     -- ad-hoc URL ingestion via Playwright
    approveService.ts -- approve action: C04 embedding + C05 sensitivity promotion
    configLoader.ts   -- loads and parses _cfg/ai-topics.md
  scraper/
    browser.ts        -- shared Playwright browser instance (lazy init, keep-alive)
```

---

## 2. REST API

All routes are mounted under `/api/v1/`. All routes require the `X-API-Key` header (enforced by Express middleware — not repeated per route).

### 2.1 `POST /api/v1/curator/fetch`

Trigger auto-fetch of all SAP Community topic pages from `_cfg/ai-topics.md`.

**Request:** No body.

**Response `200`:**
```json
{
  "data": {
    "added": 12,
    "skipped": 3,
    "errors": [
      { "sourceRef": "https://...", "message": "Playwright timeout" }
    ]
  },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `500 CURATOR_CONFIG_MISSING`

---

### 2.2 `POST /api/v1/curator/ingest/pdf`

Upload a PDF file for text extraction preview.

**Request:** `multipart/form-data`

| Field | Type | Required | Notes |
| :---- | :--- | :------: | :---- |
| `file` | File | Yes | `.pdf` extension; max 20MB |

**Response `200`:**
```json
{
  "data": {
    "title": "<filename without extension>",
    "bodyTextPreview": "<first 500 chars of extracted text>",
    "fullBodyText": "<full extracted text>",
    "sourceRef": "<original filename>"
  },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `400 CURATOR_PDF_TOO_LARGE` · `400 CURATOR_INVALID_FILE_TYPE` · `422 CURATOR_PDF_EXTRACT_FAILED`

---

### 2.3 `POST /api/v1/curator/ingest/pdf/confirm`

Confirm and save a PDF entry after admin reviews the preview.

**Request body:**
```json
{
  "title": "string (required)",
  "sourceRef": "string (required — original filename from preview step)",
  "fullBodyText": "string (required — from preview step)",
  "sensitivity": "Internal"
}
```

**Response `201`:**
```json
{
  "data": { "id": "<uuid>", "title": "...", "sensitivity": "Internal" },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `409 CURATOR_DUPLICATE`

---

### 2.4 `POST /api/v1/curator/ingest/url`

Fetch a single URL and return a preview for admin review.

**Request body:**
```json
{ "url": "string (required, valid URL)" }
```

**Response `200`:**
```json
{
  "data": {
    "title": "<page title>",
    "bodyTextPreview": "<first 500 chars>",
    "fullBodyText": "<full extracted text>",
    "sourceRef": "<url>"
  },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `400 CURATOR_INVALID_URL` · `409 CURATOR_DUPLICATE` · `502 CURATOR_FETCH_FAILED`

---

### 2.5 `POST /api/v1/curator/ingest/url/confirm`

Confirm and save a URL entry after admin reviews the preview.

**Request body:**
```json
{
  "title": "string (required)",
  "sourceRef": "string (required — URL from preview step)",
  "fullBodyText": "string (required — from preview step)",
  "sensitivity": "Internal"
}
```

**Response `201`:**
```json
{
  "data": { "id": "<uuid>", "title": "...", "sensitivity": "Internal" },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `409 CURATOR_DUPLICATE`

---

### 2.6 `GET /api/v1/curator/entries`

List content entries (metadata only). Supports optional query parameter filtering.

**Query parameters:**

| Param | Type | Required | Notes |
| :---- | :--- | :------: | :---- |
| `sensitivity` | `Internal` \| `Newsletter-ready` | No | Filter by sensitivity tag |
| `limit` | integer | No | Default 50; max 200 |
| `offset` | integer | No | Default 0 |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "title": "...",
      "sourceType": "auto-fetch",
      "sourceRef": "https://...",
      "ingestionDate": "2026-05-03T10:00:00Z",
      "sensitivity": "Internal"
    }
  ],
  "meta": {
    "requestId": "<uuid>",
    "total": 47,
    "offset": 0,
    "limit": 50
  }
}
```

---

### 2.7 `GET /api/v1/curator/entries/:id`

Get full detail for a single content entry including body text.

**Response `200`:**
```json
{
  "data": {
    "id": "<uuid>",
    "title": "...",
    "bodyText": "...",
    "sourceType": "pdf",
    "sourceRef": "document.pdf",
    "ingestionDate": "2026-05-03T10:00:00Z",
    "sensitivity": "Internal"
  },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `404 CURATOR_NOT_FOUND`

---

### 2.8 `PATCH /api/v1/curator/entries/:id`

Update mutable fields of a content entry.

**Request body (all fields optional):**
```json
{ "title": "string" }
```

**Response `200`:**
```json
{
  "data": { "id": "<uuid>", "title": "..." },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `404 CURATOR_NOT_FOUND`

---

### 2.9 `PATCH /api/v1/curator/entries/:id/approve`

Trigger embedding generation and promote entry to `Newsletter-ready`.

**Request:** No body.

**Response `200`:**
```json
{
  "data": { "id": "<uuid>", "sensitivity": "Newsletter-ready" },
  "meta": { "requestId": "<uuid>" }
}
```

**Error responses:** `404 CURATOR_NOT_FOUND` · `409 CURATOR_ALREADY_APPROVED` (if already `Newsletter-ready`) · `502 CURATOR_EMBED_FAILED`

---

### 2.10 `DELETE /api/v1/curator/entries/:id`

Delete a content entry by ID.

**Response `204`:** No body.

**Error responses:** `404 CURATOR_NOT_FOUND`

---

## 3. Consumed Services (in-process)

| Service | Function(s) called | Notes |
| :------ | :----------------- | :---- |
| C04 AI Service | `generateEmbedding(bodyText)` | Called during approve action only |
| C05 Data Store | `insertContentEntry()`, `updateContentEntryEmbedding()`, `updateContentEntry()`, `getContentEntry()`, `listContentEntries()`, `deleteContentEntry()`, `contentEntryExistsBySourceRef()` | All persistence operations |

---

## 4. Events

C01 produces no events and consumes no events.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
