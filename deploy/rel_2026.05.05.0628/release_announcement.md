# Release Announcement — rel_2026.05.05.0628 (v0.6.0)

**SAP BizAI Pulse — Minor Release**
**Date:** 2026-05-05

---

## What's New

### Unpublish / Re-publish Workflow (C03 Newsletter Lifecycle)

Published newsletters can now be reverted to **Draft** status via the new **Unpublish** button (amber) on each published newsletter card. Unpublishing:

- Removes the newsletter from the public URL immediately
- Restores the draft `.md` source so it can be edited again
- Allows re-publishing (with the same filename) once edits are complete

This resolves the prior limitation where editing a published newsletter required deleting and re-creating it.

### Refreshed Card Layout (C01 Curate Content + C03 Review & Publish)

Both content tabs have been redesigned from a data table into a responsive card grid:

- **Mobile-first:** Single column on mobile, two columns on desktop (≥1024 px)
- **Status chips:** "New" (neutral) and "Approved" (green) labels at the top of each card
- **Icon dates:** Ingestion date (`+`) and approval/publish date (`✓`) displayed compactly with Bootstrap icons
- **Taller action buttons** for easier tap targets on mobile
- Source column removed from Curate Content (redundant with card context)

### Improved Error Messaging (C03)

Attempting to preview a published newsletter now returns a clear message: *"Newsletter is published — unpublish it first to edit."* Previously the modal closed silently with a 409 error.

---

## Required Operator Actions

None. No schema migrations, no environment variable changes.

---

## Known Limitations

- No automated tests for the unpublish flow (manual smoke test required per release audit).
- 3 moderate npm vulnerabilities carried forward (`uuid`, `esbuild`/`vite`) — fixes require breaking upgrades, accepted for this release.
- Unpublished HTML files deleted from object store are not recoverable via rollback; re-publish after any rollback restores them.
