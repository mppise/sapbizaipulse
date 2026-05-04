---
name: plan
description: Drives the planning phase from a complete A_Project.md to a fully defined B_Architecture.md with decisions, assumptions, and risks captured — gating entry into the Detailed Design phase.
user-invocable: true
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Plan

> Switching to the Architect hat — let's translate this validated idea into a technical blueprint that constrains and guides every component design that follows.

## Before Starting

1. Read `./STATUS.md` — confirm Planning is the active phase.
2. Read `./SPECS/artifacts/A_Project.md` as the **source of truth** — do not modify it.
   - Confirm §3.1 contains at least one requirement with a `REQ-NNNN` ID and `Active` status. **STOP** if §3.1 is a freeform list without IDs — ask DevLead to assign requirement IDs before architecture planning begins. Detailed Design depends on these IDs for traceability.
3. Read `./SPECS/artifacts/B_Architecture.md` — note every gap and undefined area.
4. Check `C_Assumptions.md`, `D_Decisions.md`, and `E_Risks.md` for open `[ ]` items — **STOP** if any exist and ask DevLead to resolve them first.

## What Architecture Planning Is For

Architecture decisions are **cross-cutting, constraining, and largely irreversible** — they bind every component that follows. This phase answers: *what are the rules every component must play by?*

Component-specific behavior (thresholds, templates, field-level rules, per-feature flows) is **explicitly deferred** to Detailed Design. If a question can be answered differently per component without breaking the system, it does not belong here.

## Application Architecture Model

An **application** is composed of one or more **components** — high-level capabilities (e.g., Order Management, Secure Login) that may operate independently or as shared services. Each component provides one or more **features** — the specific behaviors exposed to users or other components.

**Agile alignment:**
- **User Stories** capture the "why" behind the software and typically cut across multiple features. They are not formally documented — DevLead provides them as prompts.
- **Epics** group related stories into a sprint-sized outcome. They are also prompt-driven, not formal artifacts.

## Architecture Topic Checklist

`B_Architecture.md` must cover all applicable topics below. Use this as the agenda for the Complete stage — offer DevLead the option to skip any topic that genuinely does not apply.

> ⚠️ **Scope discipline:** For each topic, capture the *pattern, standard, or constraint* that applies system-wide. Do not elaborate component-specific thresholds, templates, or implementation details — mark those explicitly as deferred to Detailed Design.

| Topic | What to define here | What is deferred to Detailed Design |
|---|---|---|
| **Overview & Scope** | What is being built; what is explicitly out of scope | — |
| **Functional Components** | Component names, purposes, and ownership boundaries | Internal feature list, data flows, interface signatures |
| **Technical Stack** | Languages, frameworks, runtimes, major libraries per layer | Per-component deviations, version pinning rationale |
| **AI Technologies** | LLM/embedding model choices, vector DB, MCP server usage | Prompt design, model parameters, fallback behavior |
| **Interface Surfaces & Key Flows** | Which surfaces exist (web, mobile, CLI, API); flow names and entry/exit points only | Screen-level UX, component library choices, design tokens |
| **Data Architecture** | Core entities and relationships; storage engine per type; component data ownership | Retention periods, archival pipelines, field-level schemas |
| **API Patterns** | Client↔backend pattern; service↔service pattern; versioning strategy | Request/response envelope shape, rate limit values, pagination |
| **Error Handling Pattern** | Chosen resilience pattern (e.g., circuit breaker + exponential backoff) system-wide | Per-component retry counts, thresholds, fallback specifics |
| **Security Model** | Auth mechanism and provider; authz model (RBAC/ABAC); encryption standards | Per-endpoint validation rules, per-field encryption, threat surface detail |
| **Applicable Regulations** | Which regulations apply and what obligations they trigger | PII inventory, data subject rights mechanisms, vendor DPAs |
| **Observability Standards** | Log format and required fields; tracing standard; centralized sink | SLO targets per component, alert thresholds, dashboard design |
| **Deployment Topology** | Environments; hosting platform; component-to-platform mapping; CI/CD tool | Health check implementation, rollback specifics, deploy ordering |
| **Scalability** | System-wide load profile (RPS, users, data volume at launch and 10×); default scaling model (horizontal vs. vertical) | Per-component bottleneck analysis, caching/sharding specifics, AI latency mitigations |
| **Development Standards** | Naming conventions, folder structure, branching strategy, commit format, linting tools, testing requirements, Definition of Done | Per-component test fixtures, framework-specific patterns |

## Stages

Do not skip or reorder.

### 1. Assess
Using `A_Project.md` as anchor, evaluate `B_Architecture.md` against the topic checklist above. Build a gap list — identify every topic that is missing, incomplete, or over-specified before writing anything. Flag any section that contains component-level detail that should be moved to Detailed Design.

### 2. Complete
Work through each gap topic with targeted questions. One topic at a time; wait for DevLead's answer before moving on. Do not invent responses. If an answer is vague, follow up until it is specific enough to document. Offer DevLead the option to skip topics that genuinely do not apply to the project.

**Guard rail:** After drafting each topic, ask: *"Does this decision bind every component, or just one?"* If the latter, note it as deferred and move on. Update `B_Architecture.md` continuously as decisions are confirmed. Log all assumptions, decisions, and risks in the appropriate artifacts.

### 3. Challenge
Independently stress-test the completed architecture across four dimensions:
- **Consistency** — do all architectural choices align with each other and with `A_Project.md`?
- **Completeness** — are all applicable topics in the checklist addressed?
- **Risk** — are there unaddressed technical or operational risks at the system level?
- **Simplicity** — is the architecture as lean as it can be without sacrificing requirements?

For each finding: log it in the appropriate artifact (C/D/E), then **STOP** if it is a blocker — do not continue until DevLead acknowledges and resolves it.

### 4. Gate Check
- Confirm no open `[ ]` items remain in C, D, or E artifacts.
- Confirm `B_Architecture.md` contains no component-specific thresholds, templates, or implementation details — these must be explicitly marked as deferred.
- Confirm mutual agreement with DevLead that `B_Architecture.md` is complete as an architectural contract.
- Update `./STATUS.md`.

## Scope

**Files in scope:** `./SPECS/artifacts/B_Architecture.md` · `./SPECS/artifacts/C_Assumptions.md` · `./SPECS/artifacts/D_Decisions.md` · `./SPECS/artifacts/E_Risks.md`

**Artifact ID format:** `^[ADR]-[A-Z]{2,12}-[a-zA-Z0-9]{8}$`
— `A-[CATEGORY]-` for assumptions · `D-[CATEGORY]-` for decisions · `R-[CATEGORY]-` for risks
— Category codes match the section headers in C/D/E artifacts (e.g. `A-BP-`, `D-ARCH-`, `R-TC-`)