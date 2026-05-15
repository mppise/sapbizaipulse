# Release Audit — rel_2026.05.15.1700

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v1.1.0)**
> **Audited on: 2026-05-15**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 44 modules, zero errors |
| TypeScript `--noEmit` (backend) | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 54.93 kB, CSS 33.14 kB |
| Prompt files in dist | ✅ PASS | All 7 `.md` files present in `dist/ai/prompts/` |

---

## 2. Security Audit (`npm audit`)

| Severity | Count | Affected | Risk to Production |
| :------- | :---: | :------- | :----------------- |
| Critical | 0 | — | None |
| High | 1 | `fast-xml-builder` (indirect) | **Accepted** (carried forward) — transitive dev dependency; not in production request path |
| Moderate | 2 | `esbuild` (via `vite`) | **Accepted** (carried forward) — dev-only toolchain, not in production bundle |

---

## 3. Schema Changes

| Change | Migration required | Notes |
| :----- | :----------------: | :---- |
| None | ❌ No | No DB, API contract, or data model changes in this release |

---

## 4. Component Changes

| Component | Status | Summary |
| :-------- | :----: | :------ |
| C02 Newsletter Generator | Updated | Two-pass topic suggestion pipeline redesigned: Pass 1 now extracts full-sentence insight phrases (2–5 per entry) instead of short topic name strings; Pass 2 receives `{phrase, entryId}[]` only (no `body_text`) making token usage predictable regardless of curator selection size; `contentPlan` now contains 3–5 full-sentence plan steps suitable as vector search queries. Generation pipeline redesigned: plan-step-driven vector search replaces persona-suffix model; each plan step is embedded and searched independently, results pooled and deduplicated; all three section prompts share the same pooled `supporting_content`. |
| C04 AI Service | Updated | Three newsletter generation prompts updated to prioritise SAP announcements: each prompt now explicitly instructs the LLM to lead with product launches, GA releases, and capability milestones from the supporting content. `extract-topics.md` rewritten for phrase extraction. `consolidate-topics.md` rewritten for phrase-in/plan-step-out model; duplicate old content removed. |

---

## 5. Technical Audit

### A. Syntax

* [X] **[Syntax/All]** Clean TypeScript compilation — zero errors across all changed files.
* [X] **[Syntax/suggestService]** `candidates` array typed as `{ phrase: string; entryId: string }[]` — no implicit `any`; consistent with prompt output shape.
* [X] **[Syntax/pipelineWorker]** `pooledChunks: VectorSearchResult[]` correctly typed; `seenEntryIds` Set prevents duplicate entries in pool.

### B. Architecture

* [X] **[Architecture/suggestService]** `body_text` is no longer carried forward past the Pass 1 loop — token payload for Pass 2 is bounded by number of phrases, not sum of entry body text. Scales safely to large curator selections.
* [X] **[Architecture/suggestService]** Fallback when `contentPlan` is absent: `maxTokens` for Pass 1 increased from 256 to 512 to accommodate longer phrase strings — appropriate given phrases are now sentence-length.
* [X] **[Architecture/pipelineWorker]** `PERSONA_SUFFIX` constant and `getContentEntry` import removed cleanly — no dead code left.
* [X] **[Architecture/pipelineWorker]** Fallback when `contentPlan` is empty or absent: `planSteps` defaults to `[topic.title]` — ensures at least one vector search is always performed; generation does not silently fail with no supporting content.
* [X] **[Architecture/pipelineWorker]** Plan-step loop runs sequentially (not parallel) — consistent with prior persona-suffix design; avoids saturating SAP AI Core embedding endpoint.
* [X] **[Architecture/pipelineWorker]** All three section prompts share the same `supportingContent` string — reduces total AI Core calls from `3 × (1 embed + 1 search)` per topic to `N_steps × (1 embed + 1 search)` per topic. For a 4-step plan this is the same call count; for 3 steps it is fewer.
* [X] **[Architecture/prompts]** SAP announcement prioritisation is framing guidance only — LLM is still bound by the "no fabrication" rule; it cannot invent an announcement not present in supporting content.

### C. Security

* [X] **[Security/suggestService]** `JSON.stringify(candidates)` injects into a prompt variable — not interpolated into SQL or system prompt; no injection surface.
* [X] **[Security/pipelineWorker]** `vectorSearch` called with user-supplied `timeframeFrom` date — validated as `Date` type upstream in route handler; no SQL injection vector.
* [X] **[Security/All]** No new external surfaces, elevated-privilege routes, or third-party integrations introduced.

### D. Maintainability

* [X] **[Maintainability/pipelineWorker]** `formatChunks` simplified to single-argument form — previous two-argument `(primary, supplementary)` split removed along with the primary-fetch logic; cleaner and shorter.
* [X] **[Maintainability/consolidate-topics.md]** Duplicate old prompt content (lines 79–161 in prior version) removed — file now has single authoritative version.
* [ ] **[Maintainability/C03]** SEV-3 (carried forward): Typography constants scattered as inline CSS literals in converter template string.
* [ ] **[Maintainability/C01]** SEV-3 (carried forward): Optimistic cards use `id: ''` as React key.
* [ ] **[Maintainability/EmailDraftModal]** SEV-3 (carried forward): Modal description copy says "Three options" — now 4 tones.

### E. Test Coverage

* [ ] **[TestCoverage/All]** SEV-3 (carried forward): No automated tests. Covered by smoke test plan below.

### F. Dependencies

* [X] **[Dependencies/All]** No new runtime or dev dependencies added.

---

## 6. Risk & Recovery

### Smoke Test Plan

1. **Topic suggestion — phrase pipeline**: Click "Suggest Topics" → topics appear with plan steps (full sentences, not topic name fragments) → plan steps are specific and traceable to real curator content.
2. **Topic suggestion — token safety**: With a large curator selection (10+ entries), suggestion completes without timeout or 500 error — confirming Pass 2 payload no longer carries `body_text`.
3. **Generation — plan-step retrieval**: Generate a newsletter with 2–3 topics → sections render with content clearly related to each topic's plan steps → supporting content in generated text is drawn from timeframe entries.
4. **Generation — SAP announcements**: In generated sections, any GA release, product launch, or capability milestone present in the source entries appears prominently (first paragraph or bold callout) rather than buried in the body.
5. **Generation — no contentPlan fallback**: Manually add a topic without a content plan (via the topic input if supported) → generation still completes using topic title as fallback vector query.
6. **Health check**: `GET /health` returns 200; no 5xx in server logs post-deployment.

### Rollback Plan

| Item | Detail |
| :--- | :----- |
| Trigger | Topic suggestion returns 500, generation produces empty sections, or plan steps are absent from suggested topics |
| Application rollback | `kubectl set image deployment/sap-bizai-pulse sap-bizai-pulse=docker.io/mppise/sap-bizai-pulse:2026.05.15.1200 -n default` |
| Schema rollback | Not required — no schema changes |
| Data risk | None — changes are prompt, service logic, and pipeline only; no existing newsletter data is mutated |
| Estimated recovery time | < 3 minutes |
