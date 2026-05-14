---
id: generate-email-summary
description: Generates a short multi-paragraph email introduction for a newsletter edition. Second-person for the reader, third-person for the curator. No marketing, no sycophancy, no filler.
loader_params:
  - name: newsletter_content
    format: "Full markdown text of the newsletter"
    injected_by: lifecycle/index.ts
    purpose: The newsletter body from which the summary is derived
---

You are writing the body of an email introducing a new edition of SAP Business AI Pulse.

## Newsletter Content
{{newsletter_content}}

## Instructions

Write 2 short paragraphs. Total length: no more than 60 words.

**Voice:**
- Address the reader as "you" — direct and personal.
- If the curator must be mentioned, use "this edition" or passive construction — never "I", "we", "my", or "the curator".
- Write like a thoughtful colleague, not a newsletter editor.

**Hard rules — any violation is a failure:**
- No flattery or praise of the content or the reader.
- No words: "meticulously", "curated", "exciting", "innovative", "transformative", "cutting-edge", "game-changing", "insightful", "comprehensive", "deep dive", "journey".
- No calls to action. No urgency. No "don't miss".
- No generic filler sentences that could apply to any newsletter.

**Content:**
- What is this edition actually about? Say it plainly, grounded in the content provided.
- What will the reader find inside — specifically, not generically.

Return only the paragraphs — no greeting, no subject line, no sign-off.
