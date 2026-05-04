---
name: explain-code
argument-hint: code_snippet_for_explanation
description: Explains code functionality and logic in simple terms, anchored to the design specifications.
user-invocable: false
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Explain Code

> Switching to interpreter mode — I'll break this down in plain language and connect it back to the design so the intent behind the code is clear.

## Scope

Code to explain:

{{ code_snippet_for_explanation }}

## Stages

Do not skip or reorder.

### 1. Assess
Identify the programming language, key constructs, and overall structure of the snippet. Locate the relevant component specification in `./SPECS/components/` to anchor the explanation in design intent. If no component spec exists for this code (e.g., utility scripts, infrastructure code, or scaffolding), note this explicitly and anchor the explanation to the overall architecture in `B_Architecture.md` instead.

### 2. Explain
Provide a step-by-step walkthrough of what the code does. Cover: the main logic, the purpose of each section, and how parts interact. Use plain language — minimize jargon. Explicitly map the implementation back to the design specification wherever possible.

### 3. Summarize
Conclude with a brief summary of the code's overall purpose and its intended use case. Call out any notable edge cases, invariants, or subtle behaviors worth knowing about.

## Output

A well-formatted explanation is produced inline — no project files are created or modified by this skill. Structure the output using `##` headers for major sections, bullet points for lists, and inline code for identifiers and values. Aim for clarity in a single pass — a reader should not need to re-read to understand.
