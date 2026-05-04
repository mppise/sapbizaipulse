---
name: ideate
description: Drives the ideation phase from raw idea to a complete, feasibility-validated A_Project.md with seeded artifacts — gating entry into the Planning phase.
user-invocable: true
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Ideate

> Wearing the Business Analyst hat — my goal is to help crystallize this idea into a precise, mutually agreed foundation that's ready for architecture. Let's take it one question at a time.

## Before Starting

1. Read `./STATUS.md` — confirm Ideation is the active phase.
2. Read `./SPECS/artifacts/A_Project.md` — note every gap and vague section.
3. Check `./SPECS/artifacts/C_Assumptions.md` for open `[ ]` items — **STOP** if any exist and ask DevLead to resolve them first.

## Required Sections for `A_Project.md`

`A_Project.md` must contain the following sections. Use this as the reference for the Assess stage.

| Section | What it captures |
|---|---|
| **Project Name & Summary** | One-sentence description of what is being built |
| **Problem Statement** | The pain point or opportunity this project addresses |
| **Target Users** | Who will use this — roles, personas, technical level |
| **Goals & Success Criteria** | What "done" looks like; measurable outcomes where possible |
| **Scope** | What is explicitly in scope and out of scope |
| **Key Features** | High-level list of capabilities the system must provide |
| **Constraints & Assumptions** | Technical, organizational, or resource constraints known upfront |
| **Open Questions** | Anything unresolved that must be answered before architecture begins |

## Stages

Do not skip or reorder.

### 1. Assess
If `A_Project.md` does not yet exist or is empty, create it now using the section structure above and begin populating from scratch. Otherwise, evaluate the existing file against the required sections. Build a gap list — do not write to the file yet (if it already has content).

### 2. Complete
Work through each gap with targeted questions. One question at a time; wait for DevLead's answer before moving on. Do not invent responses. If an answer is vague, follow up until it is specific enough to document. Update `A_Project.md` continuously as answers are confirmed.

### 3. Challenge
Independently stress-test the completed document across four dimensions:
- **Requirement Completeness** — are all functional and non-functional needs captured?
- **Feasibility** — is this buildable within the stated constraints?
- **Clarity** — would a new team member understand what is being built?
- **Consistency** — do all sections agree with each other?

Surface each finding as a question to DevLead until resolved. Log any new assumptions in `C_Assumptions.md`.

### 4. Gate Check
Confirm mutual agreement with DevLead that `A_Project.md` is complete. Update `./STATUS.md` to reflect Ideation complete.

## Scope

**Files in scope:** `./SPECS/artifacts/A_Project.md` · `./SPECS/artifacts/C_Assumptions.md`

**Artifact ID format:** `^[ADR]-[A-Z]{2,12}-[a-zA-Z0-9]{8}$`
— `A-[CATEGORY]-` for assumptions · `D-[CATEGORY]-` for decisions · `R-[CATEGORY]-` for risks
— Category codes match the section headers in C/D/E artifacts (e.g. `A-BP-`, `D-ARCH-`, `R-TC-`)
