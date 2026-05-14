# Release Announcement — v0.9.0 (rel_2026.05.14.1915)

**SAP Business AI Pulse — Internal Release**
**Date:** 2026-05-14

---

## What's New

### AI-Generated Email Draft
The envelope button on published newsletters now generates a personalised email introduction using AI. When clicked, it reads the newsletter's content and produces a short, 2-paragraph summary — written in a direct second-person voice with no marketing language. The result is copied to the clipboard as formatted HTML, ready to paste into any email client. The link in the email renders as "Read it here: Newsletter [Month DD, YYYY]" rather than a raw URL.

### Branding Updates
- Published newsletter footer now reads: **"SAP Business AI Pulse · Generated using SAP Business AI Platform"**
- All occurrences of "SAP AI" in the reading guide and UI have been updated to **"SAP Business AI"**

### Infrastructure Fix
A bug where `express.static` intercepted POST requests with cached 304 responses has been resolved. The static middleware is now restricted to GET requests only, with explicit exclusions for `/api/` and `/published/` paths. This was the root cause of the email-summary endpoint appearing to return HTML instead of JSON.

---

## Required Actions

| Who | Action |
| :-- | :----- |
| Operator | Deploy new image (`rel_2026.05.14.1915`) via `./deploy/go.sh --env prod` |
| Operator | No schema migration required |
| Users | No action required — email draft button behaviour changes automatically |

---

## Known Limitations

- The email summary is generated fresh on each button press (no caching). Expect 2–4 seconds of latency while the AI call completes.
- The AI summary tone may vary slightly between invocations due to model temperature (0.5). If a generated summary is unsuitable, click the button again to regenerate.

---

## No Breaking Changes

All existing functionality — content curation, newsletter generation, publish/unpublish, public HTML serving — is unchanged.
