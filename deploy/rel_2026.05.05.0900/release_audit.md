# Release Audit — rel_2026.05.05.0900

> **Overall Verdict: ✅ PASS**
> **Release classification: Minor (v0.4.0)**
> **Audited on: 2026-05-05**

---

## 1. Build

| Check | Result | Notes |
| :---- | :----: | :---- |
| `npm run build` (Vite + tsc) | ✅ PASS | 43 modules (one fewer — IngestUrlModal removed), no errors |
| TypeScript `--noEmit` (backend) | ✅ PASS | Zero type errors |
| TypeScript `--noEmit` (frontend) | ✅ PASS | Zero type errors |
| Frontend bundle (gzip) | ✅ PASS | JS 54.04 kB, CSS 32.78 kB |

---

## 2. Security Audit (`npm audit`)

| Severity | Count | Affected | Risk to Production |
| :------- | :---: | :------- | :----------------- |
| Critical | 0 | — | None |
| High | 0 | — | None |
| Moderate | 3 | `uuid@9`, `esbuild` (via `vite`) | **Accepted** — same as v0.3.0 |

---

## 3. Schema Changes

| Change | Migration required | Notes |
| :----- | :----------------: | :---- |
| None | — | No database changes in this release |

---

## 4. Dead Code Removed

| Item | Type | Notes |
| :--- | :--- | :---- |
| `src/ui/src/curator/IngestUrlModal.tsx` | File deleted | URL ingest feature removed |
| `src/curator/urlService.ts` | File deleted | URL fetch service removed |
| `/ingest/url` route | Backend route removed | From `src/curator/index.ts` |
| `/ingest/url/confirm` route | Backend route removed | From `src/curator/index.ts` |
| `fetchUrl` import | Import removed | From `src/curator/index.ts` |
| `showUrl` state, Add URL button, modal JSX | Frontend removed | From `CuratorTab.tsx` |
| `React.StrictMode` wrapper | Removed | Was causing double effect invocation in dev, leading to duplicate API calls and toast messages |

---

## 5. Component Changes

| Component | Changes in this release |
| :-------- | :---------------------- |
| C01 Content Curator | Add URL feature fully removed (button, modal, routes, service); entry list sorted descending by ingestion date |
| C02 Newsletter Generator | Auto-suggest on tab open fixed — no longer fires twice (StrictMode removed) |
| C03 Newsletter Lifecycle | No changes |
| C04 AI Service | No changes |
| C05 Data Store | No changes |

---

## 6. Deployment Checklist

- [ ] Build Docker image: `docker build -t sap-bizai-pulse:2026.05.05.0900 .`
- [ ] Push to BTP Container Registry
- [ ] Update Kyma deployment image tag to `2026.05.05.0900`
- [ ] No migration SQL required
- [ ] Verify `/health` returns `{"status":"ok"}` post-deploy
- [ ] Smoke test: fetch → approve → generate → publish → view newsletter
