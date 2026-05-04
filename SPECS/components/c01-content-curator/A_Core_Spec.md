---
name: c01-content-curator-core-spec
description: Core specification for C01 Content Curator — content ingestion, management, and embedding pipeline.
license: Apache-2.0 (see LICENSE in project root)
---

# C01 Content Curator — Core Specification

> Admin-facing component. Handles all content ingestion (auto-fetch, PDF upload, ad-hoc URL), drives the approve → vectorize → promote sensitivity pipeline, and exposes CRUD management for content entries.

---

## 1. Purpose

C01 is the entry point for all curated content. It:

- Auto-fetches articles from SAP Community topic pages defined in `_cfg/ai-topics.md` using Playwright.
- Accepts ad-hoc PDF uploads (text extracted via pdfjs-dist) and single URL ingestion (fetched via Playwright).
- Enforces duplicate detection before any insert.
- Manages the sensitivity state machine: `Internal` → (admin approves) → embedding requested → `Newsletter-ready` on success / back to `Internal` on failure.
- Exposes REST endpoints consumed by the React UI (Curator tab).
- Delegates embedding generation to C04 and all persistence to C05.

---

## 2. Features

| Status | ID | Description | Priority | Doc Level |
| :----: | :- | :---------- | :------: | :-------: |
| `Complete` | F-C01-AUTOFETCH | Fetch all SAP Community topic pages listed in `_cfg/ai-topics.md`; extract article titles and body text via Playwright; insert new entries (skipping duplicates); return a per-source fetch summary | P0 | - |
| `Complete` | F-C01-INGEST-PDF | Accept a PDF file upload (max 20MB, `.pdf` only); extract text via pdfjs-dist; present extracted preview to admin; on confirmation insert entry with `sensitivity = Internal` | P0 | - |
| `Complete` | F-C01-INGEST-URL | Accept a single URL; fetch page via Playwright; present extracted preview to admin; on confirmation insert entry with `sensitivity = Internal` | P0 | - |
| `Complete` | F-C01-DUPCHECK | Before any insert, check `source_ref` against existing entries; reject with a clear error if a duplicate is found | P0 | - |
| `Complete` | F-C01-LIST | Return a paginated list of all content entries (metadata only — no body text, no embedding vector); support optional filter by `sensitivity` | P0 | Page |
| `Complete` | F-C01-DETAIL | Return full detail for a single content entry including body text; exclude embedding vector from API response | P0 | - |
| `Complete` | F-C01-APPROVE | Admin action: trigger embedding generation for a single `Internal` entry via C04; on success set `sensitivity = Newsletter-ready`; on failure leave as `Internal` and return error detail | P0 | Component |
| `Complete` | F-C01-UPDATE | Update mutable fields of a content entry (`title` only — sensitivity is managed by the approve pipeline, not direct edit) | P1 | Component |
| `Complete` | F-C01-DELETE | Delete a content entry by ID; no cascade required (no FK to newsletters) | P1 | Component |
| `Complete` | F-C01-CFGLOAD | Load `_cfg/ai-topics.md` at auto-fetch time; parse the list of SAP Community topic page URLs from the file; fail with a clear error if the file is missing or empty | P0 | - |

---

## 3. Sensitivity State Machine

```
              [ingested]
                  │
                  ▼
            ┌─────────┐
            │ Internal│ ◄─── (embedding fails)
            └────┬────┘
                 │ admin approves (F-C01-APPROVE)
                 ▼
         [C04 generateEmbedding called]
                 │
        ┌────────┴────────┐
        │ success         │ failure
        ▼                 ▼
┌───────────────┐   ┌─────────┐
│Newsletter-ready│  │ Internal│ + error surfaced to admin
└───────────────┘   └─────────┘
```

**Rules:**
- All entries start as `Internal` regardless of ingestion path.
- Admin cannot directly set `sensitivity = Newsletter-ready` — the only path is through the approve action.
- A failed embedding leaves the entry as `Internal`; admin may retry the approve action.
- `sensitivity` is not an editable field via `F-C01-UPDATE`.

---

## 4. Dependencies

| Dependency | Type | Direction | Notes |
| :--------- | :--- | :-------- | :---- |
| C04 AI Service | Internal component | Outbound | `generateEmbedding(bodyText)` called during approve action |
| C05 Data Store | Internal component | Outbound | All content entry persistence |
| Playwright (Chromium) | Library | Consumed | Auto-fetch and ad-hoc URL ingestion |
| pdfjs-dist | Library | Consumed | PDF text extraction |
| `_cfg/ai-topics.md` | Config file | Consumed | Source of SAP Community topic page URLs |

---

## 5. Data Flows

### 5.1 Auto-fetch flow

```
POST /api/v1/curator/fetch
  → load _cfg/ai-topics.md
  → for each topic URL:
      → Playwright: fetch page, extract articles
      → for each article:
          → C05.contentEntryExistsBySourceRef(url) → skip if duplicate
          → C05.insertContentEntry({ sensitivity: 'Internal', ... })
  → return fetch summary { added, skipped, errors }
```

### 5.2 PDF ingestion flow

```
POST /api/v1/curator/ingest/pdf  (multipart/form-data)
  → validate: .pdf extension, size ≤ 20MB
  → pdfjs-dist: extract body text
  → return preview { title (filename), bodyTextPreview (first 500 chars), fullBodyText }

POST /api/v1/curator/ingest/pdf/confirm
  → C05.contentEntryExistsBySourceRef(filename) → reject if duplicate
  → C05.insertContentEntry({ sensitivity: 'Internal', sourceType: 'pdf', ... })
  → return { id, title, sensitivity }
```

### 5.3 URL ingestion flow

```
POST /api/v1/curator/ingest/url
  → validate: URL format
  → C05.contentEntryExistsBySourceRef(url) → reject if duplicate
  → Playwright: fetch page, extract title + body text
  → return preview { title, bodyTextPreview, fullBodyText, sourceRef }

POST /api/v1/curator/ingest/url/confirm
  → C05.insertContentEntry({ sensitivity: 'Internal', sourceType: 'url', ... })
  → return { id, title, sensitivity }
```

### 5.4 Approve flow

```
PATCH /api/v1/curator/entries/:id/approve
  → C05.getContentEntry(id) → 404 if not found
  → validate: sensitivity must be 'Internal' (idempotency guard)
  → C04.generateEmbedding(entry.bodyText)
      → on success:
          C05.updateContentEntryEmbedding(id, vector)
          C05.updateContentEntry(id, { sensitivity: 'Newsletter-ready' })
          return { id, sensitivity: 'Newsletter-ready' }
      → on failure:
          return 502 with AIServiceError detail
          entry remains 'Internal'
```

---

## 6. `_cfg/ai-topics.md` Format

The config file contains one SAP Community topic page URL per line under a Markdown list. C01 parses all lines matching the pattern `- <url>` or `* <url>`.

Example:
```markdown
# SAP AI Topic Pages

- https://community.sap.com/topics/artificial-intelligence
- https://community.sap.com/topics/generative-ai
- https://community.sap.com/topics/sap-ai-core
```

If the file is missing or yields zero URLs, `POST /api/v1/curator/fetch` returns HTTP 500 with `code: CURATOR_CONFIG_MISSING`.

---

## 7. Playwright Usage

- A single Playwright browser instance is initialised lazily on first use and reused across requests (keep-alive).
- Page navigation timeout: 30s per page.
- Text extraction strategy: select `article` or main content container; fall back to `body` text if no article element found.
- Scraped text is trimmed (leading/trailing whitespace removed; consecutive blank lines collapsed to one).
- The browser instance is shared with C02 — it is owned and initialised by a shared `scraper` module, not by C01 directly.

---

## 8. Execution Mode

- All operations are synchronous (async/await) — no background workers.
- Auto-fetch is initiated by an admin HTTP request and completes synchronously (within the 60s NFR window).
- Long-running operations (auto-fetch, Playwright page loads) execute within the Express request lifecycle; the client waits for the response.

---

## 9. Error Handling

| Scenario | HTTP status | Error code | Behaviour |
| :------- | :---------: | :--------- | :-------- |
| Duplicate source_ref | 409 | `CURATOR_DUPLICATE` | Entry not inserted; detail returned |
| PDF too large (>20MB) | 400 | `CURATOR_PDF_TOO_LARGE` | Rejected before extraction |
| PDF wrong type | 400 | `CURATOR_INVALID_FILE_TYPE` | Rejected before extraction |
| Playwright fetch failure | 502 | `CURATOR_FETCH_FAILED` | Per-URL error in summary (auto-fetch) or response body (ad-hoc) |
| PDF extraction failure | 422 | `CURATOR_PDF_EXTRACT_FAILED` | Error returned; no entry inserted |
| Entry not found | 404 | `CURATOR_NOT_FOUND` | Standard not-found |
| Embedding failure (approve) | 502 | `CURATOR_EMBED_FAILED` | Entry remains `Internal`; error detail returned |
| Config file missing | 500 | `CURATOR_CONFIG_MISSING` | Auto-fetch aborted |

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
