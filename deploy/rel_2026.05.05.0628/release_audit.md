# Release Audit — rel_2026.05.05.0628

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v0.6.0)**
> **Audited on: 2026-05-05**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 43 modules, no errors |
| TypeScript `--noEmit` (backend) | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 53.82 kB, CSS 33.12 kB |

---

## 2. Security Audit (`npm audit`)

| Severity | Count | Affected | Risk to Production |
| :------- | :---: | :------- | :----------------- |
| Critical | 0 | — | None |
| High | 0 | — | None |
| Moderate | 3 | `uuid@9`, `esbuild` (via `vite`) | **Accepted** — carried forward; fixes require breaking version upgrades |

---

## 3. Schema Changes

| Change | Migration required | Notes |
| :----- | :----------------: | :---- |
| None | — | No structural schema changes; `published_at` column was already nullable — no migration needed |

---

## 4. Component Changes

| Component | Changes in this release |
| :-------- | :---------------------- |
| C01 Content Curator | **UI redesign:** Full card grid layout replacing table. Status chips (New/Approved), icon+short-date format, bottom-aligned dates. Taller action buttons. Removed Source column. |
| C02 Newsletter Generator | No changes |
| C03 Newsletter Lifecycle | **New feature:** `POST /:id/unpublish` — reverts a published newsletter to draft status, deletes the published HTML, restores `objectStoreKey` to the draft `.md` path. **UI:** Unpublish button (amber) on published cards. **UI redesign:** Card grid layout matching C01. **Bug fix:** Preview endpoint now returns a clear 409 message when newsletter is published ("unpublish it first to edit"). |
| C04 AI Service | No changes |
| C05 Data Store | **Type fix:** `UpdateNewsletterInput.publishedAt` changed from `Date` to `Date \| null` to support clearing the field on unpublish. `updateNewsletter` condition changed from `if (input.publishedAt)` to `if (input.publishedAt !== undefined)` to correctly handle explicit null. |

---

## 5. Technical Audit

### A. Scope & Changes

| Component | Status | Summary |
| :-------- | :----: | :------ |
| C01 Content Curator | Updated | Card layout UI, status chips, icon dates, taller buttons, source column removed |
| C03 Newsletter Lifecycle | Updated | Unpublish endpoint + flow, card layout UI, improved error on preview of published NL |
| C05 Data Store | Updated | Nullable publishedAt type and null-safe update logic |

### B. Findings

* [X] **Syntax/All** — Build and tsc clean; zero type or syntax errors
* [X] **Architecture/C03** — `POST /unpublish` follows command-endpoint pattern consistent with `POST /publish`; state transition is clean (draft ↔ published)
* [X] **Architecture/C05** — `undefined` vs `null` guard in updateNewsletter correctly distinguishes "not provided" from "clear the value"
* [X] **Security/C03** — Unpublish deletes the published HTML object from object store before updating DB; no orphaned public files
* [X] **Security/C03** — Preview endpoint 409 guard prevents serving draft content path from a published newsletter
* [X] **Maintainability/UI** — Shared CSS classes (`item-grid`, `item-card`, `item-chip`, `item-date-meta`) applied consistently across C01 and C03 tabs; no duplication
* [X] **Dependencies** — 3 moderate vulnerabilities carried forward; no new vulnerabilities introduced in this release
* [ ] **Test Coverage** — No automated tests exist for unpublish flow (pre-existing project-wide gap; not a SEV-1/2 for this release)

**SEV-1 blockers:** None  
**SEV-2 blockers:** None

---

## 6. Risk & Recovery

### Smoke Test Plan

1. **Curate Content tab** — Ingest an entry, verify card layout (New chip, ingestion date icon). Approve it, verify Approved chip and approved date appear.
2. **Newsletter Lifecycle — Publish flow** — Generate a newsletter, publish it. Verify public HTML URL is accessible.
3. **Newsletter Lifecycle — Unpublish flow** — Unpublish a published newsletter. Confirm status reverts to Draft, Unpublish button disappears, Edit button appears.
4. **Newsletter Lifecycle — Re-publish** — After unpublish, open the draft for edit, save changes, publish again. Verify public URL serves updated content.
5. **Delete newsletter** — Delete a newsletter. Confirm both `.md` and `.html` object store files are cleaned up (no orphaned objects).

### Rollback Plan

| Step | Action |
| :--- | :----- |
| Trigger | Smoke test failure or user-reported regression |
| Rollback | Re-deploy `rel_2026.05.05.0549` image tag via `go.sh --env prod` |
| Database | No schema changes — no migration rollback needed |
| Object Store | Published HTML files deleted during unpublish are not recoverable after rollback; re-publish after rollback restores them |
| ETA | ~5 minutes (Kyma re-deploy) |
