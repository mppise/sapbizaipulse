---
name: develop
argument-hint: functional_component_name
description: Drives the development phase by implementing features against component specifications, maintaining artifacts, and keeping the build clean — gating exit via the deployment-readiness skill.
user-invocable: true
author: Mangesh Pise <mppise@gmail.com>
license: Apache-2.0 (see LICENSE in project root)
---

# Develop

> Developer hat on — let's bring this spec to life with clean, traceable code that a human or an AI agent can understand, maintain, and build upon.

## Scoped Component

This development session covers: **{{ functional_component_name }}**

## Before Starting

1. Read `./STATUS.md` — confirm Development is the active phase and `{{ functional_component_name }}` shows `Ready`.
2. Read `./SPECS/artifacts/B_Architecture.md` — the **mandatory anchor** for all implementation decisions.
3. Read all specification files in `./SPECS/components/{{ functional_component_name }}/`.
4. Check `C_Assumptions.md`, `D_Decisions.md`, and `E_Risks.md` for open `[ ]` items — **STOP** if any exist and ask DevLead to resolve them first.

## Stages

Do not skip or reorder.

### 1. Assess
Review the architecture and component specifications. Confirm the build order, dependencies, and environment requirements. Identify any gaps or conflicts before writing any code.

### 2. Implement
Implement features per specification. Write code that is clean, modular, and traceable to specs. Iterate: implement → test → debug → repeat until error-free.

**Traceability:** Reference the feature ID from `A_Core_Spec.md` in code comments at the entry point of each feature's implementation (e.g., `// [F-xxxxxxxx] Handles token refresh`). This links code directly to the spec without over-commenting.

**"Error-free" defined:** All implemented features pass their tests, there are no compilation errors, and no runtime exceptions occur during normal execution paths.

**Discovery Pivot** — if a design flaw, architectural conflict, or clearly better approach surfaces mid-implementation: **STOP**, signal a "Discovery Pivot", and invoke `/brainstorm` to analyze the path before changing any spec or code.

**Change tiers:**

| Tier | Approach |
|---|---|
| **Major** | Full design cycle — update spec first, then implement. |
| **Minor** | Propose spec and code updates together in one review. |
| **Trivial** | Update code and add an Implementation Note to the spec. |

### 3. Document
Add code comments where logic is non-obvious. For each implemented feature, generate user documentation using the `/documentation` skill. Reference the documentation path in relevant code comments.

**UI Help Wiring** — if the project has a web UI (check `B_Architecture.md`) and any feature in `A_Core_Spec.md` has a `Doc Level` of `Page`, `Component`, or `Concept`:

1. **Propose once.** Before writing any help triggers, read the UI framework from `B_Architecture.md` and propose the most natural help-trigger pattern for that stack. Examples — not prescriptive:
   - Bootstrap 5 → Bootstrap Tooltips for `Concept`, Bootstrap Modals for `Page` and `Component`
   - React → a lightweight tooltip/popover component (or `title` attribute if no library is present)
   - Vue → similar to React; use existing UI library conventions if one is defined
   - Plain HTML/JS → `<details>` element for inline help, or a minimal vanilla JS modal
   - If a design system or component library is already referenced in `B_Architecture.md`, prefer its native help/info components

   Present the proposal to DevLead as a short summary (trigger element, open behavior, dismissal). **Wait for explicit approval before writing any trigger code.** This approval covers the entire component — do not re-ask per feature.

2. **Wire consistently.** Once approved, apply the pattern to every UI feature in this component based on its `Doc Level`:
   - `Page` → place the trigger (e.g., a `?` button) in the page header or toolbar
   - `Component` → place an info icon (ℹ) adjacent to the component's title or primary label
   - `Concept` → wrap the term in the approved tooltip trigger wherever it appears in the template

3. **Use a data attribute for the doc path** (e.g., `data-help-src="help/component-login-form.html"`) so the path is resolved at runtime and not hardcoded into the trigger logic. This keeps all help-link references consistent and easy to update.

### 4. Gate Check
Update the Feature Status column in `./SPECS/components/{{ functional_component_name }}/A_Core_Spec.md` for every completed feature. Update the Component Status Tracker in `./STATUS.md` to `Complete` for this component. When all components are `Complete`, update the Project Status Tracker to `Development: Complete`.

## Scope

**Files in scope:** `./src/` · `./SPECS/components/{{ functional_component_name }}/A_Core_Spec.md` (status updates only) · `./SPECS/artifacts/C_Assumptions.md` · `./SPECS/artifacts/D_Decisions.md` · `./SPECS/artifacts/E_Risks.md` · `<frontend_dir>/docs/` or `./docs/` (written by `/documentation` skill — see `B_Architecture.md` for frontend directory)

**Environment variables:** Use `./src/.env`. If it does not exist, create it and ask DevLead to supply any unknown values.

**Artifact ID format:** `^[ADR]-[a-zA-Z0-9]{8}$`
— `A-` for assumptions · `D-` for decisions · `R-` for risks

---

## Appendix: AI Prompt & Tool File Conventions

*Apply this section only when the component involves AI capabilities — prompt files or tool definitions.*

### File Types

**`<id>.prompt.md`** — prose prompts (system instructions, extraction prompts, behavioral rules)

Structure: YAML frontmatter block, then the prompt body in Markdown. Everything after the closing `---` is the exact string sent to the AI.

**`<id>.tools.yaml`** — tool/function definitions sent to the AI API

Structure: pure YAML, no frontmatter. Top-level keys: `id`, `description`, `tools` (array).

### Frontmatter Schema for `.prompt.md`

    ---
    id: <unique_identifier>
    description: <one-line summary of what this prompt does and when it is used>
    loader_params:
      - name: PARAM_NAME
        format: <expected format, e.g. "ISO 8601 date string", "JSON array of strings">
        injected_by: <module or call site that supplies this value at runtime>
        purpose: <why the AI needs this value>
    ---

- If no runtime parameters: `loader_params: []`
- `loader_params` documents runtime token injection only — unrelated to AI tool/function parameter schemas.

### Parameter Injection

Use `{{PARAM_NAME}}` tokens in the prompt body. Replaced with real values at runtime before sending.

- Every `{{TOKEN}}` in the body must be declared in `loader_params` — undeclared tokens throw at load time.
- Every declared param must be supplied at the call site — missing values throw at load time.
- Parameters are always injected as plain strings.

### Loader Contract

A shared loader at `src/prompts/loader.js` exposes:

    loadPrompt(id, params?) → string   // reads *.prompt.md, strips frontmatter, injects params
    loadTools(id)           → object[] // reads *.tools.yaml, returns the tools array

Both throw on file-type mismatch, undeclared tokens, or missing params.

### Directory Layout

    src/prompts/
      loader.js         ← shared loader (only non-prompt file here)
      *.prompt.md       ← prose prompts
      *.tools.yaml      ← tool definitions

### Formatting Rules

- Use `##` headings, `---` horizontal rules, `-` bullets, `1.` numbered steps in prompt bodies.
- Use `|-` for multi-line `description` values in `.tools.yaml` (preserves line breaks, no trailing newline).
- Use 4-space-indented code blocks in prompt bodies — **not** fenced code blocks, which break SKILL.md rendering.
- **Bold** for critical constraints; inline code for field names and literal values.
