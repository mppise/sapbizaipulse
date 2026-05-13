# Release Audit — rel_2026.05.12.2145

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v0.8.0)**
> **Audited on: 2026-05-12**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 43 modules, no errors |
| TypeScript `--noEmit` (backend) | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 54.18 kB, CSS 33.14 kB |
| Prompt files copied to dist | ✅ PASS | `cp -r src/ai/prompts dist/ai/prompts` added to build script — all 6 `.md` files present in `dist/ai/prompts/` |

---

## 2. Security Audit (`npm audit`)

| Severity | Count | Affected | Risk to Production |
| :------- | :---: | :------- | :----------------- |
| Critical | 0 | — | None |
| High | 1 | `fast-xml-builder` (indirect) | **Accepted** — transitive dev dependency; not in production request path; `npm audit fix` available but deferred to avoid unvetted dependency churn |
| Moderate | 2 | `esbuild` (via `vite`) | **Accepted** (carried forward) — dev-only toolchain, not in production bundle; fix requires breaking Vite upgrade |

---

## 3. Schema Changes

| Change | Migration required | Notes |
| :----- | :----------------: | :---- |
| None | ❌ No | No DB, API contract, or data model changes in this release |

---

## 4. Component Changes

| Component | Status | Summary |
| :-------- | :----: | :------ |
| C02 Newsletter Generator | Updated | LLM prompt improvements: removed `> blockquote` summary requirement from `generate-leadership-execution.md` and `generate-technical-insight.md` — only the executive-summary prompt retains the blockquote (used as topic teaser). Technical-insight persona aligned to journalist framing. |
| C03 Newsletter Lifecycle | Updated | Published newsletter now includes a **Reading Guide** section above the topic list: warm yellow warning-box, H3 title, 3–4 sentence description of newsletter purpose, and three inline colored tab-legend chips. Tab panels (Strategy in Motion, Under the Hood) updated to open directly with their sub-headings, matching the removal of blockquotes from prompts. |
| C04 AI Service | Updated | Build script fix: prompt `.md` files now copied to `dist/ai/prompts/` during `npm run build` — resolves `Prompt file not found: extract-topics.md` runtime error that caused all 19 entries to be skipped during suggest/Pass 1. |
| C01 Content Curator | Updated | Unapprove flow added: `POST /curator/entries/:id/unapprove` route and `unapproveEntry` DB function — allows reverting Newsletter-ready entries back to Internal. UI actions for approve/unapprove wired to entry cards. |

---

## 5. Technical Audit

### A. Syntax

* [X] **[Syntax/All]** Clean TypeScript compilation — zero errors across all changed files

### B. Architecture

* [X] **[Architecture/C03]** Reading Guide is rendered only at publish time (injected into the HTML template in `converter.ts`) — no impact on draft `.md` content or the generator pipeline
* [X] **[Architecture/C03]** Tab panel colored backgrounds use positional CSS selectors (`nth-of-type`) that are stable against content changes — no JS dependency
* [X] **[Architecture/C02]** Blockquote removal from leadership-execution and technical-insight prompts is consistent with the assembler: `extractTeaser()` in `assembler.ts` only reads from `executive-summary`, so removing blockquotes from the other two sections causes no regression in the teaser extraction logic
* [X] **[Architecture/C04]** Prompt copy step appended after `tsc` in build script — correct order; `tsc` creates `dist/ai/` before `cp` runs
* [X] **[Architecture/C01]** `unapproveEntry` resets `sensitivity` to `Internal`, clears `approved_at`, and clears the embedding — correct state reversion with no orphaned vector data

### C. Security

* [X] **[Security/All]** No new input surfaces, routes with elevated privilege, or external API calls introduced
* [X] **[Security/C01]** Unapprove route (`POST /entries/:id/unapprove`) validates entry existence and current state before mutation — 404 on missing, 409 if not approved; no IDOR vector
* [X] **[Security/C03]** Reading Guide HTML is static — no user-supplied content is interpolated into the guide markup

### D. Maintainability

* [X] **[Maintainability/C02]** All three LLM prompts now share a consistent journalist persona framing — reduces drift risk when prompts are edited independently in future
* [X] **[Maintainability/C04]** Build script change is a single `cp` command — no new tooling or config files introduced
* [ ] **[Maintainability/C03]** SEV-3 (carried forward): Typography constants scattered as inline CSS literals in converter template string — a future refactor could extract them as CSS custom properties
* [ ] **[Maintainability/C01]** SEV-3 (carried forward): Optimistic cards use `id: ''` as React key — may cause stale rendering of second+ optimistic card until `loadEntries()` corrects state. Non-blocking.

### E. Test Coverage

* [ ] **[TestCoverage/All]** SEV-3 (carried forward): No automated tests. Covered by smoke test plan below.

### F. Dependencies

* [X] **[Dependencies/All]** No new runtime dependencies added
* [X] **[Dependencies/build]** Build script updated to copy prompt files — no new tooling dependency; uses native `cp`

---

## 6. Risk & Recovery

### Smoke Test Plan

1. **Suggest topics flow**: Open Generator tab → click Suggest — confirm all 19 entries are processed without `Prompt file not found` warnings in server logs; topics list populates.
2. **Generate and publish a newsletter**: Run full generation → publish → open HTML — confirm Reading Guide renders above topics with yellow box, H3 title, body text, and three colored tab chips in a row.
3. **Tab content structure**: Expand a topic → open Strategy in Motion and Under the Hood tabs — confirm content opens directly with `#### What SAP Has Delivered` / `#### How It Works` sub-headings (no stray blockquote at top).
4. **Approve / Unapprove cycle**: In Curator tab, approve an Internal entry → confirm it moves to Newsletter-ready; then unapprove → confirm it reverts to Internal.
5. **Health check**: `GET /api/v1/health` returns 200; no 5xx errors in server logs post-deployment.

### Rollback Plan

| Item | Detail |
| :--- | :----- |
| Trigger | `Prompt file not found` errors persist after deploy, Reading Guide absent from published HTML, unapprove returns 500, or any 5xx on core routes |
| Application rollback | `kubectl set image deployment/sap-bizai-pulse sap-bizai-pulse=docker.io/mppise/sap-bizai-pulse:2026.05.05.1556 -n default` |
| Schema rollback | Not required — no schema changes |
| Data risk | None — LLM prompt changes and HTML template changes only affect newly generated/published newsletters; existing published newsletters are unaffected |
| Estimated recovery time | < 3 minutes |
