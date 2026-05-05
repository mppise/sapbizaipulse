# Release Announcement — rel_2026.05.05.1500 (v0.7.0)

**SAP Business AI Pulse — Internal Platform**
**Release date:** 2026-05-05

---

## What's New

### Content Curator — UX & Workflow Improvements

- **Revert button** (formerly Unapprove): Approved entries can now be reverted to draft state. The entry's body text is preserved — re-approving does not require re-uploading the PDF or re-fetching the URL.
- **Smarter approve workflow**: PDF entries are approved by synthesizing from their stored body text and generating an embedding — no re-fetch required. URL/auto-fetch entries continue to fetch fresh content, synthesize, and embed.
- **Article published date on cards**: Each content entry card now shows the article's published date (scraped for web entries, upload timestamp for PDFs) as the primary date field.
- **No more scroll resets**: Approving, reverting, and deleting entries updates the card in place — the page no longer reloads, preserving your scroll position.
- **PDF upload**: Extract Text button now only appears after a file is selected. Button is in the footer alongside Cancel for a cleaner flow.
- **Suggest Topics button**: Moved to the sub-header bar (same pattern as Fetch Latest / Upload PDF).

### Newsletter Generator — UX Improvements

- **Generate Newsletter button**: Moved to the sub-header alongside Suggest Topics. Uses a distinct purple colour to differentiate from the green Suggest Topics button.
- **No more scroll resets**: Publishing, unpublishing, and deleting newsletters updates the list in place.

---

## Required Operator Actions

> ⚠️ **Schema migration required before deployment.**

Run the following on HANA Cloud before deploying this release:

```sql
ALTER TABLE content_entries ADD (published_date TIMESTAMP);
```

Existing entries will have `published_date = NULL` after migration — this is expected. New entries ingested after deployment will populate the field.

---

## Known Limitations

- Existing entries ingested before this release will not have a published date — their cards will show no date chip until re-ingested or manually updated.
- The inline mapper in `vectorSearch.ts` duplicates field mapping logic from `contentEntries.ts` — tracked for future refactor.
