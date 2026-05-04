---
name: detailed-design
argument-hint: functional_component_name
description: Drives the detailed design phase for one component identified in the architecture planning phase.
user-invocable: true
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Detailed Design

> Putting on the Technical Designer hat — let's turn the architecture into a specification precise enough to build from, maintain, and trace back to requirements.

## Scoped Component

This design session covers: **{{ functional_component_name }}**

## Before Starting

1. Read `./STATUS.md` — confirm Detailed Design is the active phase.
2. Read `./SPECS/artifacts/A_Project.md`:
   - Confirm §3.1 has `REQ-NNNN` IDs for all active requirements. **STOP** if IDs are missing — Detailed Design cannot proceed without them.
   - Read §3.3 Traceability Index to understand which requirements are already covered by previously designed components and which remain unaddressed.
3. Read `./SPECS/artifacts/B_Architecture.md` — the **mandatory anchor** for all design decisions. Note every section marked 🔽 **Deferred to Detailed Design** — those are required inputs for this session, not optional.
4. Read all other files in `./SPECS/artifacts/` for full project context.
5. Check `C_Assumptions.md`, `D_Decisions.md`, and `E_Risks.md` for open `[ ]` items — **STOP** if any exist and ask DevLead to resolve them before proceeding.
6. If `B_Architecture.md` does not contain sufficient definition of `{{ functional_component_name }}` to begin design, **STOP** and ask DevLead to clarify the component's purpose and boundaries first.

## What Detailed Design Is For

This phase owns everything that is component-specific, implementation-precise, and was explicitly deferred by the architecture. The architecture set the rules; this session plays by them while making every remaining decision needed to build and operate this component.

**You must resolve all deferred items from `B_Architecture.md` that apply to this component.** Do not skip them because they are unfamiliar — they represent open obligations from the planning phase.

## Specification Package

Create the following files under `./SPECS/components/{{ functional_component_name }}/`:

| File | Contents | Required |
|---|---|---|
| `A_Core_Spec.md` | Purpose, Features table, Dependencies, Data flows, Execution mode | Always |
| `B_Interfaces.md` | Exposed APIs & signatures, request/response envelope, pagination, error response format, rate limits, events produced & consumed | Always |
| `C_Operational_Specs.md` | All deferred items from architecture that apply to this component | Always |
| `README.md` | Dev-time reading order and file authority rules for this component | Always |

### A_Core_Spec.md Format

**Features table columns:**

| Column | Format |
|---|---|
| Status | Feature Status value (see below) |
| ID | `<C-ID>-F<NN>` e.g. `C01-F01` |
| Description | One sentence: what the feature does, not how |
| Priority | `P1` Critical · `P2` High · `P3` Medium · `P4` Low |
| Req Ref | ID(s) from `A_Project.md` this feature satisfies — e.g. `REQ-0004, REQ-0007` |
| Doc Level | Doc Level value (see below) — UI features only; `-` for backend/service |

**Data flows:** Use a simple linear notation per flow:
`Input → [Step] → [Step] → Output` — one line per flow. Call out async steps, AI calls, and external service calls explicitly.

**Execution mode:** State whether this component runs as a request-driven service, a background job, an event consumer, or a combination. Specify trigger and lifecycle.

### B_Interfaces.md Format

**Exposed APIs:** For each endpoint:
```
METHOD /path/to/endpoint
Auth: <required role or "public">
Request:  { field: type, field: type }
Response: { field: type, field: type }
Errors:   { code: HTTP status, condition: description }
```

**Events produced/consumed:** For each event:
```
Event: <EventName>
Schema: { field: type, field: type }
Produced by: <feature ID>  |  Consumed by: <feature ID>
```

**Standard envelope:** All responses follow the system-wide envelope defined in `B_Architecture.md §7`. Document deviations explicitly.

### C_Operational_Specs.md Checklist

Work through each item. If it does not apply to this component, state why explicitly — do not leave it blank.

| Topic | What to specify here | Format |
|---|---|---|
| **Error handling** | Retry counts, backoff durations, circuit breaker thresholds, fallback behavior, per-feature degradation modes | Table: `Feature · Error class · Retries · Backoff · Fallback` |
| **UX detail** | Screen/flow-level UX, design system implementation, responsive behavior, accessibility, performance budgets | Step-by-step flow per feature; table for performance budgets |
| **Data specifics** | Field-level schemas, retention periods, archival/deletion pipelines, PII handling | Table: `Field · Type · Nullable · Validation · PII? · Retention` |
| **Security detail** | Per-endpoint validation rules, field-level encryption, XSS/injection controls, file upload handling, threat surface | Table per endpoint; prose for threat surface |
| **Compliance obligations** | PII inventory, lawful basis, consent implementation, data subject rights, vendor DPA/BAA status | Table: `Data element · Basis · Consent captured? · Rights mechanism` |
| **Observability** | SLO targets, alert thresholds, on-call owner, dashboards, key analytics events | Table: `Signal · SLI · SLO target · Alert threshold · Owner` |
| **Infrastructure** | Health check endpoint/logic, env var names (not values), secrets injection, deploy ordering | Prose + env var table: `Name · Purpose · Source` |
| **AI behavior** | Prompt file path, model parameters, streaming behavior, confidence indicators, failure fallbacks | One block per AI-enabled feature |
| **Testing** | Coverage thresholds, critical paths, test data/fixtures strategy | Table: `Type · Threshold · Critical paths · Fixture approach` |
| **Notifications** | Triggers, template file paths, per-channel failure handling, opt-out mechanics | Table: `Trigger · Channel · Template · Failure mode · Opt-out` |
| **Scalability** | Component-specific bottlenecks, mitigation strategies (caching, sharding, queuing), AI latency approach | Table: `Bottleneck · Mitigation · Owner` |

### README.md Format

This file is the entry point for any developer or AI agent building this component. It must contain:

```markdown
# <Component Name> — Spec Reading Guide

## Reading Order
1. `../../artifacts/B_Architecture.md` — system constraints (mandatory first)
2. `A_Core_Spec.md` — what to build and why
3. `B_Interfaces.md` — exact contracts to implement
4. `C_Operational_Specs.md` — operational requirements

## Authority Rules
- If A_Core_Spec and B_Interfaces conflict: B_Interfaces wins for signatures; A_Core_Spec wins for behavior.
- If any spec conflicts with B_Architecture.md: stop and raise with DevLead before proceeding.
- Do not infer missing details — raise as a spec gap.

## Spec Version
Last updated: <date> | Status: <phase status>
```

## Doc Level Values

*(Used in the Doc Level column of the Features table — applies to UI-facing features only; set to `-` for backend, service, or non-UI features)*

| Value | When to use |
|---|---|
| `Page` | The feature IS the page or view — the user navigates to it as a distinct route |
| `Component` | The feature is a form, table, modal, wizard, or widget embedded within a page |
| `Concept` | The feature introduces a term, setting, or behavior that needs definition rather than step-by-step instructions |

## Feature Status Values

*(Used in the Status column of the Features table across all lifecycle phases)*

| Value | Meaning |
|---|---|
| `Not Started` | Feature is identified but no work has begun |
| `In Design` | Feature is actively being specified (Detailed Design phase) |
| `Ready` | Specification is complete and approved — ready for development |
| `In Progress` | Feature is actively being implemented (Development phase) |
| `Complete` | Implementation is done, tests pass, Definition of Done satisfied |
| `Blocked` | Work cannot proceed — an open item must be resolved first |
| `Revised` | Spec has been updated after development began — implementation must be re-verified |

## Spec Update Protocol

When a requirement changes **after** a feature has moved to `In Progress` or `Complete`:

1. Update the affected spec file(s).
2. Change the Feature Status to `Revised`.
3. Add a dated note directly in the spec at the changed section: `> ⚠️ Revised <date>: <what changed and why>`
4. Update `A_Project.md §3.1` — if the requirement itself changed, update its row. If it was removed or deferred, change its `Status` to `Removed` or `Deferred` — never delete the row or reuse the ID.
5. Update `A_Project.md §3.3` (Traceability Index) — reflect the revised coverage status for any affected `REQ-NNNN` rows.
6. Log a risk or decision entry in `D_Decisions.md` or `E_Risks.md` if the change has architectural implications.
7. Notify DevLead — do not silently update specs that are already being built from.

A feature may not return to `Complete` until the implementation has been re-verified against the revised spec.

## Stages

Do not skip or reorder.

### 1. Assess
Using `B_Architecture.md` as anchor, review all project knowledge in `./SPECS/artifacts/`. Identify:
- What is already defined for this component at the architecture level.
- Which 🔽 deferred items from `B_Architecture.md` apply to this component and must be resolved here.
- What must be elaborated that was not addressed at all in the architecture.
- Any new assumptions, risks, or open questions before writing any spec files.

### 2. Complete
Create the specification package. Work through deferred items systematically — they are first-class work, not an afterthought. Use the format guidance above for each file. Ensure every feature has a `Req Ref` linking it back to `A_Project.md`. Ensure every spec is traceable to the architecture, maintainable by both technical and functional team members, and unambiguous.

As new assumptions, decisions, or risks surface, log them immediately in the appropriate artifact and **STOP** — do not proceed until DevLead acknowledges them.

### 3. Challenge
Independently stress-test the completed component spec across four dimensions:

- **Architectural compliance** — does every decision in this spec respect the constraints in `B_Architecture.md`? Flag any deviation.
- **Completeness** — is every feature specified to the point where a developer can build it without asking a question? Are edge cases (nulls, boundaries, failures, concurrent access) addressed?
- **Interface integrity** — are all events, APIs, and data contracts in `B_Interfaces.md` sufficient for every consuming component listed in `B_Architecture.md §1.2`? Are there any mismatches with what those components say they consume?
- **Operational readiness** — does `C_Operational_Specs.md` cover every item in the checklist with enough specificity to operate this component in production?

For each finding: log it in the appropriate artifact (C/D/E) and surface it to DevLead. **STOP** on blockers — do not proceed to Gate Check until resolved.

### 4. Gate Check
- Confirm every applicable deferred item from `B_Architecture.md` is resolved in `C_Operational_Specs.md`, or explicitly marked as not applicable with rationale.
- Confirm every feature has a `Req Ref` entry pointing to a valid `REQ-NNNN` ID in `A_Project.md §3.1`.
- Confirm `B_Interfaces.md` has been cross-checked against the consuming components identified in `B_Architecture.md §1.2`.
- Confirm `README.md` is complete and accurate.
- Confirm mutual agreement with DevLead that all specification files are complete.
- **Update `./SPECS/artifacts/A_Project.md §3.3` (Traceability Index):** For every `REQ-NNNN` referenced in this component's features, add or update the corresponding row:
  - Add the feature IDs (e.g., `C01-F01, C01-F02`) to the `Implementing features` column.
  - Set `Status` to `Fully covered` if all aspects of the requirement are addressed, `Partially covered` if other components will also contribute, or `Not yet designed` if no component covers it yet.
  - Requirements in §3.1 that have no entry in the Traceability Index after all components reach `Ready` are a coverage gap — surface to DevLead.
- Update the Component Status Tracker in `./STATUS.md` to `Ready` for `{{ functional_component_name }}`.

## Scope

**Files in scope:** `./SPECS/components/{{ functional_component_name }}/A_Core_Spec.md` · `./SPECS/components/{{ functional_component_name }}/B_Interfaces.md` · `./SPECS/components/{{ functional_component_name }}/C_Operational_Specs.md` · `./SPECS/components/{{ functional_component_name }}/README.md` · `./SPECS/artifacts/A_Project.md` (§3.3 Traceability Index only) · `./SPECS/artifacts/C_Assumptions.md` · `./SPECS/artifacts/D_Decisions.md` · `./SPECS/artifacts/E_Risks.md`

**STATUS.md:** Update only the row for `{{ functional_component_name }}` — do not touch other component rows.

**Artifact ID format:** `^[ADR]-[A-Z]{2,12}-[a-zA-Z0-9]{8}$`
— `A-[CATEGORY]-` for assumptions · `D-[CATEGORY]-` for decisions · `R-[CATEGORY]-` for risks
— Category codes match the section headers in C/D/E artifacts (e.g. `A-BP-`, `D-ARCH-`, `R-TC-`)