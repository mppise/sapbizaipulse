# Release Audit — rel_2026.05.04.1552

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v0.2.0)**
> **Audited on: 2026-05-04**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 44 modules, no errors |
| TypeScript `--noEmit` | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 52.85 kB, CSS 32.34 kB |

---

## 2. Security Audit (`npm audit`)

| Severity | Count | Affected | Risk to Production |
| :------- | :---: | :------- | :----------------- |
| Critical | 0 | — | None |
| High | 0 | — | None |
| Moderate | 3 | `uuid@9`, `esbuild` (via `vite`) | **Accepted** — see notes |

**Notes:**
- `uuid` CVE (GHSA-w5hq-g745-h8pq): affects `v3/v5/v6` with a `buf` argument only. This codebase uses `v4` exclusively with no `buf` argument. Not exploitable.
- `esbuild` advisory: Vite dev-dependency only. Not present in the production Docker image (`devDependencies` excluded). Not exploitable at runtime.
- Fix for `uuid` requires a breaking major version bump (`v14`). Deferred — no functional risk.

---

## 3. Dead Code

| Check | Result | Notes |
| :---- | :----: | :---- |
| Unused exports / imports | ✅ PASS | Full audit completed — none found |
| Guardrail code removed | ✅ PASS | `guardrail.ts`, `guardrail-check.md`, `GuardrailResult`, `AI_GUARDRAIL_FAILED` all deleted |
| Unused variables | ✅ PASS | `first` flag and `void rows` suppressor removed |

---

## 4. Schema Changes

| Change | Migration required | Notes |
| :----- | :----------------: | :---- |
| `approved_at TIMESTAMP` added to `content_entries` | ✅ — for existing deployments | `ALTER TABLE content_entries ADD (approved_at TIMESTAMP);` — see `deploy/migrate.sql` |
| No other schema changes | — | — |

**Action required on existing deployment:** Run the commented `ALTER TABLE` in `migrate.sql` before deploying this release.

---

## 5. Component Review

| Component | Status | Changes in this release |
| :-------- | :----: | :---------------------- |
| C01 Content Curator | ✅ | `approved_at` stamped on approval; Approved date shown in curator UI |
| C02 Newsletter Generator | ✅ | Topic suggestion quality gates; `approved_at > ?` strict filter; sources seeded from `entryIds`; guardrail removed |
| C03 Newsletter Lifecycle | ✅ | 70/30 two-pane HTML layout; responsive; sidebar Additional Reading; draft email (rich HTML clipboard) |
| C04 AI Service | ✅ | Guardrail dead code removed; all three generate prompts rewritten (journalist persona, education objective, prohibited language list) |
| C05 Data Store | ✅ | `approved_at` in all queries and type definitions; `>` strict timeframe filter |

---

## 6. UI Facelift

| Area | Status | Notes |
| :--- | :----: | :---- |
| App shell (sidebar + topbar) | ✅ | SAP-themed dark navy sidebar, gold accent, busy strip |
| Login screen (ApiKeyGate) | ✅ | Full-bleed navy gradient, branded card |
| Newsletter HTML (published) | ✅ | 70/30 grid layout, sticky sidebar, responsive collapse at 768px |

---

## 7. Spec Compliance Spot-Check

| Spec reference | Compliance |
| :------------- | :--------- |
| F-C02-SUGGEST — timeframe from `approved_at` | ✅ |
| F-C02-SUGGEST — strict `>` exclusion post-publish | ✅ |
| F-C02-VECSEARCH — sources seeded from `entryIds` | ✅ |
| F-C03-PUBLISH — HTML render on publish | ✅ |
| NFR-C02-TOPICMAX — max 10 topics | ✅ |
| D-SEC-APIKEY — all `/api/*` routes protected | ✅ |

---

## 8. Deployment Checklist

- [ ] Run `ALTER TABLE content_entries ADD (approved_at TIMESTAMP);` on HANA Cloud (existing deployment only)
- [ ] Build Docker image: `docker build -t sap-bizai-pulse:2026.05.04.1552 .`
- [ ] Push to BTP Container Registry
- [ ] Update Kyma deployment image tag
- [ ] Verify `/health` returns `{"status":"ok"}` post-deploy
- [ ] Smoke test: fetch → approve → suggest topics → generate → publish → view newsletter
