---
name: c02-newsletter-generator-interfaces
description: Interface specification for C02 Newsletter Generator — REST API routes, SSE event schema, and TypeScript contracts.
license: Apache-2.0 (see LICENSE in project root)
---

# C02 Newsletter Generator — Interfaces

---

## 1. Module Structure

```
src/
  generator/
    index.ts            -- Express router; mounts all routes
    suggestService.ts   -- two-pass LLM topic clustering from Newsletter-ready HANA entries
    generateService.ts  -- orchestrates full generation pipeline + SSE streaming
    pipelineWorker.ts   -- per-topic pipeline: persona vectorSearch × 3 → LLM × 3 → guardrail
    assembler.ts        -- assembles full newsletter Markdown from completed topics
    sseEmitter.ts       -- SSE helper: formats and writes events to Express response
    types.ts            -- shared TypeScript types
```

The `GET /api/v1/curator/entries?sensitivity=Newsletter-ready` route is **not** re-implemented in C02 — the author uses the existing C01 endpoint directly from the UI. C02 does not expose a separate knowledge-base list endpoint.

---

## 2. REST API

All routes under `/api/v1/`. All require `X-API-Key` header.

### 2.1 `GET /api/v1/generator/topics/suggest`

Query HANA for `Newsletter-ready` entries within the active timeframe, run two-pass LLM clustering, and return the resulting topic list.

**Response `200`:**
```json
{
  "data": {
    "topics": [
      {
        "title": "SAP AI Core: Embedding Model Upgrades",
        "entryIds": ["uuid-1", "uuid-2"]
      }
    ],
    "timeframeFrom": "2026-04-20T00:00:00.000Z",
    "timeframeTo": "2026-05-04T00:00:00.000Z",
    "entryCount": 12,
    "message": ""
  },
  "meta": { "requestId": "<uuid>" }
}
```

`topics` is an empty array if no `Newsletter-ready` entries exist in the timeframe. `message` carries an informational note in that case. `entryIds` are the content entry UUIDs that were grouped under this topic — passed back to the generate endpoint.

---

### 2.2 `POST /api/v1/generator/generate`

Start the newsletter generation pipeline. Returns an SSE stream.

**Request body:**
```json
{
  "topics": [
    {
      "type": "clustered",
      "title": "SAP AI Core: Embedding Model Upgrades",
      "entryIds": ["uuid-1", "uuid-2"]
    }
  ]
}
```

**Validation:**
- `topics` must be a non-empty array; max 10 items.
- Each item must have `type` (`clustered`), `title`, and `entryIds` (non-empty array of strings).

**Response:** `200 text/event-stream` — SSE stream (see §3).

**Error responses (before stream opens):** `400` for invalid request body.

---

## 3. SSE Event Schema

The `POST /api/v1/generator/generate` response is a persistent SSE connection. The Express route sets:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Each SSE message has `event:` and `data:` fields. `data:` is always a JSON string.

### Event types

#### `topic_start`
Emitted when a topic's pipeline begins.
```json
{ "topicTitle": "SAP AI Core: New Embedding Models", "topicIndex": 0, "totalTopics": 3 }
```

#### `section_chunk`
Emitted for each incremental token chunk from the LLM stream.
```json
{ "topicTitle": "...", "section": "executive-summary", "chunk": "SAP AI Core has" }
```
`section` values: `"executive-summary"` | `"leadership-execution"` | `"technical-insight"`

#### `section_complete`
Emitted when a section's full text is accumulated.
```json
{ "topicTitle": "...", "section": "executive-summary", "fullText": "<complete section text>" }
```

#### `guardrail_result`
Emitted after guardrail check completes for a topic.
```json
{ "topicTitle": "...", "pass": true }
```
or on failure:
```json
{ "topicTitle": "...", "pass": false, "flaggedExcerpt": "...", "reason": "..." }
```

#### `topic_complete`
Emitted when all three sections and the guardrail check for a topic are done.
```json
{ "topicTitle": "...", "topicIndex": 0 }
```

#### `topic_error`
Emitted when a topic's pipeline fails (LLM or embedding error after retries).
```json
{ "topicTitle": "...", "topicIndex": 0, "message": "LLM generation failed after 3 attempts" }
```

#### `generation_complete`
Emitted when all topics are processed and the draft is saved.
```json
{ "newsletterId": "<uuid>", "filename": "newsletter_2026-05-03_a3f1", "successCount": 3, "errorCount": 0 }
```

#### `generation_failed`
Emitted when the entire generation fails (all topics errored, or `saveDraft()` failed).
```json
{ "message": "All topics failed to generate" }
```

---

## 4. TypeScript Types

```typescript
// types.ts

export interface ClusteredTopic {
  type: 'clustered';
  title: string;
  entryIds: string[];   // content entry UUIDs grouped under this topic
}

export type TopicInput = ClusteredTopic;

export type SectionName =
  | 'executive-summary'
  | 'leadership-execution'
  | 'technical-insight';

export interface GeneratedSection {
  name: SectionName;
  fullText: string;
}

export interface GeneratedTopic {
  title: string;
  sections: GeneratedSection[];
  guardrailResult: GuardrailResult;  // from C04
}

export interface GenerateRequest {
  topics: TopicInput[];   // 1–10 items
}
```

---

## 5. Supporting Content Formatting

`formatChunks()` prepares the vector search results for prompt injection:

```typescript
function formatChunks(chunks: VectorSearchResult[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.entry.title}\n${c.entry.bodyText.slice(0, 2000)}`)
    .join('\n\n---\n\n');
}
```

- Maximum 2,000 characters per chunk to avoid token overflow.
- Chunks are numbered `[1]`...`[N]` for traceability in the prompt.
- For `curated` topics, the full entry `bodyText` (up to 4,000 chars) is prepended as chunk `[0]` before vector search results.

---

## 6. Consumed Services (in-process)

| Service | Function(s) called | Notes |
| :------ | :----------------- | :---- |
| C03 Newsletter Lifecycle | `saveDraft()` | Called once at end of successful pipeline |
| C04 AI Service | `generateEmbedding()`, `generateCompletionStream()`, `checkGuardrail()` | Per-topic, per-section |
| C05 Data Store | `vectorSearch()`, `listContentEntries({ sensitivity: 'Newsletter-ready' })`, `getContentEntry()` | Per-topic vector search; curated topic body retrieval |

---

## 7. Events

C02 produces no durable events and consumes no events. The SSE stream is a transient HTTP response, not a pub/sub event system.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
