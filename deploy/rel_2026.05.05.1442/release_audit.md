# Release Audit — rel_2026.05.05.1442

> **Overall Verdict: ✅ PASS**
> **Release classification: Patch (v0.7.2)**
> **Audited on: 2026-05-05**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 43 modules, no errors |
| TypeScript `--noEmit` (backend) | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 54.18 kB, CSS 33.14 kB |

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
| None | ❌ No | Pure UI/CSS changes — no DB changes |

---

## 4. Component Changes

| Component | Status | Summary |
| :-------- | :----: | :------ |
| C01 Content Curator | UI Polish | Card layout redesigned: actions moved inline to title row; approve/revert/delete use icon-only buttons; loading state upgraded from single-ID to `Set<string>` to support concurrent operations; date metadata reformatted with labelled fields (Published / Fetched / Approved). |
| C02 Newsletter Generator | UI Polish | Card layout aligned with C01: actions moved inline to title row with icon-only buttons; date metadata reformatted with labelled fields (Created / Published). |

---

## 5. Technical Audit

### A. Syntax

* [X] **[Syntax/All]** Clean TypeScript compilation — zero errors across all changed files

### B. Architecture

* [X] **[Architecture/C01]** `approving`/`unapproving`/`deleting` state upgraded from `string | null` to `Set<string>` — correctly handles concurrent button presses (e.g. delete while approve in-flight); `new Set(prev).add(id)` and functional delete pattern are immutable-safe for React state
* [X] **[Architecture/C01]** `fmtDate` helper defined outside the map loop (at component level) — no function re-creation per render cycle
* [X] **[Architecture/C01]** Actions relocated from a separate sibling `div` to inside `.item-card-title-row` — no data flow changes; purely structural DOM rearrangement
* [X] **[Architecture/C02]** `fmtDate` defined inside `newsletters.map()` callback — minor: recreated per render but scoped correctly and causes no functional issue; the function is trivial
* [X] **[Architecture/C02]** `publishing`, `unpublishing`, `deleting` remain `string | null` (single-ID) in NewsletterTab — consistent with the existing single-operation model for newsletters; acceptable given newsletters are not bulk-operated

### C. Security

* [X] **[Security/All]** No new inputs, routes, or API surfaces introduced
* [X] **[Security/All]** No user-supplied data rendered as raw HTML; all string interpolation is React-safe JSX

### D. Maintainability

* [X] **[Maintainability/C01]** `Set<string>` pattern for loading state is a clear improvement — correct solution for the prior single-ID race condition
* [X] **[Maintainability/C01/C02]** `title` attributes added to all icon-only buttons — improves accessibility and hover tooltips
* [ ] **[Maintainability/C02]** SEV-3 (new): `fmtDate` duplicated inside `NewsletterTab` render — should be extracted to a shared utility (e.g. `src/ui/src/utils/format.ts`) alongside `EntryList`'s copy. Non-blocking.
* [ ] **[Maintainability/C01]** SEV-3 (carried forward): Optimistic cards use `id: ''` as React key — key collision risk during multi-article fetch. Non-blocking: short-lived cards are replaced by `loadEntries()` reconciliation.
* [X] **[Maintainability/CSS]** `.btn-sm` global override and `.btn:not(.btn-sm)` baseline rule in `app.css` provide consistent button sizing across both tabs — replaces per-component overrides

### E. Test Coverage

* [ ] **[TestCoverage/All]** SEV-3 (carried forward): No automated tests. Covered by smoke test plan below.

### F. Dependencies

* [X] **[Dependencies/All]** No dependency changes in this release

---

## 6. Risk & Recovery

### Smoke Test Plan

1. **Curator card layout**: Load the Curator tab — confirm all entry cards show title + inline action buttons (approve/revert/delete as icons) in the header row, and the three date labels (Published / Fetched / Approved) in the footer row.
2. **Concurrent action safety**: Trigger an approve on one card; while it is in-flight, trigger a delete on a different card — confirm both spinners display independently and neither button is incorrectly disabled on the other card.
3. **Newsletter card layout**: Load the Newsletter tab — confirm all newsletter cards show filename + inline action buttons in the header row, and Created / Published date labels in the footer row.
4. **Publish/unpublish flow**: Publish a draft newsletter and unpublish a published one — confirm buttons, spinners, and state transitions work correctly.
5. **Health check**: `GET /api/v1/health` returns 200; `GET /api/v1/curator/entries` returns paginated list with all expected fields.

### Rollback Plan

| Item | Detail |
| :--- | :----- |
| Trigger | Layout broken, action buttons non-functional, or any 5xx on curator/newsletter endpoints |
| Application rollback | `kubectl set image deployment/sap-bizai-pulse sap-bizai-pulse=docker.io/mppise/sap-bizai-pulse:2026.05.05.1206 -n default` |
| Schema rollback | Not required — no schema changes in this release |
| Data risk | None — no data mutations; purely UI/CSS changes |
| Estimated recovery time | < 3 minutes |
