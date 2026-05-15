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
| Pass 1 insight extraction (per entry) | `generateCompletion('extract-topics', { body_text })` | Entry body text | Non-streaming; returns JSON array of insight phrase strings |
| Pass 2 topic consolidation | `generateCompletion('consolidate-topics', { candidate_phrases })` | JSON of all phrases + entryIds (no body_text) | Non-streaming; returns JSON array with topic names and plan steps |
| Plan step embedding (per step, per topic) | `generateEmbedding(planStep)` | One plan step string | Per-step; used to retrieve relevant content chunks |
| Executive Summary | `generateCompletionStream('generate-executive-summary', { topic, supporting_content, sources, content_plan })` | Resolved prompt | Streamed |
| Leadership & Execution | `generateCompletionStream('generate-leadership-execution', { topic, supporting_content, sources, content_plan })` | Resolved prompt | Streamed |
| Technical Insight | `generateCompletionStream('generate-technical-insight', { topic, supporting_content, sources, content_plan })` | Resolved prompt | Streamed |

### 1.2 Section Generation Order

Sections are generated **sequentially** within a topic (not in parallel) to:
- Keep SSE event ordering deterministic for the UI.
- Avoid saturating SAP AI Core with concurrent requests per topic.

Topics themselves are also processed **sequentially** — one topic fully completes before the next begins.

### 1.3 Supporting Content Assembly

For each topic, supporting content is assembled using **plan-step-driven vector search**:

For every plan step string in `contentPlan` (2–4 steps per topic):
1. `C04.generateEmbedding(planStep)` → embedding vector
2. `C05.vectorSearch(vec, topK=5, timeframeFrom)` → up to 5 matching entries

All results are pooled across every plan step, deduplicated by `entry.id` (first occurrence wins), and truncated to 2,000 chars each. The pooled set is used as `supporting_content` for **all three section prompts** — there is no longer a separate per-section vector search.

The clustered `entryIds` from Pass 2 are not re-fetched at generation time; they were used to ground Pass 2's content plan and are now superseded by the plan-step vector retrieval which pulls the same (and additional relevant) content from the timeframe pool.

Total supporting content is capped to avoid token overflow (see NFR-C02-CHUNKSIZE).

### 1.4 Content Plan Injection

Each topic produced by Pass 2 carries a `contentPlan: string[]` — 2–4 bullet strings describing specifically what should be covered. This plan is injected into all three section prompts as the `{{content_plan}}` variable, formatted as a numbered list:

```
1. <bullet 1>
2. <bullet 2>
...
```

The section prompts use `{{content_plan}}` as a prioritisation guide: the LLM is instructed to address each plan point where the supporting content supports it, without fabricating content that is not present in the supporting material. If a topic has no `contentPlan` (e.g. a manually added topic), `{{content_plan}}` resolves to an empty string — the prompt's Content Plan section renders blank and the LLM proceeds on supporting content alone.

### 1.5 ~~Guardrail Integration~~ — Retired

F-C02-GUARDRAIL and F-C04-GUARDRAIL have been retired. The guardrail check (`checkGuardrail()`, `guardrail-check.md` prompt, `guardrail_result` SSE event, and `<!-- GUARDRAIL -->` Markdown comments) is no longer part of the generation pipeline.

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

### 5.2 Pass 1 — Per-Entry Insight Extraction

For each entry in the result set, call `C04.generateCompletion('extract-topics', { body_text: entry.bodyText })`.

- Each call returns a JSON array of 2–5 full-sentence **insight phrases** extracted from that entry. Each phrase must be specific, self-contained, and precise enough to serve as a vector search query at generation time (e.g. `"SAP AI Core's new embedding models reduce retrieval latency by 40% for enterprise RAG workloads"`).
- Short topic-name strings are explicitly rejected by the prompt — phrases must be sentence-length.
- Associate each phrase with its source `entry.id`. **Do not carry `body_text` forward** — it is not needed by Pass 2 and must not be included in the candidate payload (token safety).
- If an entry's LLM call fails, skip it and continue.
- Collect all `{ phrase: string, entryId: string }` pairs into a flat list.

**Prompt:** `src/ai/prompts/extract-topics.md`
- Input variable: `{{body_text}}`
- Expected output: a JSON array of full-sentence insight phrase strings, e.g. `["SAP AI Core's new embedding models cut retrieval latency by 40%", "HANA vector index auto-tuning eliminates manual dimensionality configuration"]`

### 5.3 Pass 2 — Topic Consolidation

### 5.3 Pass 2 — Topic Consolidation

The flat `{ phrase: string, entryId: string }[]` candidate list from Pass 1 is passed directly to `C04.generateCompletion('consolidate-topics', { candidate_phrases: JSON.stringify(candidates) })`. **No `body_text` is included** — the phrases are sufficiently specific for the LLM to make genuine grouping and quality decisions without the raw entry text.

- The LLM groups phrases that share the same underlying business capability or technology theme, merges overlapping topics, and filters out weak or redundant content.
- It eliminates redundancy and performs explicit **overlap elimination** — pairs of surviving topics whose phrase pools overlap significantly are merged into the stronger one.
- The number of returned topics is **not fixed**. The prompt instructs the model to return as many topics as are genuinely distinct and well-supported — no padding, no forced cuts. Typically 1–7 topics depending on available content.
- Each final topic maps back to one or more `entryIds` and includes a `contentPlan`: **3–5 full-sentence plan step strings**. Each step must be specific enough to serve as a standalone vector search query at generation time (e.g. `"How SAP AI Core's auto-scaling reduces cold-start latency for burst inference workloads"`). These steps drive both the generation pipeline (as vector search queries and prompt context) and the UI display (shown to the author as the topic plan).
- Expected output: a JSON array of `{ title: string, entryIds: string[], contentPlan: string[] }` objects.

**Prompt:** `src/ai/prompts/consolidate-topics.md`
- Input variable: `{{candidate_phrases}}` — JSON array of `{ phrase: string, entryId: string }` objects
- Expected output: JSON array of `{ title: string, entryIds: string[], contentPlan: string[] }`

### 5.4 Deduplication

After Pass 2, deduplicate the final topic list by normalised title (lowercase, whitespace-collapsed) to guard against any LLM non-compliance. The final list (with `contentPlan` attached) is returned to the UI and stored in the generate request. The UI renders the `contentPlan` plan steps beneath each topic title in the `TopicSelector` to help the author make informed include/exclude decisions.

---

## 6. Plan-Driven Vector Search

Instead of three separate persona-specific searches per section, generation uses the topic's `contentPlan` steps as vector search queries. This grounds retrieval in the actual planned content rather than a generic persona context string.

**For each plan step in `topic.contentPlan`:**
1. `C04.generateEmbedding(planStep)` → embedding vector
2. `C05.vectorSearch(vec, topK=5, timeframeFrom)` → up to 5 matching entries

Results are pooled across all steps, deduplicated by `entry.id` (first occurrence wins), and formatted with `formatChunks()` (see §7). The same pooled `supporting_content` string is injected into all three section prompts for the topic.

`timeframeFrom` is returned by `GET /topics/suggest` in the `timeframeFrom` field and must be included by the client in the `POST /generate` request body as `timeframeFrom: string (ISO 8601)`.

The plan steps run **sequentially** (not in parallel) to avoid saturating SAP AI Core.

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

### 6.4 Refresh Button in Newsletters Tab (F-C02-UX-REFRESH) <!-- F-C02-UX-REFRESH -->

**Location:** Top-right of the Newsletters tab content area, rendered via `setHeaderActions` prop (same mechanism used by CuratorTab for its header actions).

**Label:** `Refresh` with a `bi-arrow-clockwise` icon.

**Behaviour:**
- On click: re-invokes the `load()` function in `NewsletterTab` — identical to the automatic load that fires when the tab is first navigated to.
- Button is disabled while `loading` is `true` to prevent concurrent fetches.
- Uses Bootstrap `btn btn-sm btn-outline-secondary` styling.

**Implementation:**
- `NewsletterTab` must accept a `setHeaderActions` prop of type `(node: ReactNode) => void` from `App.tsx`.
- On mount (and whenever `load` identity changes), call `setHeaderActions(...)` to inject the Refresh button into the header.
- On unmount, call `setHeaderActions(null)` to clear it (use the `useEffect` cleanup).

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
| CHG-001 | Redesigned F-C02-SUGGEST: replaced Playwright scraping with two-pass LLM clustering over Newsletter-ready HANA entries; added persona-specific vector search per section | 2026-05-04 | SpecGantry |
| F-C02-UX-AUTONAV/NEXTCTA | Added §6 UX Detail for auto-navigation and Next CTA | 2026-05-04 | SpecGantry |
| F-C02-UX-REFRESH | Added §6.4 Refresh button spec for Newsletters tab | 2026-05-05 | SpecGantry |
| CHG-TOPIC-PLAN | §1.1/§1.3/§1.4/§5.3/§5.4 updated: removed 5-topic hard cap; added overlap-elimination step; added contentPlan to consolidate-topics output schema; added §1.4 Content Plan Injection — contentPlan passed as content_plan to all three section prompts; UI renders contentPlan bullets in TopicSelector | 2026-05-15 | SpecGantry |
| CHG-VECSEARCH-SCOPE | §6 updated: vector search during generation scoped to timeframeFrom (same window as Pass 1); timeframeFrom passed from client in POST /generate body | 2026-05-15 | SpecGantry |
| CHG-PHRASE-PIPELINE | §1.1/§1.3/§5.2/§5.3/§5.4/§6 redesigned: Pass 1 now extracts full-sentence insight phrases (not topic name strings); Pass 2 receives {phrase, entryId}[] only (no body_text — token safety); contentPlan now contains 3-5 full-sentence plan steps suitable as vector search queries; generation uses plan-step-driven vector search (one embed+search per step, pooled across all steps) replacing persona-suffix searches; all three sections use same pooled supporting_content | 2026-05-15 | SpecGantry |
