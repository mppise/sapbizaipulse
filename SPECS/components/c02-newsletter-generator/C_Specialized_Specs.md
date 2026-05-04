---
name: c02-newsletter-generator-specialized-specs
description: AI integration details, NFR thresholds, and SSE streaming protocol for C02 Newsletter Generator.
license: Apache-2.0 (see LICENSE in project root)
---

# C02 Newsletter Generator — Specialized Specifications

---

## 1. AI Integration Details

### 1.1 C04 Functions Used

| Step | C04 function | Input | Notes |
| :--- | :----------- | :---- | :---- |
| Pass 1 topic extraction (per entry) | `generateCompletion('extract-topics', { body_text })` | Entry body text | Non-streaming; returns JSON array |
| Pass 2 topic consolidation | `generateCompletion('consolidate-topics', { candidate_topics })` | JSON of all candidates | Non-streaming; returns JSON array |
| Persona embedding — executive | `generateEmbedding(personaQuery)` | `"{title} business impact strategic value executive"` | Per-topic |
| Persona embedding — leadership | `generateEmbedding(personaQuery)` | `"{title} implementation adoption roadmap leadership"` | Per-topic |
| Persona embedding — technical | `generateEmbedding(personaQuery)` | `"{title} technical architecture API integration developer"` | Per-topic |
| Executive Summary | `generateCompletionStream('generate-executive-summary', { topic, supporting_content })` | Resolved prompt | Streamed |
| Leadership & Execution | `generateCompletionStream('generate-leadership-execution', { topic, supporting_content })` | Resolved prompt | Streamed |
| Technical Insight | `generateCompletionStream('generate-technical-insight', { topic, supporting_content })` | Resolved prompt | Streamed |
| Guardrail | `checkGuardrail(allSectionsText)` | Concatenated sections | Non-streaming; result embedded in draft |

### 1.2 Section Generation Order

Sections are generated **sequentially** within a topic (not in parallel) to:
- Keep SSE event ordering deterministic for the UI.
- Avoid saturating SAP AI Core with concurrent requests per topic.

Topics themselves are also processed **sequentially** — one topic fully completes before the next begins.

### 1.3 Supporting Content Assembly

For each topic section, supporting content is assembled from the **persona-specific vector search** results for that section:

```
[vector search result 1 (up to 2,000 chars)]
---
[vector search result 2 (up to 2,000 chars)]
...up to 5 vector results
```

If `vectorSearch()` returns 0 results for a persona query, `{{supporting_content}}` is set to `"No supporting content available."` — the LLM generates from the topic title + persona context alone.

### 1.4 Guardrail Integration

- Guardrail check runs **after** all three sections are generated for a topic.
- Input to `checkGuardrail()`: `executiveSummary + '\n\n' + leadershipExecution + '\n\n' + technicalInsight`.
- A guardrail `FAIL` does **not** exclude the topic from the draft — the author is responsible for reviewing and editing flagged content before publishing.
- The guardrail result is surfaced in two places:
  1. SSE `guardrail_result` event (real-time UI feedback).
  2. HTML comment in the assembled Markdown: `<!-- GUARDRAIL: FAIL | <flaggedExcerpt> -->`.

---

## 2. Non-Functional Requirements

| ID | Requirement | Threshold | Measurement | Priority |
| :- | :---------- | :-------- | :---------- | :------: |
| NFR-C02-GENTIME | Total generation time for up to 10 topics | < 5 minutes | Measured from `POST /generate` receipt to `generation_complete` SSE event | P0 |
| NFR-C02-TOPICMAX | Maximum topics per generation request | 10 | Validated in request body; return `400` if exceeded | P0 |
| NFR-C02-SSECONN | SSE connection must not timeout on long generations | Express `res.setTimeout(0)` disables socket timeout for the SSE response | Verified by smoke test with 10 topics | P0 |
| NFR-C02-PARTIAL | Partial success is valid — at least 1 topic must succeed for a draft to be saved | If ≥ 1 topic succeeds, `saveDraft()` is called with successful topics only | Verified by test with one failing topic | P1 |
| NFR-C02-CHUNKSIZE | Supporting content per topic must not cause token overflow | Total supporting content capped at ~14,000 chars (5 × 2,000 + 1 × 4,000) across all chunks; prompt template accounts for system prompt + section headers overhead | Prompt engineering | P0 |

---

## 3. SSE Connection Management

```typescript
// In the Express route handler for POST /api/v1/generator/generate:

res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setTimeout(0);   // disable Express socket timeout for long-running SSE

// Keep-alive: emit a comment every 15s to prevent proxy/load-balancer timeout
const keepAliveInterval = setInterval(() => res.write(': keep-alive\n\n'), 15000);

// On stream end (success or failure):
clearInterval(keepAliveInterval);
res.end();
```

SSE comment lines (`: keep-alive`) are valid SSE syntax and are ignored by `EventSource` clients — they only serve to keep the TCP connection alive through proxies.

---

## 4. Filename Generation

```typescript
function generateFilename(): string {
  const date = new Date().toISOString().slice(0, 10);   // 'YYYY-MM-DD'
  const suffix = Math.random().toString(16).slice(2, 6); // 4-char hex
  return `newsletter_${date}_${suffix}`;
  // e.g. 'newsletter_2026-05-03_a3f1'
}
```

The suffix provides collision avoidance for multiple generations on the same day without requiring a database round-trip for uniqueness checking.

---

## 5. Topic Suggest — Two-Pass LLM Clustering

### 5.1 Timeframe Calculation

```
timeframeFrom = max(most_recent_newsletter.created_at, today − 14 days)
timeframeTo   = today (UTC midnight)
```

If no newsletters exist yet, `timeframeFrom = today − 14 days`.

Query: `SELECT * FROM content_entries WHERE sensitivity = 'Newsletter-ready' AND ingestion_date >= timeframeFrom`.

### 5.2 Pass 1 — Per-Entry Topic Extraction

For each entry in the result set, call `C04.generateCompletion('extract-topics', { body_text: entry.bodyText })`.

- Each call returns a JSON array of 1–3 candidate topic strings extracted from that entry.
- Associate each candidate topic with its source `entry.id`.
- If an entry's LLM call fails, skip it and continue.
- Collect all `{ topic: string, entryId: string }` pairs into a flat list.

**Prompt:** `src/ai/prompts/extract-topics.md`
- Input variable: `{{body_text}}`
- Expected output: a JSON array of short topic strings, e.g. `["SAP AI Core embedding upgrades", "HANA vector index tuning"]`

### 5.3 Pass 2 — Topic Consolidation

Feed the full flat list of candidate topics to `C04.generateCompletion('consolidate-topics', { candidate_topics: JSON.stringify(candidateList) })`.

- The LLM merges near-duplicates, eliminates redundancy, and returns a refined list of final topic objects.
- Each final topic maps back to one or more `entryIds`.
- Expected output: a JSON array of `{ title: string, entryIds: string[] }` objects.

**Prompt:** `src/ai/prompts/consolidate-topics.md`
- Input variable: `{{candidate_topics}}` — JSON array of `{ topic: string, entryId: string }` objects
- Expected output: JSON array of `{ title: string, entryIds: string[] }`

### 5.4 Deduplication

After Pass 2, deduplicate the final topic list by normalised title (lowercase, whitespace-collapsed) to guard against any LLM non-compliance. The final list is returned to the UI and stored in the generate request.

---

## 6. Persona-Specific Vector Search

Each of the three newsletter sections uses a **persona-specific query string** for its vector search, rather than the bare topic title. This ensures each section's supporting content is tuned to its audience.

| Section | Persona query template |
| :------ | :--------------------- |
| `executive-summary` | `"{topicTitle} business impact strategic value executive"` |
| `leadership-execution` | `"{topicTitle} implementation adoption roadmap leadership"` |
| `technical-insight` | `"{topicTitle} technical architecture API integration developer"` |

Each persona query is embedded independently (`C04.generateEmbedding(personaQuery)`), then `C05.vectorSearch(vec, topK=5)` is called. The three searches run **sequentially** (not in parallel) to avoid saturating SAP AI Core.

Supporting content per section is formatted using `formatChunks()` (see §7).

---

## 7. Supporting Content Formatting

`formatChunks()` prepares persona vector search results for prompt injection:

```typescript
function formatChunks(chunks: VectorSearchResult[]): string {
  if (!chunks.length) return 'No supporting content available.';
  return chunks
    .map((c, i) => `[${i + 1}] ${c.entry.title}\n${c.entry.bodyText.slice(0, 2_000)}`)
    .join('\n\n---\n\n');
}
```

- Maximum 2,000 characters per chunk to avoid token overflow.
- Chunks are numbered `[1]`...`[N]` for traceability in the prompt.
- Total supporting content per section: up to 5 × 2,000 = 10,000 chars.

---

## 6. UX Detail — F-C02-UX-AUTONAV and F-C02-UX-NEXTCTA

### 6.1 Auto-Navigation on Generation Complete (F-C02-UX-AUTONAV)

**Trigger:** `generation_complete` SSE event received in `GeneratorTab.tsx`.

**Behaviour:**
1. Show a toast notification: `"Draft saved — opening Newsletters…"` (variant: `success`).
2. After a **2-second delay**, call the `onNavigate('newsletters')` prop to switch the active tab to the Newsletters tab.
3. The 2-second delay gives the user time to read the toast before the view changes.
4. If the user manually clicks "Next: Review Newsletters →" (F-C02-UX-NEXTCTA) before the 2-second timer fires, cancel the timer to avoid a redundant navigation.

**Implementation note:** `GeneratorTab` must accept an `onNavigate: (tab: Tab) => void` prop from `App.tsx`. `App.tsx` passes `setTab` as this prop.

### 6.2 Next CTA Button (F-C02-UX-NEXTCTA)

**When shown:** Rendered immediately after `generation_complete` is received, replacing or appearing below the existing `doneMessage` alert.

**Button label:** `Next: Review Newsletters →`

**Behaviour:**
- On click: cancel the pending auto-navigation timer (if still running), then immediately call `onNavigate('newsletters')`.
- Button uses Bootstrap `btn btn-primary` styling with a right-arrow icon (`bi-arrow-right`).
- The existing `doneMessage` alert (showing the newsletter ID) remains visible alongside the button.

### 6.3 Error Case
- Auto-navigation and the Next CTA must **not** fire on `generation_failed` — only on `generation_complete`.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
| CHG-001 | Redesigned F-C02-SUGGEST: replaced Playwright scraping with two-pass LLM clustering over Newsletter-ready HANA entries; added persona-specific vector search per section | 2026-05-04 | SpecGantry |
| F-C02-UX-AUTONAV/NEXTCTA | Added §6 UX Detail for auto-navigation and Next CTA | 2026-05-04 | SpecGantry |
