# Release Announcement — v0.7.2 (rel_2026.05.05.1556)

**Release type:** Patch
**Date:** 2026-05-05
**Audience:** Internal / Operators

---

## What Changed

This patch improves the readability of topic cards in the generated HTML newsletter page.

**Newsletter topic card typography improvements (`C03 Newsletter Lifecycle`):**
- Font sizes across all topic card elements increased by 25% for better readability at typical screen sizes
- Line height for body paragraphs increased to 2.2 for improved reading comfort
- Paragraph and list item spacing increased to give content more breathing room
- Blockquote padding increased proportionally

No changes to the header, sidebar, footer, or any other page element outside of individual topic cards.

---

## Who Is Affected

- **Readers of published newsletters** — newly published newsletters will reflect the updated typography. Previously published newsletters are not retroactively affected (CSS is embedded at publish time).
- **Operators** — no action required. No schema changes, no configuration changes.

---

## Required Actions

None. Deploy and publish a new newsletter to see the updated styles.

---

## Known Limitations

- Previously published newsletter HTML files retain the old font sizes. Re-publish to apply the new styles.
- Typography values are currently inlined as CSS literals; a future release may introduce CSS custom properties for easier tuning.
