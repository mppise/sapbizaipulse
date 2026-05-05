# Release Announcement — SAP Business AI Pulse v0.5.1

**Release:** rel_2026.05.05.0549
**Date:** 2026-05-05
**Classification:** Patch

---

## What Changed

This is a targeted bug fix release. The Approve and Update actions in the Content Curator were returning 404 errors in the production Kyma environment.

**Root cause:** The Kyma APIRule gateway was configured to allow only `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS`. Both the approve and update endpoints used `PATCH`, which was silently blocked at the gateway — returning 404 instead of passing the request to the application.

**Fix:** Both endpoints changed from `PATCH` to `POST`. The frontend has been updated to match. No functionality has changed — only the HTTP verb.

| Endpoint | Before | After |
| :------- | :----- | :---- |
| `POST /api/v1/curator/entries/:id/approve` | `PATCH` | `POST` |
| `POST /api/v1/curator/entries/:id` | `PATCH` | `POST` |

---

## Required Actions

**Operators:** No configuration, migration, or secret changes required. Deploy the new image tag and verify the smoke test below.

**Users:** No action required. The Approve button in the Content Curator will now work correctly in production.

---

## Known Limitations

- 3 moderate `npm audit` findings (`uuid@9`, `esbuild` via `vite`) carried forward — fixes require breaking version upgrades, deferred to a future release.
