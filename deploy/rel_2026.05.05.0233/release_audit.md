# Release Audit — rel_2026.05.05.0233

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v0.5.0)**
> **Audited on: 2026-05-05**

---

## A. Scope & Changes

| Component | Status | Summary |
| :-------- | :----: | :------ |
| C01 Content Curator — fetchService | Updated | Per-domain cutoff logic: cutoff now computed per hostname using most-recent ingestion date for that domain; newly added domains back-fill 2 weeks. Null-date articles now stop the crawl (previously ingested unconditionally). |
| C01 Content Curator — CuratorTab UI | Updated | Progress display simplified: single spinner row showing article currently being processed (replaces two-row previous/current display). Articles prepended to list immediately on `article_ingested` SSE event; final server reload at `fetch_complete` reconciles IDs and timestamps. |
| C01 Content Curator — browser.ts | Updated | Per-domain `isArticleLink()` dispatch: news.sap.com uses date-segment path pattern, blogs.sap.com excludes index paths, SAP Community uses `/ba-p/` and `/td-p/`. |

---

## B. Technical Audit

### Syntax

| # | Check | Result | Notes |
| - | :---- | :----: | :---- |
| 1 | Backend `tsc --noEmit` | ✅ PASS | Zero errors |
| 2 | Frontend `tsc --noEmit` | ✅ PASS | Zero errors |
| 3 | `npm run build` (Vite + tsc) | ✅ PASS | 43 modules, no errors |
| 4 | Frontend bundle (gzip) | ✅ PASS | JS 53.83 kB, CSS 32.78 kB |

### Architecture

| # | Check | Result | Notes |
| - | :---- | :----: | :---- |
| 5 | `computeCutoffForDomain` isolation | ✅ PASS | Pure function; allEntries loaded once per fetch run, not per article |
| 6 | SSE immediate-prepend pattern | ✅ PASS | Optimistic prepend on `article_ingested`; server reload on `fetch_complete` reconciles accurate IDs and ingestion dates |
| 7 | Crawl stop on null date | ✅ PASS | `!publishedDate \|\| publishedDate < cutoff` — null now stops the inner loop, same as too-old |
| 8 | `isArticleLink` dispatch | ✅ PASS | Three-branch hostname dispatch; SAP Community fallback preserved |

### Security

| # | Check | Result | Notes |
| - | :---- | :----: | :---- |
| 9 | `npm audit` | ✅ PASS | 0 critical, 0 high; 3 moderate (uuid@9, esbuild via vite) — same as v0.4.0, accepted |
| 10 | No new external inputs introduced | ✅ PASS | No new API endpoints or user-supplied fields added in this release |

### Maintainability

| # | Check | Result | Notes |
| - | :---- | :----: | :---- |
| 11 | Dead `ProgressRow` / `progress[]` state removed | ✅ PASS | Replaced by single `CurrentProgress \| null` state |
| 12 | Dead `statusBadge`, `currentRow`, `previousRow` removed | ✅ PASS | No orphaned code |
| 13 | Comment on optimistic prepend explains server reload reason | ✅ PASS | Rationale visible at the call site |

### Test Coverage

| # | Check | Result | Notes |
| - | :---- | :----: | :---- |
| 14 | Automated test suite | ⬜ N/A | No automated tests in project — consistent with all prior releases |

### Dependencies

| # | Check | Result | Notes |
| - | :---- | :----: | :---- |
| 15 | No new dependencies introduced | ✅ PASS | `package.json` unchanged |

---

**SEV-1 blockers:** 0  
**SEV-2 blockers:** 0  
**SEV-3 findings:** 0

---

## C. Risk & Recovery

### Smoke Test Plan

1. **Fetch Latest** — trigger fetch; verify single spinner row shows current article, disappears on resolution, and ingested articles appear in list immediately without waiting for fetch to complete.
2. **Per-domain cutoff** — check server logs for `computeCutoffForDomain` entries: SAP Community domains should show `mostRecentIngestion`-based cutoff; news.sap.com (if first run) should show 2-week cutoff.
3. **Null-date stop** — verify logs show `"Article at or beyond cutoff (or no date)"` with `publishedDate: "unknown"` if any undated articles are encountered; crawl for that landing page stops.
4. **List accuracy** — after fetch completes, confirm list entries match server data (IDs populated, ingestion dates correct) following the final reload.
5. **Health check** — `GET /health` returns `{"status":"ok"}`.

### Rollback Plan

| Item | Detail |
| :--- | :----- |
| Trigger | Health check failure or fetch producing 0 results where articles are expected |
| Mechanism | `kubectl set image deployment/sap-bizai-pulse sap-bizai-pulse=mppise/sap-bizai-pulse:2026.05.05.0900` |
| Database | No schema changes — rollback requires no migration |
| Estimated recovery time | < 3 minutes (image pull + rollout) |
