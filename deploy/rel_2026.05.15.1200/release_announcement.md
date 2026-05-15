# Release Announcement — rel_2026.05.15.1200 (v1.0.0)

## What's New

### Email Draft Modal (C03 / C02 UI)
The "Copy email draft" envelope button on the Newsletters page now opens a modal instead of silently copying to the clipboard. The modal presents **4 AI-generated email drafts** in parallel — one per tone — so you can compare and choose before copying:

| Tone | Intended audience |
| :--- | :--- |
| **Professional** | Corporate / general audience |
| **Conversational** | Colleagues, informal distribution |
| **Story-led** | Opens with a concrete hook from the newsletter content |
| **Peer-to-peer** | Practitioner-to-practitioner; assumes shared domain knowledge |

Each card has a **"Copy this"** button. Clicking it copies the full rich-HTML email (ready to paste into any email composer) and confirms with a green "Copied!" state for 2 seconds.

### No-Fabrication Rule — All AI Prompts (C04)
A hard no-fabrication rule has been added to all AI generation prompts. Every fact, name, figure, and claim in generated content must be explicitly present in the source material. This applies equally to newsletter sections and email drafts — including the story-led tone, where creative framing could otherwise introduce invented details.

### Newsletter Card UI (converter.ts)
- **Expand/collapse**: Cards now show a clear "↔ Click to expand" hint when collapsed and a "⇕ Click to collapse" bar at the bottom when open.
- **Reading Guide**: Title now displays `🗺 Reading Guide 🧭` (map + compass icons in SAP gold). Guide items stack vertically with reduced line-height for easier scanning.
- **Card teasers**: Rendered as plain body text — blockquote styling removed.

## Required Actions

**Operators:** No configuration changes, schema migrations, or environment variable additions required. Standard image update via `go.sh` or `kubectl set image`.

**Users:** No action required. The envelope button on published newsletters now opens a modal rather than copying silently — behaviour is self-explanatory.

## Known Limitations

- The 4 AI drafts are generated in a single parallel batch. If the AI service is slow or rate-limited, the modal may take longer to appear than the previous single-draft flow. The spinner remains visible throughout.
- "Three options" in the modal subtitle is stale copy (now 4 options) — cosmetic only, will be corrected in the next patch.
