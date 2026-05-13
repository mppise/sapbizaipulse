---
name: reverse-engineer
description: Reverse engineers an existing codebase into SpecGantry artifacts and component specifications, bringing a pre-built system into the structured lifecycle framework.
user-invocable: true
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Reverse Engineer

> Wearing the Discovery Analyst hat — I'll dig into what's already been built, document it faithfully in the SpecGantry framework, and surface any improvements worth considering.

## Before Starting

1. Read `./STATUS.md` — note any existing project state.
2. Scan the repository structure to understand what code, configuration, and documentation already exists.
3. Check whether `A_Project.md`, `B_Architecture.md`, or any component specs already exist in `./SPECS/`. If they do, read them first — **enhance and update** rather than overwrite. Preserve any content that is still accurate.

> This process runs **on auto-pilot** — no user input is expected or required during discovery, since DevLead may not know the full details of an already-built system.

> This skill **does not write or modify source code**. All outputs are documentation artifacts only.

## Component Identification Threshold

A **component** is a distinct capability that either: (a) can be developed and deployed independently, or (b) provides a named, reusable service to other parts of the system. Individual classes, utility functions, and helper modules are **not** components — they belong inside a component's spec. When in doubt, lean toward fewer, larger components rather than many small ones.

## Stages

Do not skip or reorder.

### 1. Discover
Deep-dive into the codebase and any available documentation. Populate the following artifacts as laid out in the template, but be also prepared to iterate as you discover more based on what you find:

- `./SPECS/artifacts/A_Project.md` — what is this system, what problem does it solve? 
- `./SPECS/artifacts/B_Architecture.md` — technology stack, components, data flows, deployment model.
- `./SPECS/artifacts/C_Assumptions.md`, `D_Decisions.md`, `E_Risks.md` — anything inferred, implicitly decided, or flagged as a risk in the existing system.

This stage aligns with the Ideation and Planning phases of the lifecycle.

### 2. Design
Translate the discovered information into component specifications. For each functional component identified, create the specification package under `./SPECS/components/<component_name>/` using the same structure as the Detailed Design phase would (`A_Core_Spec.md`, `B_Interfaces.md`, and optionally `C_Specialized_Specs.md`).

This stage aligns with the Detailed Design phase of the lifecycle.

### 3. Challenge
Stress-test the documented architecture across four dimensions:
- **Consistency** — do all components and interfaces agree with each other?
- **Completeness** — are there undocumented behaviors or missing interfaces?
- **Risk** — are there technical debts, security gaps, or fragile dependencies?
- **Simplicity** — is the system more complex than the requirements demand?

Produce **recommendations only** — do not implement any changes.

### 4. Gate Check
Present a summary of all artifacts produced and the Challenge recommendations to DevLead. Confirm mutual agreement before closing the skill. Update `./STATUS.md` to reflect that reverse engineering is complete.

## Output

Generate a structured report at `./REV-ENG/{{ yyyy.mm.dd_hhmm }}.md` using the following sections. Note, SpecGantry will refer to this report in case the DevLead later decides to implement any of the recommendations — it serves as a record of the original state and the rationale behind suggested improvements:

| Section | Contents | Severity | Suggested Action | Status |
|---|---| |---|---|---|---|
| **Executive Summary** | What was discovered, how many components were identified, and the overall health verdict (Clean / Needs Attention / Critical Issues Found) | `SEV-1` / `SEV-2` / `SEV-3` | High-level recommendation for next steps (e.g., "System is generally well-structured but has some security risks that should be addressed in the next iteration") | `Open` / `In Progress` / `Closed` |
| **Artifacts Produced** | Table listing each file created or updated, its path, and a one-line description of what it contains | `SEV-1` / `SEV-2` / `SEV-3` | N/A | `Open` / `In Progress` / `Closed` |
| **Component Map** | List of identified components, their purpose, and any interfaces between them | `SEV-1` / `SEV-2` / `SEV-3` | N/A | `Open` / `In Progress` / `Closed` |
| **Challenge Findings** | One sub-section per dimension (Consistency · Completeness · Risk · Simplicity) — each finding as a bullet with severity (`SEV-1` / `SEV-2` / `SEV-3`) and a recommended action | `SEV-1` / `SEV-2` / `SEV-3` | N/A | `Open` / `In Progress` / `Closed` |
| **Recommendations** | Prioritized list of improvements, numbered, each with a suggested next step | `SEV-1` / `SEV-2` / `SEV-3` | N/A | `Open` / `In Progress` / `Closed` |

Also include a diagram or visual representation of the system architecture if applicable. This can be a simple block diagram showing components and their interactions, or a more detailed flowchart of data and control flows, depending on what best conveys the structure of the system.

## Scope

**Files in scope:** `./SPECS/artifacts/A_Project.md` · `./SPECS/artifacts/B_Architecture.md` · `./SPECS/artifacts/C_Assumptions.md` · `./SPECS/artifacts/D_Decisions.md` · `./SPECS/artifacts/E_Risks.md` · `./SPECS/components/` · `./REV-ENG/`

**Strictly read-only:** All source code files — no code is created or modified.

**Artifact ID format:** `^[ADR]-[a-zA-Z0-9]{8}$`
— `A-` for assumptions · `D-` for decisions · `R-` for risks
