# Release Announcement — v0.7.1 (rel_2026.05.05.1206)

**Type:** Patch · **Date:** 2026-05-05 · **Affects:** Content Curator

---

## What Changed

**Bug fix: Published date now shown immediately on new article cards**

When using "Fetch Latest" in the Content Curator, newly ingested article cards now display the published date (the calendar icon) as soon as each card appears — rather than remaining blank until the full fetch operation completes.

**Root cause:** The server-sent event (`article_ingested`) was not including the `publishedDate` field in its payload, and the frontend optimistic card defaulted to `null`. Both sides have been corrected.

---

## Required Actions

| Audience | Action |
| :------- | :----- |
| Operators | Standard image update — no schema migration, no config changes required |
| Users | None — behaviour change is purely visual/UX |

---

## Known Limitations

- If multiple articles are ingested in a single fetch session, the second and subsequent optimistic cards may briefly flicker due to React key collisions (`id: ''`). Cards correct themselves when the fetch completes and the list reloads. Scheduled for a future cleanup pass.
- The two carried-forward moderate `esbuild`/`vite` advisories remain accepted (dev toolchain only, not in production bundle).
