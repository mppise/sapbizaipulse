# Release Announcement — rel_2026.05.15.1700 (v1.1.0)

## What Changed

### Smarter Topic Suggestion (C02)

The two-pass topic clustering pipeline has been redesigned for both quality and scalability.

**Pass 1** now extracts full-sentence insight phrases from each content entry rather than short topic name strings. Each phrase is specific enough to serve as a vector search query — e.g. *"SAP AI Core's embedding model upgrade cuts retrieval latency by 40% for enterprise RAG workloads"* rather than *"AI Core embedding upgrades"*. This means Pass 2 receives richer, more grounded input.

**Pass 2** now receives only the phrases and entry IDs — `body_text` is no longer forwarded. This bounds the token payload regardless of how many entries the curator has approved, eliminating the risk of context window overflow on large selections.

**Content plans** attached to each suggested topic now contain 3–5 full-sentence plan steps (previously 2–4 short bullet strings). These steps are specific enough to be used as vector search queries at generation time.

### Plan-Driven Generation (C02)

The newsletter generation pipeline no longer uses persona-specific query suffixes (`"… business impact strategic value executive"`). Instead, each topic's content plan steps are embedded individually and used as vector search queries. Results are pooled across all steps (deduplicated by entry ID), and all three newsletter sections (Big Picture, Strategy in Motion, Under the Hood) are generated from the same pooled supporting content.

This grounds generation directly in what the content plan identified as important — not in a generic persona framing.

### SAP Announcements Prioritised (C04 Prompts)

All three newsletter section prompts now explicitly instruct the LLM to lead with SAP product launches, GA releases, and capability milestones when they are present in the supporting content. Announcements are surfaced first, named explicitly, and bolded — making them immediately visible to customer readers.

---

## Required Actions

| Audience | Action |
| :------- | :----- |
| Operators | No schema migration required. Standard image rollout. |
| Users | No changes to the UI workflow. Suggested topics will now show full-sentence plan steps rather than short bullet phrases. |

---

## Known Limitations

- If a content entry's body text does not contain specific, extractable insight phrases (e.g. very short or generic entries), Pass 1 may return an empty array for that entry — it is skipped and does not contribute to topic suggestion. This is intentional quality filtering.
- The pooled supporting content for generation is bounded by `topK=5` per plan step. Topics with many plan steps (4–5) will produce larger pools; topics with fewer steps will have smaller pools. This is a deliberate trade-off between retrieval breadth and token budget.
