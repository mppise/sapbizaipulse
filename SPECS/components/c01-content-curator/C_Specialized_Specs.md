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

## 6. UX Detail — F-C01-UX-FLOW

### 6.1 Sidebar Step Indicators

The app sidebar (`App.tsx`) renders each of the three workspace tabs as a numbered step:

| Step | Tab | Label |
| :--: | :-- | :---- |
| 1 | Content Curator | "Curate Content" |
| 2 | Newsletter Generator | "Generate Newsletter" |
| 3 | Newsletters | "Review & Publish" |

**Visual design rules:**
- Each sidebar item displays a small step-number badge (e.g. `01`) above or beside the existing icon.
- A vertical dotted/dashed connector line runs between consecutive step badges to make the sequence explicit.
- Active step: full highlight (existing active style retained). Completed steps (steps before the active one): dimmed check indicator. Future steps: muted/inactive style.
- Step numbers are purely visual — they do not change navigation behaviour or disable any tab.
- The connector line uses the existing `--sap-sidebar` colour palette; it must not increase the sidebar width beyond `220px`.

### 6.2 Orientation Banner (Curator Tab)

On first load of the Curator tab, display a dismissible inline banner above the entry list:

**Banner content:**
> **How it works — 3 steps:**
> **Step 1 · Curate** — Fetch or upload SAP AI content and approve entries for use.
> **Step 2 · Generate** — Select topics and generate your newsletter draft with AI.
> **Step 3 · Publish** — Review, edit, and publish the draft as HTML.

**Behaviour:**
- Rendered as a permanent styled `div` above the workflow stepper — always visible, no dismiss control.
- Banner does not appear on other tabs.
- Banner uses SAP blue accent colour (`#e8f2ff` background).

### 6.3 Accessibility
- Step number badges have `aria-label="Step N of 3"`.
- Connector lines are `aria-hidden="true"` (decorative).
- Banner close button has `aria-label="Dismiss orientation guide"`.

---

## 7. UX Detail — F-C01-AUTOFETCH-PROGRESS

### 7.1 SSE Events

The `POST /api/v1/curator/fetch` route switches to a streaming SSE response. Events emitted during the fetch:

| Event | Payload | When |
| :---- | :------ | :--- |
| `landing_start` | `{ url: string }` | About to scrape a topic landing page |
| `landing_done` | `{ url: string, count: number }` | Landing page scraped; article count found |
| `article_processing` | `{ url: string, title: string }` | About to process an individual article |
| `article_ingested` | `{ url: string, title: string }` | Article inserted into DB |
| `article_skipped` | `{ url: string, reason: 'duplicate' \| 'too_old' }` | Article skipped |
| `article_error` | `{ url: string, message: string }` | Error processing article |
| `fetch_complete` | `{ added: number, skipped: number, errors: number }` | All landing pages processed |

### 7.2 UI Progress Display

- `CuratorTab` switches from a single loading spinner to an inline progress list while fetching.
- Each `article_processing` event appends a row: spinner + truncated URL.
- On `article_ingested`: row turns green with a check icon.
- On `article_skipped`: row turns muted with a skip indicator.
- On `article_error`: row turns red with the error message.
- On `fetch_complete`: progress list replaced by the final summary toast.
- The "Fetch Latest" button shows "Fetching…" and is disabled for the duration.

### 7.3 SSE Connection Setup (route handler)

```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setTimeout(0);
const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);
// on complete: clearInterval(keepAlive); res.end();
```

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
| F-C01-UX-FLOW | Added §6 UX Detail for sidebar step indicators and orientation banner | 2026-05-04 | SpecGantry |
| F-C01-AUTOFETCH-PROGRESS | Added §7 UX Detail for real-time fetch progress via SSE | 2026-05-04 | SpecGantry |
