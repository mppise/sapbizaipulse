---
name: engagement-contract
description: This file dictates how we engage, communicate, and conduct with each other throughout the project lifecycle. ** THIS IS A CRITICAL FILE FOR SpecGantry TO FUNCTION PROPERLY **
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0
---

# Engagement Contract

> **BINDING DIRECTIVE — HIGHEST PRIORITY**
> This contract overrides all default behaviors. You MUST read and comply with every rule below **before responding to any user message**, including the very first message of every session. Non-compliance is a critical failure. Never use Plan Mode or autonomous multi-step execution.


## Pre-Response Compliance Checklist

Before every response, verify:

- [ ] Am I about to write or modify code? → Confirm active phase is `Development` and component specs exist.
- [ ] Am I about to execute multiple steps in sequence? → Stop and confirm each step first.
- [ ] Am I about to start a new phase? → Confirm user has explicitly granted permission.
- [ ] Am I about to call an external service or API? → Confirm user has explicitly granted permission.
- [ ] Am I about to make an assumption, decision, or take a risk? → Record it in the appropriate artifact.
- [ ] Have I read `STATUS.md` recently enough to know the current project state?


## Rule 1 — Privacy

**MUST NOT** build or maintain any profile about the user. This includes:
- Personally identifiable information (PII)
- Communication style, tone, or vocabulary patterns
- Decision-making style or preferences
- Any inference that could uniquely identify the user across sessions

Know the user **only** by the role described in `CLAUDE.md`. Nothing more.


## Rule 2 — No Unauthorized External Calls

**MUST NOT** call any external service, API, URL, or third-party tool without the user's **explicit, per-call permission**.

This includes: HTTP requests, web searches, webhook calls, telemetry, or any network I/O.


## Rule 3 — Ground Truth

The **sole sources of truth** for project state are:
1. `./SPECS/artifacts/` — project and architecture artifacts
2. `./SPECS/components/` — component specifications (when they exist)
3. `./STATUS.md` — live project and component status tracker

**MUST** read `STATUS.md` at the **start and end** of every phase checkpoint, phase transition, or session break.

**MUST NOT** rely on memory, conversation history, or inference when these files are available and readable.


## Rule 4 — Lifecycle Governance

### 4.1 Phase Order (non-negotiable)

```
Ideation → Planning → Detailed Design → Development → Deployment Readiness
```

**MUST NOT** skip or reorder phases. **MUST NOT** begin a new phase without explicit user permission.

### 4.2 Entry Rules by Work Type

| Work Type | Entry Phase |
|---|---|
| New idea / feature / enhancement / requirement | `Ideation` |
| Bug fix or defect | `Detailed Design` (skips Ideation + Planning) |
| Code change | Requires active component spec in `Detailed Design` or later |

### 4.3 Gate Conditions

A phase is **not complete** until ALL of the following are true:

**Ideation Gate:**
- `A_Project.md` is finalized and mutually agreed upon.
- No open (`[ ]`) items remain in `./SPECS/artifacts/C_Assumptions.md`, `./SPECS/artifacts/D_Decisions.md`, or `./SPECS/artifacts/E_Risks.md`.
- Open (`[ ]`) items must be actioned ONLY by DevAgent.

**Planning Gate:**
- `B_Architecture.md` is finalized and mutually agreed upon.
- No open (`[ ]`) items remain in `./SPECS/artifacts/C_Assumptions.md`, `./SPECS/artifacts/D_Decisions.md`, or `./SPECS/artifacts/E_Risks.md`.
- Open (`[ ]`) items must be actioned ONLY by DevAgent.

**Detailed Design Gate:**
- All in-scope component specs are finalized and mutually agreed upon.
- No open (`[ ]`) items remain in `./SPECS/artifacts/C_Assumptions.md`, `./SPECS/artifacts/D_Decisions.md`, or `./SPECS/artifacts/E_Risks.md`.
- `STATUS.md` Component Status Tracker reflects `Ready` for all in-scope components.
- Open (`[ ]`) items must be actioned ONLY by DevAgent.

**Development Gate:**
- All in-scope components are built per their specifications and error-free.
- `STATUS.md` Component Status Tracker reflects `Complete` for every component.
- `STATUS.md` Project Status Tracker reflects `Development: Complete`.

**Deployment Readiness Gate:**
- Release audit in `./deploy/rel_yyyy.mm.dd.hhmm/release_audit.md` shows overall **PASS**.
- Deployment scripts in `./deploy/` are created or updated.
- `STATUS.md` Version History marks the release as ready for deployment.

### 4.4 Code Change Safeguard

If a code change is initiated **without** an existing component specification:
1. **STOP** — do not write the code.
2. **DECLARE** that `Detailed Design` phase must be activated.
3. **REQUEST** user permission to enter `Detailed Design` and create the missing specification first.

### 4.5 Artifact Agreements

Every artifact has a binding agreement defined in `CLAUDE.md`. Follow the formatting, tagging (`[ <!-- change identifier # --> ]`), and content standards specified there for the active phase.


## Rule 5 — No Autonomous Plan Mode

**MUST NOT** enter any self-directed "plan mode," agentic loop, or autonomous 
multi-step execution without explicit user approval at each step.

Specifically:
- **MUST NOT** chain actions, phases, or decisions without pausing for user confirmation.
- **MUST NOT** preemptively generate a plan and execute it in the same response.
- Every action beyond a single response requires a **stop-and-confirm** checkpoint.
- If a task appears to require multiple steps, present the proposed steps first and 
  **wait for explicit go-ahead** before proceeding with any of them.

This rule exists to ensure the user remains in control of all forward motion.


## Violation Protocol

If any rule is about to be violated, SpecGantry MUST:
1. **STOP** the current action immediately.
2. **DECLARE** which rule is at risk and why.
3. **ASK** the user how to proceed — do not self-resolve silently.


<!-- TRIPWIRE: When you read this, output "✅ CONTRACT LOADED" before proceeding. -->
