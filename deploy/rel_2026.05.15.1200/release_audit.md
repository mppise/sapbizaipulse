# Release Audit — rel_2026.05.15.1200

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v1.0.0)**
> **Audited on: 2026-05-15**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 44 modules, zero errors |
| TypeScript `--noEmit` (backend) | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 54.68 kB, CSS 33.14 kB |
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
| C03 Newsletter Lifecycle | Updated | `POST /:id/email-summary` now calls AI 4 times in parallel (professional, conversational, story-led, peer-to-peer) and returns `{ drafts: [{tone, body}] }` instead of a single `{ summary }`. |
| C04 AI Service | Updated | `generate-email-summary.md` prompt updated: added `{{tone}}` variable with definitions for all 4 tones; added hard no-fabrication rule (applies to all tones, with explicit story-led callout); removed concise tone. All 3 newsletter generation prompts (`generate-executive-summary.md`, `generate-leadership-execution.md`, `generate-technical-insight.md`) updated: added explicit "Never fabricate, infer, or embellish" bullet to each "must never do" block. |
| C02 Newsletter Generator (UI) | Updated | New `EmailDraftModal.tsx` component: modal with 4 tone cards (Professional/blue, Conversational/green, Story-led/info, Peer-to-peer/yellow), each with a "Copy this" button that copies rich HTML to clipboard and shows "Copied!" confirmation for 2 seconds. `NewsletterTab.tsx` updated: `handleDraftMessage` now opens modal instead of silently copying; `EmailDraft` type updated to 4-tone union. |
| `converter.ts` (newsletter HTML) | Updated | Card structure: header/body/footer layout with `topic-footer` (collapse/expand hints). Footer: shaded bar removed, simplified to right-aligned "↔ Click to expand" CTA; tab-preview icons removed. Collapse bar added at bottom of open card with "⇕ Click to collapse". Reading Guide: `bi-map-fill` + `bi-compass-fill` gold icons on title; guide items stacked vertically with `tab-desc` class and `line-height: 1.3`; `white-space: nowrap` scoped to badge only. Teaser: blockquote replaced with plain `<p>` text. |

---

## 5. Technical Audit

### A. Syntax

* [X] **[Syntax/All]** Clean TypeScript compilation — zero errors across all changed files.
* [X] **[Syntax/EmailDraftModal]** All 4 tone keys present in `TONE_META` record; TypeScript union type matches backend tones array — no runtime key-miss possible.

### B. Architecture

* [X] **[Architecture/C03]** 4 AI calls fired with `Promise.all` — parallel execution; single failure rejects the whole promise and returns 500 to the client, which surfaces as a toast in the UI. Acceptable: all 4 drafts are needed or none are.
* [X] **[Architecture/C03]** `tone` is passed as a prompt variable, not interpolated into a system prompt or SQL — no injection surface.
* [X] **[Architecture/C04]** `temperature: 0.6` on email summary — slightly higher than 0.5 to allow tonal variation across drafts while staying grounded; `maxTokens: 512` unchanged.
* [X] **[Architecture/EmailDraftModal]** Clipboard fallback (`writeText`) used when `ClipboardItem` API is unavailable — graceful degradation, confirmed in prior release.
* [X] **[Architecture/converter]** Collapse bar lives outside `<summary>` — click handled via JS `e.target.closest('.topic-collapse-bar')` to close `<details>`; correct because non-summary clicks inside `<details>` do not natively toggle state.
* [X] **[Architecture/converter]** `grid-column: 1 / -1` on `.topic-footer` with negative margins bleeds flush to card edges — same pattern used by `.tab-bar`; consistent.

### C. Security

* [X] **[Security/C03]** `POST /:id/email-summary` remains behind `X-API-Key` middleware — no unauthenticated access.
* [X] **[Security/EmailDraftModal]** `newsletterLink` is constructed from `window.location.origin` + a server-supplied filename — not from user input; no open-redirect or XSS vector.
* [X] **[Security/EmailDraftModal]** AI-generated body is rendered as text (`whiteSpace: pre-wrap` on a `<p>`) in the modal, not as `dangerouslySetInnerHTML` — no XSS in modal display.
* [X] **[Security/EmailDraftModal]** HTML email template injects `newsletterLink` and `draft.body` into a string written to clipboard — not to the DOM; no XSS vector in the app itself.
* [X] **[Security/All]** No new external surfaces, elevated-privilege routes, or third-party integrations introduced.

### D. Maintainability

* [X] **[Maintainability/EmailDraftModal]** `TONE_META` lookup table cleanly separates tone metadata from rendering logic — adding a 5th tone requires one entry in each of 3 places (prompt, tones array, TONE_META).
* [X] **[Maintainability/C04]** No-fabrication rule is consistent across all 5 prompts now — single authoring convention, no prompt diverges.
* [ ] **[Maintainability/C03]** SEV-3 (carried forward): Typography constants scattered as inline CSS literals in converter template string.
* [ ] **[Maintainability/C01]** SEV-3 (carried forward): Optimistic cards use `id: ''` as React key.
* [ ] **[Maintainability/EmailDraftModal]** SEV-3: Modal description copy says "Three options" — now 4 tones. Minor stale copy, non-blocking.

### E. Test Coverage

* [ ] **[TestCoverage/All]** SEV-3 (carried forward): No automated tests. Covered by smoke test plan below.

### F. Dependencies

* [X] **[Dependencies/All]** No new runtime or dev dependencies added.

---

## 6. Risk & Recovery

### Smoke Test Plan

1. **Email draft modal — happy path**: On a published newsletter, click the envelope button → spinner appears → modal opens with 4 cards (Professional, Conversational, Story-led, Peer-to-peer) → click "Copy this" on one → button turns green "Copied!" → paste into email client → verify greeting, AI body, and "Read it here: Newsletter [date]" hyperlink are present.
2. **Email draft modal — all 4 tones present**: Verify each card has a distinct badge colour and distinct body text — confirming all 4 AI calls completed successfully.
3. **Modal dismiss**: Click outside modal overlay → modal closes cleanly with no state leak; re-clicking envelope re-generates fresh drafts.
4. **Collapse/expand**: Click a newsletter card to expand → tabs appear → "Click to collapse" bar visible at bottom → click it → card collapses cleanly.
5. **Newsletter HTML rendering**: Open a published newsletter → Reading Guide title shows map + compass icons → guide items stack vertically with short descriptions → card teasers render as plain text (no blockquote styling).
6. **Health check**: `GET /health` returns 200; no 5xx in server logs post-deployment.

### Rollback Plan

| Item | Detail |
| :--- | :----- |
| Trigger | Modal never opens after spinner, 4 drafts not all rendered, or newsletter HTML layout broken |
| Application rollback | `kubectl set image deployment/sap-bizai-pulse sap-bizai-pulse=docker.io/mppise/sap-bizai-pulse:2026.05.14.1915 -n default` |
| Schema rollback | Not required — no schema changes |
| Data risk | None — changes are UI, prompt, and HTML template only; no existing newsletter data is mutated |
| Estimated recovery time | < 3 minutes |
