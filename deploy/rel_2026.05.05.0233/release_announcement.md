# Release Announcement — SAP Business AI Pulse v0.5.0

**Release:** rel_2026.05.05.0233  
**Date:** 2026-05-05  
**Classification:** Minor release

---

## What's New

### Smarter content fetch — per-domain cutoff

The fetch engine now computes the cutoff date independently per source domain rather than using a single global cutoff across all sources. This means:

- **Newly added sources** (e.g. news.sap.com) automatically back-fill the last 2 weeks, even if other sources have more recent entries.
- **Established sources** continue to use their own most-recent ingestion date as the cutoff, avoiding re-ingestion of already-seen content.

### Safer crawl termination

Articles with no detectable published date now stop the crawl for that landing page, the same way an out-of-window article does. Previously, undated articles were ingested unconditionally, which could pull in non-article pages.

### Real-time list updates during fetch

Ingested articles now appear in the content list immediately as they are ingested — no waiting for the fetch to fully complete. The UI shows a single spinning status row with the article currently being processed, which clears as each article resolves.

---

## Required Actions

| Audience | Action |
| :------- | :----- |
| Operators | No schema changes — no migration SQL required |
| Operators | Update image tag to `2026.05.05.0233` via `./deploy/go.sh --env prod --tag 2026.05.05.0233` |
| Users | No action required |

---

## Known Limitations

- Fetch still visits one page per landing URL — no pagination follow-through. Articles older than the cutoff on the first page halt the crawl for that source.
- Optimistic list prepend uses a client-side ingestion timestamp; the list reloads from server on fetch completion to reconcile accurate timestamps.
