# Release Announcement — v0.8.0 (rel_2026.05.12.2145)

**Date:** 2026-05-12
**Classification:** Minor release
**Audience:** Operators and newsletter authors

---

## What's New

### Reading Guide in Published Newsletters
Published newsletters now open with a **Reading Guide** section above the topic list. It describes the newsletter's purpose — to educate, not advise — and introduces the three reading depths (The Big Picture, Strategy in Motion, Under the Hood) using color-coded tab chips that mirror the actual tabs readers will encounter inside each topic. The guide is styled as a warm yellow notice box to draw attention without disrupting the reading flow.

### Improved LLM Section Quality
The **Strategy in Motion** and **Under the Hood** tab prompts have been updated to remove the short summary blockquote that previously appeared at the top of those sections. Each section now opens directly with its structural sub-heading (`#### What SAP Has Delivered` and `#### How It Works` respectively). This produces cleaner, more focused content — the executive summary tab retains its blockquote, which continues to serve as the topic teaser shown in the collapsed card.

The Under the Hood prompt persona has also been aligned to the same journalist framing used across all sections, improving consistency of tone.

### Suggest Topics Bug Fix
A missing prompt file (`extract-topics.md`) caused the suggest topics flow to silently skip all entries during Pass 1, resulting in an empty topic suggestion list. The build script now copies all prompt `.md` files to `dist/ai/prompts/` after compilation. This fix is transparent to users — the Suggest button now works correctly.

### Unapprove Content Entries
Curators can now revert a **Newsletter-ready** entry back to **Internal** directly from the entry card. This is useful when an entry was approved in error or needs to be withheld from the next generation run.

---

## Required Actions

| Audience | Action |
| :------- | :----- |
| Operators | Redeploy using `./deploy/go.sh --env prod` — the prompt file fix requires the new image |
| Authors | No action required — existing draft newsletters are unaffected; reading guide appears on next publish |
| Curators | No action required — unapprove button is available immediately after deployment |

---

## Known Limitations

- Previously published newsletters do not include the Reading Guide — it is only embedded at publish time. Republishing (unpublish → re-publish) will add the guide to an existing newsletter.
- `npm audit` reports 1 high and 2 moderate vulnerabilities in dev-only dependencies (`fast-xml-builder`, `esbuild` via `vite`) — these do not affect the production runtime and are accepted for this release.
