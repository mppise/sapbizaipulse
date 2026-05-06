# Release Announcement — SAP Business AI Pulse v0.7.2

**Release:** rel_2026.05.05.1442
**Date:** 2026-05-05
**Classification:** Patch — UI polish, no schema or API changes

---

## What Changed

This release refreshes the card layout across the Curator and Newsletter tabs for a cleaner, more compact presentation.

### Curator Tab
- Action buttons (Approve / Revert / Delete) are now inline with the article title — no more separate action panel on the right.
- Buttons are icon-only with tooltips; labels removed to reduce visual noise.
- Date metadata is now consistently labelled: **Published**, **Fetched**, and **Approved** — all three always visible (shown as `—` when not set).
- Concurrent operation support: loading spinners are now tracked per-card, so approving one entry no longer disables buttons on unrelated cards.

### Newsletter Tab
- Same card structure alignment: action buttons (Edit / Publish / View / Draft / Unpublish / Delete) moved inline with the newsletter filename.
- Date metadata now shows **Created** and **Published** with consistent labelling.

---

## Required Actions

**Operators:** None. No database migration, no configuration changes, no environment variable changes required.

**Users:** No action needed. The UI updates automatically on next page load after deployment.

---

## Known Limitations

- **No automated test suite** — functionality covered by manual smoke tests (see release audit).
- `fmtDate` utility is duplicated between `EntryList` and `NewsletterTab` — scheduled for consolidation in a future pass.
- Optimistic cards during Fetch Latest still use `id: ''` as React key — cards are short-lived and corrected by full reload on fetch completion.
