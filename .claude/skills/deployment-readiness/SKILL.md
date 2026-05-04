---
name: deployment-readiness
description: Produces a consolidated release readiness audit and a self-contained deployment engine (go.sh) to gate entry into the Deployment phase.
user-invocable: true
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Deployment Readiness

> Stepping into the Release Manager role — let's make sure this release is technically sound, clearly communicated, and safe to ship.

This skill **does not** perform the actual release. It produces the audit, announcement, and deployment script for DevLead to review before triggering deployment.

## Before Starting

1. Read `./STATUS.md` — confirm `Development: Complete` is recorded.
2. Determine the release timestamp using the current date and time: `yyyy.mm.dd.hhmm`.
3. Check `./deploy/` for a prior readiness run — if one exists, carry forward any resolved items.

> **Read-only for source and specs.** `./src/` and all files under `./SPECS/` must not be modified during this phase.

## Stages

Do not skip or reorder. All outputs go to `./deploy/rel_{{ yyyy.mm.dd.hhmm }}/` unless noted otherwise.

### 1. Release Audit (`release_audit.md`)

Produce a single audit document. The header must display a clear **PASS** or **FAIL** verdict.

**A. Scope & Changes**
A table of components included in this release: Name, Status (New/Updated), and a concise summary of features and fixes. Source from `./STATUS.md`.

**B. Technical Audit**
Zero-trust review of the source code and specs **for components in this release only** — focus on all files in `./src/` that implement them. Categorize findings by severity:
- **SEV-1** — blocks release (data loss, security breach, crash)
- **SEV-2** — blocks release (significant functional defect)
- **SEV-3** — non-blocking (maintainability, minor issues)

Categories: Syntax · Architecture · Security · Maintainability · Test Coverage · Dependencies

Format per finding: `* [X] **[Category/Component]** Impact description` (X = passed, blank = failed)

**C. Risk & Recovery**
- Smoke Test Plan: top 3–5 critical user flows and system health checks to verify after deployment.
- Rollback Plan: trigger mechanism, database reversibility, and estimated recovery time.

> If any SEV-1 or SEV-2 blocker is found: mark as **FAIL** and stop here — do not proceed to stages 2 or 3.

### 2. Release Announcement (`release_announcement.md`)

Draft an internal/external announcement covering: what changed, any required actions by users or operators, and known limitations.

### 3. Deployment Engine (`go.sh`)

Create `./deploy/go.sh` — a self-contained deployment script requiring no external config files.

Required capabilities:
- **Environment checks**: Docker daemon, registry auth, required CLI tools, network connectivity.
- **Multi-environment support**: `--env test` and `--env prod` flags.
- **Build/push/deploy pattern**: containerized workflow targeting a cloud environment. If the project uses a non-containerized deployment model (as defined in `B_Architecture.md`), adapt this pattern accordingly and note the deviation in the script header.
- **Test mode**: `--env test` runs until the app is accessible (with port patching for immediate verification).
- **Robustness**: comprehensive error handling and step-level logging throughout.

### 4. Governance Update

Once audit is **PASS** and `go.sh` is ready:
- Update the Project Status Tracker in `./STATUS.md` to mark the Deployment phase as complete.
- Add an entry to the Version History in `./STATUS.md` marking the release as `[X] Active` (Ready to Deploy).

## Scope

**Files in scope:** `./deploy/rel_{{ yyyy.mm.dd.hhmm }}/release_audit.md` · `./deploy/rel_{{ yyyy.mm.dd.hhmm }}/release_announcement.md` · `./deploy/go.sh` · `./STATUS.md`

**Strictly read-only:** `./src/` · `./SPECS/`
