# Release Audit — rel_2026.05.05.1206

> **Overall Verdict: ✅ PASS**
> **Release classification: Patch (v0.7.1)**
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
| None | ❌ No | Pure application-layer fix — no DB changes |

---

## 4. Component Changes

| Component | Status | Summary |
| :-------- | :----: | :------ |
| C01 Content Curator | Bug Fix | Published date now displayed immediately on new cards during Fetch Latest — SSE `article_ingested` event was not including `publishedDate`; optimistic card hardcoded it to `null`. Both sides fixed. |

---

## 5. Technical Audit

### A. Syntax

* [X] **[Syntax/All]** Clean TypeScript compilation — zero errors across both changed files

### B. Architecture

* [X] **[Architecture/C01]** `publishedDate` is guaranteed non-null at the point of `article_ingested` emit (guarded by `if (!publishedDate || publishedDate < cutoff)` on line 84 of `fetchService.ts`) — `publishedDate.toISOString()` is safe with no null-dereference risk
* [X] **[Architecture/C01]** Frontend reads `(data.publishedDate as string) ?? null` — `??` fallback to null is correct defensive guard for any future SSE callers that may not include the field
* [X] **[Architecture/C01]** Full `loadEntries()` reload at `fetch_complete` continues to serve as the authoritative state reconciliation — optimistic card is replaced with server-confirmed data including real `id`

### C. Security

* [X] **[Security/All]** No new inputs, routes, or surfaces introduced
* [X] **[Security/C01]** `publishedDate` value flows from DB-persisted ISO string via SSE to display-only `new Date()` call — no injection surface

### D. Maintainability

* [X] **[Maintainability/C01]** Change is minimal and surgical — 1 line in backend emit, 1 line in frontend optimistic state; no collateral changes
* [ ] **[Maintainability/C01]** SEV-3 (carried forward): Optimistic cards use `id: ''` as React key — if multiple articles are ingested in one fetch session, React key collisions may cause stale rendering of the second+ optimistic card until `loadEntries()` replaces them. Non-blocking: cards are short-lived and the full reload corrects state. Recommend assigning a temporary UUID as the optimistic `id` in a future pass.

### E. Test Coverage

* [ ] **[TestCoverage/All]** SEV-3 (carried forward): No automated tests. Covered by smoke test plan below.

### F. Dependencies

* [X] **[Dependencies/All]** No dependency changes in this release

---

## 6. Risk & Recovery

### Smoke Test Plan

1. **Published date appears immediately on fetch**: Click "Fetch Latest" — as each new article card appears in real-time, confirm the published date (calendar icon) is visible on the card without waiting for the fetch to complete.
2. **Published date correct after reload**: After fetch completes and `loadEntries()` refreshes the list, confirm published dates on all new cards still match what was shown during the optimistic phase.
3. **PDF upload date unaffected**: Upload a PDF — confirm upload timestamp still shows as the published date on the new card (this path was not changed).
4. **Approve / revert lifecycle**: Approve and revert an entry — confirm no regression in approve/unapprove flow introduced by this patch.
5. **Health check**: `GET /api/v1/health` returns 200; `GET /api/v1/curator/entries` returns paginated list with `publishedDate` populated for auto-fetch entries.

### Rollback Plan

| Item | Detail |
| :--- | :----- |
| Trigger | Published dates missing on new cards after fetch, or any 5xx on `/curator/entries` |
| Application rollback | `kubectl set image deployment/sap-bizai-pulse sap-bizai-pulse=docker.io/mppise/sap-bizai-pulse:2026.05.05.1500 -n default` |
| Schema rollback | Not required — no schema changes in this release |
| Data risk | None — no data mutations, purely display/SSE fix |
| Estimated recovery time | < 3 minutes |
