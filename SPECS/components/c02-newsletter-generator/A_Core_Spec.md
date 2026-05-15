---
name: c02-newsletter-generator-core-spec
description: Core specification for C02 Newsletter Generator — topic suggestion, content retrieval, LLM generation pipeline, and draft handoff to C03.
license: Apache-2.0 (see LICENSE in project root)
---

# C02 Newsletter Generator — Core Specification

> Author-facing component. Drives the full newsletter generation pipeline: fetch recent SAP Community articles as suggested topics, allow author to curate the final topic list, retrieve supporting content via vector search, generate per-topic newsletter sections via streaming LLM, and hand the completed draft to C03.

---

## 1. Purpose

C02 orchestrates everything between "author clicks Generate" and "draft saved". It:

- Queries HANA for all `Newsletter-ready` entries within the active timeframe (no Playwright, no external fetches).
- Runs a two-pass LLM clustering process over the `body_text` values to produce a refined, deduplicated topic list.
- Accepts the author's confirmed topic list (auto-selected by default; author may deselect and reorder).
- For each topic: embeds each plan step in its `contentPlan` as a vector search query (C05), pools and deduplicates the results into a shared `supporting_content` block, then streams all three newsletter sections from the LLM (C04) using that pooled context.
- Assembles the complete newsletter Markdown, generates a unique filename, and calls `C03.saveDraft()`.
- Streams generation progress to the UI via SSE so the author sees content appear per topic.

---

## 2. Features

| Status | ID | Description | Priority | Doc Level |
| :----: | :- | :---------- | :------: | :-------: |
| `Complete` | F-C02-SUGGEST | Query HANA for all `Newsletter-ready` content entries within the active timeframe (from the most recent newsletter's `created_at` or 2 weeks ago, whichever is earlier, through today); run a two-pass LLM topic clustering process over their `body_text` values to produce a deduplicated, thematically grouped topic list; return the topics with their associated entry IDs | P0 | Component |
| `Complete` | F-C02-CURLIST | Return a list of `Newsletter-ready` content entries from C05 for author to browse and select additional topics from the knowledge base | P0 | Component |
| `Complete` | F-C02-GENERATE | Accept the author's confirmed topic list; for each topic run the full generation pipeline (vector search → LLM generation × 3 sections); stream per-topic SSE events to the UI; on completion assemble the full newsletter Markdown and call `C03.saveDraft()` | P0 | Page |
| `Complete` | F-C02-STREAM | Stream per-topic generation progress to the UI via SSE: emit `topic_start`, `section_chunk` (incremental LLM tokens), `section_complete`, `topic_complete`, and `generation_complete` events | P0 | - |
| `Complete` | F-C02-VECSEARCH | For each topic, call `C05.vectorSearch()` with a query embedding of the topic title to retrieve the top-5 `Newsletter-ready` supporting content chunks | P0 | - |
| `Retired` | F-C02-GUARDRAIL | ~~After generating all three sections for a topic, run `C04.checkGuardrail()` on the concatenated section content; include the guardrail result in the SSE stream and in the assembled Markdown as a comment block~~ — retired; guardrail check removed from pipeline | P0 | - |
| `Complete` | F-C02-FILENAME | Generate a unique newsletter filename in the format `newsletter_<YYYY-MM-DD>_<4-char-hex>` (e.g. `newsletter_2026-05-03_a3f1`) using the current date and a random 4-character hex suffix to avoid collisions | P0 | - |
| `Complete` | F-C02-SAVEDRAFT | On successful generation of all topics, call `C03.saveDraft({ filename, topicList, markdownContent })` to persist the draft | P0 | - |
| `Ready` | F-C02-UX-AUTONAV | On receipt of the `generation_complete` SSE event, automatically navigate the user to the Newsletters tab after a 2-second delay, with a toast notification: "Draft saved — opening Newsletters…" | P1 | Component |
| `Ready` | F-C02-UX-NEXTCTA | After generation completes (and before auto-navigation fires), display a contextual "Next: Review Newsletters →" button in the Generator tab that the user can click immediately to jump to the Newsletters tab without waiting | P1 | Component |

---

## 3. Generation Pipeline (per topic)

```
For each topic in confirmedTopicList:
  1. Emit SSE: topic_start { topicTitle }
  2. Pool supporting content via plan-step-driven vector search:
       For each planStep in topic.contentPlan:
         a. C04.generateEmbedding(planStep) → vec
         b. C05.vectorSearch(vec, topK=5, timeframeFrom) → chunks
       Deduplicate chunks by entry.id (first occurrence wins)
       Format pooled chunks → supporting_content (shared by all three sections)
  3. For each section in ['executive-summary', 'leadership-execution', 'technical-insight']:
       a. C04.generateCompletionStream(promptName, { topic: topicTitle, content_plan, supporting_content, sources })
       b. For each chunk: emit SSE: section_chunk { section, chunk }
       c. Accumulate full section text
       d. Emit SSE: section_complete { section, fullText }
  4. Emit SSE: topic_complete { topicTitle }

After all topics:
  5. Assemble full newsletter Markdown (see §4)
  6. Generate filename (F-C02-FILENAME)
  7. C03.saveDraft({ filename, topicList, markdownContent })
  8. Emit SSE: generation_complete { newsletterId, filename }
```

**Error handling during pipeline:** If LLM generation fails for a topic after retries (C04 handles retries), emit `topic_error { topicTitle, message }` and continue with the next topic. Topics with errors are excluded from the assembled draft. If all topics fail, do not call `saveDraft()` — emit `generation_failed`.

---

## 4. Newsletter Markdown Structure

The assembled Markdown follows this template:

```markdown
# SAP BizAI Pulse — <YYYY-MM-DD>

> Generated on <ISO datetime> | Topics: <N>

---

## <Topic Title>

### Executive Summary

<generated executive summary text>

### Leadership & Execution

<generated leadership & execution text>

### Technical Insight

<generated technical insight text>

---
```

One `---` section separator between topics.

---

## 5. Topic Input Types

The author's confirmed topic list contains topics produced by the two-pass LLM clustering (F-C02-SUGGEST). Each topic carries the IDs of the content entries that were grouped under it.

| Source | Type | Fields |
| :----- | :--- | :----- |
| Two-pass LLM clustering | `clustered` | `title`, `entryIds` (array of content entry UUIDs), `contentPlan` (array of coverage bullet strings) |

For `clustered` topics, the plan steps in `contentPlan` are embedded at generation time to drive vector search — no additional curated-body lookup is needed.

---

## 6. Dependencies

| Dependency | Type | Direction | Notes |
| :--------- | :--- | :-------- | :---- |
| C03 Newsletter Lifecycle | Internal component | Outbound | `saveDraft()` called at end of pipeline |
| C04 AI Service | Internal component | Outbound | `generateEmbedding()`, `generateCompletion()`, `generateCompletionStream()` |
| C05 Data Store | Internal component | Outbound | `vectorSearch()`, `listContentEntries()`, `listNewsletters()` |

---

## 7. Execution Mode

- `GET /api/v1/generator/topics/suggest` — synchronous async/await; completes when HANA query + two-pass LLM clustering finishes.
- `POST /api/v1/generator/generate` — **streaming SSE response**; Express response stays open until `generation_complete` or `generation_failed`. The client must handle SSE (`EventSource` or `fetch` with streaming).

---

## 8. Error Handling

| Scenario | Behaviour |
| :------- | :-------- |
| No `Newsletter-ready` entries in timeframe | Return `200` with empty `topics` array and an informational `message` field |
| LLM topic extraction fails for an entry (Pass 1) | Skip that entry; continue with remaining entries |
| LLM topic consolidation fails (Pass 2) | Return `500` with `SUGGEST_CONSOLIDATION_FAILED` |
| Vector search returns 0 results for a persona query | Proceed with empty supporting content; LLM generates from topic title + persona context alone |
| LLM generation fails for a topic (after C04 retries) | Emit `topic_error` SSE event; skip topic; continue pipeline |
| All topics fail | Emit `generation_failed`; do not call `saveDraft()` |
| `saveDraft()` fails | Emit `generation_failed` with message; draft not persisted |

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
| F-C02-UX-AUTONAV/NEXTCTA | Added F-C02-UX-AUTONAV and F-C02-UX-NEXTCTA features — auto-navigation and Next CTA after generation complete | 2026-05-04 | SpecGantry |
| CHG-PHRASE-PIPELINE | §1/§3/§5 updated: generation pipeline redesigned to plan-step-driven vector search (embed each contentPlan step, pool results, all three sections share same supporting_content); persona-suffix model removed; §1 purpose updated; §5 topic input note updated | 2026-05-15 | SpecGantry |
