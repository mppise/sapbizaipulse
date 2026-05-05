# Release Audit — rel_2026.05.05.1500

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v0.7.0)**
> **Audited on: 2026-05-05**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 43 modules, no errors |
| TypeScript `--noEmit` (backend) | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 54.15 kB, CSS 33.12 kB |

---

## 2. Security Audit (`npm audit`)

| Severity | Count | Affected | Risk to Production |
| :------- | :---: | :------- | :----------------- |
| Critical | 0 | — | None |
| High | 0 | — | None |
| Moderate | 2 | `esbuild` (via `vite`) | **Accepted** — carried forward; dev-only toolchain, not in production bundle; fix requires breaking Vite upgrade |

---

## 3. Schema Changes

| Change | Migration required | Notes |
| :----- | :----------------: | :---- |
| `published_date TIMESTAMP NULL` added to `content_entries` | ✅ **YES** | Run `ALTER TABLE content_entries ADD (published_date TIMESTAMP);` before deploying |

---

## 4. Component Changes

| Component | Status | Summary |
| :-------- | :----: | :------ |
| C01 Content Curator | Updated | Revert button (unapprove): clears embedding only, preserves body_text. Approve workflow split by source type: PDF synthesizes from stored body_text, URL re-fetches and synthesizes fresh. Published date field added to cards. PDF upload sets published_date = upload timestamp. Extract Text button moved to footer, only shown after file selected. In-place card updates on approve/revert/delete — no full page reload. |
| C02 Newsletter Generator | Updated | Suggest Topics button moved to sub-header (same pattern as Curator). Generate Newsletter button moved to sub-header with distinct purple colour. In-place newsletter list updates on publish/unpublish/delete. |
| C05 Data Store | Updated | `published_date` column added to schema, types, insert, list, get, and mapper functions. `unapproveEntry` DB function no longer clears body_text. |

---

## 5. Technical Audit

### A. Syntax

* [X] **[Syntax/All]** Clean TypeScript compilation across all changed files — zero errors

### B. Architecture

* [X] **[Architecture/C01]** Approve workflow correctly branches on `sourceType`: PDF path skips re-fetch, URL path re-fetches and synthesizes — both paths end with embedding + status update
* [X] **[Architecture/C01]** Revert (`unapproveEntry`) correctly clears only `embedding`, `sensitivity`, `approved_at` — `body_text` preserved for re-approval without re-upload
* [X] **[Architecture/C01]** In-place state mutations use targeted `setEntries` updaters — no full list reload on approve/revert/delete, scroll position preserved
* [X] **[Architecture/C02]** `setHeaderActions` pattern in `GeneratorTab` uses stable refs (`handleSuggestRef`, `handleGenerateRef`) — no stale closure risk
* [X] **[Architecture/C05]** `published_date` flows correctly: scraped from article for auto-fetch, set to `new Date()` for PDF at upload, null-safe in all mappers

### C. Security

* [X] **[Security/All]** No new external inputs accepted without validation
* [X] **[Security/C01]** Unapprove route guards against calling on non-approved entries (409 if `sensitivity !== 'Newsletter-ready'`)
* [X] **[Security/C05]** `published_date` inserted as parameterised value — no SQL injection surface

### D. Maintainability

* [X] **[Maintainability/C01]** `approveService.ts` split is clean — two clearly labelled paths, no shared mutable state
* [ ] **[Maintainability/C05]** SEV-3: `vectorSearch.ts` has its own inline mapper duplicating `mapContentEntry` logic from `contentEntries.ts`. Adding `published_date` required updating both — divergence risk if further fields are added. Non-blocking for this release.

### E. Test Coverage

* [ ] **[TestCoverage/All]** SEV-3: No automated tests exist for approve/unapprove lifecycle or `published_date` persistence. Covered by smoke test plan below.

### F. Dependencies

* [X] **[Dependencies/All]** No new dependencies introduced in this release

---

## 6. Risk & Recovery

### Smoke Test Plan

1. **PDF upload → approve → revert → re-approve**: Upload a PDF, approve it (embedding generated), revert it (body_text intact, embedding cleared), re-approve it (embedding regenerated from stored body_text). Confirm card status transitions correctly throughout.
2. **URL approve**: Approve a web-fetched entry — confirm fresh content fetch, synthesis saved to body_text, embedding generated.
3. **Published date on cards**: After Fetch Latest, confirm new cards show article published date. After PDF upload, confirm card shows upload date.
4. **Generate Newsletter header buttons**: On Generator tab, confirm Suggest Topics and Generate Newsletter appear in sub-header; Generate Newsletter only visible after topics are present.
5. **In-place updates**: Approve/revert/delete entries and publish/unpublish/delete newsletters — confirm list updates without page scroll reset.

### Rollback Plan

| Item | Detail |
| :--- | :----- |
| Trigger | Health check failure, 502 on approve/unapprove, or missing published_date on new entries |
| Application rollback | `kubectl set image deployment/sap-bizai-pulse sap-bizai-pulse=docker.io/mppise/sap-bizai-pulse:2026.05.05.0628 -n default` |
| Schema rollback | `ALTER TABLE content_entries DROP COLUMN published_date;` — safe, no data loss; existing entries unaffected |
| Data risk | None — `body_text` is never cleared by revert; `published_date` is nullable and additive |
| Estimated recovery time | < 5 minutes |
