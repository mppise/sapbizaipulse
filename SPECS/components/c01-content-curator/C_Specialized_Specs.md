---
name: c01-content-curator-specialized-specs
description: NFR thresholds, AI integration details, and state machine notes for C01 Content Curator.
license: Apache-2.0 (see LICENSE in project root)
---

# C01 Content Curator — Specialized Specifications

---

## 1. Non-Functional Requirements

| ID | Requirement | Threshold | Measurement | Priority |
| :- | :---------- | :-------- | :---------- | :------: |
| NFR-C01-AUTOFETCH | Auto-fetch completes for all topic pages | < 60s total (all pages combined) | Measured from request receipt to response sent | P0 |
| NFR-C01-PDFSIZE | PDF upload max file size | 20MB | Validated in Express middleware before extraction | P0 |
| NFR-C01-APPROVE | Approve action (embed + promote) completes | < 30s | Measured from PATCH receipt to response | P1 |
| NFR-C01-DUPCHECK | Duplicate detection must run | Before every insert, 100% of the time | Code review | P0 |
| NFR-C01-BODYTRUNC | Body text stored in HANA must not exceed NCLOB practical limits | Truncate at 500,000 characters with a warning log if exceeded | Applied in `insertContentEntry` call preparation | P1 |

---

## 2. AI Integration

C01 uses C04 for a single operation: embedding generation during the approve action.

| C04 function | When called | Input | Expected output |
| :----------- | :---------- | :---- | :-------------- |
| `generateEmbedding(text)` | `PATCH /api/v1/curator/entries/:id/approve` | `entry.bodyText` (full body, up to 500k chars) | `number[]` of length 1536 |

**On embedding success:** `C05.updateContentEntryEmbedding(id, vector)` → `C05.updateContentEntry(id, { sensitivity: 'Newsletter-ready' })` — both must succeed before the approve response is sent. If the second C05 call fails after the vector is written, log the inconsistency and return a 502; the admin can retry (the embedding will be overwritten on retry, which is safe).

**On embedding failure:** Entry stays `Internal`; `AIServiceError` detail is included in the 502 response body under `error.detail`.

---

## 3. Playwright Text Extraction

Both auto-fetch and URL ingestion use the shared `scraper/browser.ts` Playwright instance.

**Extraction algorithm (applied per page):**

1. Navigate to URL with timeout 30s.
2. Wait for `networkidle` (or 5s max, whichever comes first).
3. Attempt to select the first matching element in order: `article`, `main`, `[role="main"]`, `.content`, `body`.
4. Extract `innerText` of the selected element.
5. Post-process: trim, collapse 3+ consecutive newlines to 2, strip HTML entities.
6. If extracted text is < 100 characters, treat as extraction failure (`CURATOR_FETCH_FAILED`).

**Title extraction:** `document.title` — trimmed. If empty, use the URL hostname + path as fallback.

---

## 4. PDF Extraction

Uses `pdfjs-dist` (v4) worker-free mode (Node.js, no canvas dependency).

**Extraction steps:**
1. Load PDF from buffer using `pdfjs-dist/legacy/build/pdf.mjs`.
2. Iterate all pages; extract text items per page; join with newline.
3. Post-process same as Playwright text (trim, collapse newlines).
4. If zero text extracted (e.g. scanned image PDF), return `422 CURATOR_PDF_EXTRACT_FAILED` with message: "No extractable text found. The PDF may be image-based."

---

## 5. Config File Parsing (`_cfg/ai-topics.md`)

`configLoader.ts` applies the following rules:

- Read file as UTF-8.
- Extract lines matching `/^[\-\*]\s+(https?:\/\/\S+)/` (Markdown list item with a URL).
- Deduplicate URLs (case-insensitive).
- Return array of URL strings. If empty → throw `CURATOR_CONFIG_MISSING`.

The file is re-read on every auto-fetch call — no in-memory caching — so changes take effect without a restart.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
