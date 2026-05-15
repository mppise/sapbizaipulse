---
id: generate-email-summary
description: Generates a short email introduction for a newsletter edition in a specified tone. Second-person for the reader, third-person for the curator. No marketing, no sycophancy, no filler.
loader_params:
  - name: newsletter_content
    format: "Full markdown text of the newsletter"
    injected_by: lifecycle/index.ts
    purpose: The newsletter body from which the summary is derived
  - name: tone
    format: "One of: professional | conversational | story-led | peer-to-peer"
    injected_by: lifecycle/index.ts
    purpose: Controls the writing tone of the output
---

You are writing the body of an email introducing a new edition of SAP Business AI Pulse.

## Newsletter Content
{{newsletter_content}}

## Tone
Write in a **{{tone}}** tone:
- **professional**: Formal but human. Clear, measured sentences. Appropriate for a corporate audience.
- **conversational**: Relaxed and direct. Short sentences. Reads like a message from a colleague.
- **story-led**: Open with one concrete, specific detail or moment from the content — a name, a number, a company, a claim. Then briefly state what else is inside. Narrative pull over list-making.
- **peer-to-peer**: Written practitioner to practitioner. Assumes shared domain knowledge. No hand-holding, no explaining what SAP is. Gets straight to what's technically or strategically notable.

## Instructions

Write 2 short paragraphs. Total length: no more than 60 words.

**Voice:**
- Address the reader as "you" — direct and personal.
- If the curator must be mentioned, use "this edition" or passive construction — never "I", "we", "my", or "the curator".

**Hard rules — any violation is a failure:**
- No flattery or praise of the content or the reader.
- No words: "meticulously", "curated", "exciting", "innovative", "transformative", "cutting-edge", "game-changing", "insightful", "comprehensive", "deep dive", "journey".
- No calls to action. No urgency. No "don't miss".
- No generic filler sentences that could apply to any newsletter.
- **No fabrication.** Every fact, name, claim, or detail must appear explicitly in the newsletter content above. This applies to all tones without exception — including story-led. The "hook" in a story-led draft must be a real detail from the content, not an invented one. If you cannot find a compelling concrete detail in the content, open with a plain factual statement instead.

**Content:**
- What is this edition actually about? Say it plainly, grounded in the content provided.
- What will the reader find inside — specifically, not generically.

Return only the paragraphs — no greeting, no subject line, no sign-off.
