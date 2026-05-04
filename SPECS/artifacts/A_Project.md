---
name: project
description: SAP BizAI Pulse — a biweekly AI-focused newsletter generation utility for SAP ecosystem communications.
license: Apache-2.0 (see LICENSE in project root)
---

# SAP BizAI Pulse

> A biweekly newsletter generation utility that curates SAP AI-domain information from internal and community sources, then produces structured, audience-layered Markdown newsletters with a pure educational tone.

---

## Table of Contents

| # | Section | Primary Audience |
| :-: | :------ | :--------------- |
| 1 | [Problem & Solution](#1-problem--solution) | All |
| 2 | [Users](#2-users) | Product · Design · All |
| 3 | [Scope](#3-scope) | Product · Engineering · Stakeholders |
| 4 | [Key Features](#4-key-features) | Product · Engineering · Stakeholders |
| 5 | [Constraints & Trade-offs](#5-constraints--trade-offs) | Product · Engineering · Leadership |
| 6 | [Success](#6-success) | Product · Leadership · Stakeholders |
| 7 | [Open Questions](#7-open-questions) | Product · Engineering |
| 8 | [Change History](#8-change-history) | All |

---

## 1. Problem & Solution

> **Audience:** Everyone. Start here.

### 1.1 Problem
SAP customers and stakeholders lack a structured, reliable way to stay informed about SAP's progress and approaches in the AI domain. Relevant information is scattered across internal announcements, internal documents, and SAP community articles — with no unified, timeline-aware curation or consistent audience-segmented communication. Manually assembling a newsletter from these disparate sources is time-consuming and inconsistently executed.

### 1.2 Solution
SAP BizAI Pulse is a full-stack web application with two functional areas:

1. **Admin Curator** — an interface through which an admin ingests and tags content from internal announcements, PDF documents, and SAP community articles. All content is stored in HANA Cloud with full timeline metadata so that retrieval can be scoped by recency.

2. **Newsletter Generator** — a single unified pipeline that auto-fetches recent SAP Community articles as a suggested topic list, allows the author to review and supplement from the curated dataset, then draws supporting content from `Newsletter-ready` entries to produce a structured, audience-layered Markdown newsletter. The output is a `.md` draft file that the author can publish as `.html` directly from the UI — no email sending is performed.

All generated content follows a strict educational tone: no guidance, no recommendations, no content from non-SAP AI domains.

---

## 2. Users

> **Audience:** Product · Design · All

### 2.1 Target Audience

**Primary consumers** of the generated newsletter: SAP customers — specifically business decision-makers, mid-level managers/leads, and technical practitioners within customer organizations interested in SAP's AI direction.

**Operators** of the utility: Internal SAP team members — an **admin** who curates content and a **newsletter author** who triggers generation (may be the same person).

### 2.2 Personas & Journeys

| Persona | Goal | Journey | Outcome |
| :------ | :--- | :------ | :------ |
| Admin (Curator) | Keep the curated dataset fresh and high-quality | Encounters new internal doc / community article → opens utility → ingests source with metadata → reviews stored entry → marks ready | A dated, tagged content entry is added to the dataset |
| Newsletter Author | Generate a polished newsletter with minimal manual effort | Triggers generation → selects strategy (recency / hot-topics) → reviews draft → exports Markdown | A structured `.md` newsletter file ready for HTML conversion |
| Executive Reader (customer) | Quickly understand business value of SAP AI topics | Receives newsletter → reads Executive Summary section per topic | Clear picture of opportunity and business relevance |
| Mid-Management Reader (customer) | Identify execution approaches to adopt SAP AI in their org | Reads mid-management section per topic | Actionable ideas for incorporating topic into their organization |
| Technical Reader (customer) | Understand the topic at a high technical level | Reads technical section per topic with external references | Conceptual technical understanding plus pointers for deeper research |

---

## 3. Scope

> **Audience:** Product · Engineering · Stakeholders

### 3.1 In Scope (MVP)
- Admin curation interface supporting two ingestion modes:
  - **Auto-fetch** — system reads SAP Community topic pages listed in `_cfg/ai-topics.md` and pulls articles published within a configurable window (default: last 2 weeks) into the curation dataset; triggered on demand by the admin
  - **Ad-hoc ingestion** — admin manually adds content of either of these types:
    - PDF documents (file upload) — covers internal announcements, internal docs, and any other document-based content; admin converts source material to PDF before uploading
    - SAP Community article URLs (single URL entry, system fetches and extracts content)
- All ingested entries (auto-fetched or ad-hoc) stored with full timeline metadata: ingestion date, source type, source URL/filename, and sensitivity tag
- Newsletter generation flow (single unified pipeline — not two exclusive strategies):
  1. System auto-fetches articles published within last 2 weeks from SAP Community topic pages listed in `_cfg/ai-topics.md` and presents them as a suggested topic list
  2. Author reviews the suggested list, removes unwanted topics, and supplements with additional topics chosen from the curated dataset
  3. Author confirms the final topic list and triggers generation
  4. Generator draws supporting content from curated dataset (`Newsletter-ready` entries only) for all selected topics and produces the newsletter
- Newsletter output as a Markdown file with the following per-topic structure:
  - **Section 1 — Executive Summary**: business value, opportunity, success criteria framing (executive audience)
  - **Section 2 — Leadership & Execution**: approaches and ideas for organizational adoption (mid-management / lead audience)
  - **Section 3 — Technical Insight**: high-level technical explanation with public external references (technical practitioner audience)
  - Footer note on internal-document-sourced topics: encourages readers to contact their SAP Enterprise Architect or Account Team
- Admin applies a sensitivity tag at ingestion time — `Internal` (never used in newsletter) or `Newsletter-ready` (cleared for generation). Generator only draws from `Newsletter-ready` entries.
- Strict content guardrails: educational tone only; no guidance/recommendation language; SAP AI domain only; no non-SAP AI content
- Biweekly generation cadence (manual trigger — no scheduled automation)
- Newsletter lifecycle with two stages:
  - **Draft** — generated `.md` saved to `./ready/` with date-stamped filename (e.g., `newsletter_2026-05-03.md`); author can edit or regenerate until satisfied
  - **Publish** — author triggers publish action in the UI; system converts `.md` → `.html`, moves file to `./published/`, and the HTML file is immediately accessible via a served URL on the same Node.js server (e.g., `/published/newsletter_2026-05-03.html`)
- Output: `.md` draft file + published `.html` served by the application server; no email sending

### 3.2 Out of Scope
- Email distribution or any sending mechanism
- Scheduled/automated generation (newsletter trigger is always manual)
- Non-SAP AI topics
- Content from non-SAP sources (e.g., competitor AI news, generic AI industry content)
- Multi-language support
- Other document formats beyond PDF (DOCX, PPTX — deferred post-MVP)

---

## 4. Key Features

> **Audience:** Product · Engineering · Stakeholders

| # | Feature | Description |
| :-: | :------ | :---------- |
| F1 | **Admin Curation Interface** | Web UI for ingesting content via two modes: auto-fetch from SAP Community topic pages (configured in `_cfg/ai-topics.md`) and ad-hoc ingestion (PDF upload or single SAP Community URL). |
| F2 | **Curated Content Dataset** | All ingested entries stored in HANA Cloud with full timeline metadata (ingestion date, source type, source URL/filename) and a sensitivity tag (`Internal` or `Newsletter-ready`). |
| F3 | **Newsletter Generation Flow** | Single unified pipeline: system fetches recent articles as a suggested topic list → author reviews and supplements from curated dataset → author confirms topic list → generator produces the newsletter. |
| F4 | **Three-Layer Per-Topic Structure** | Each newsletter topic rendered in three audience-specific sections: Executive Summary (business value), Leadership & Execution (adoption approaches), and Technical Insight (high-level technical detail with public references). |
| F5 | **Newsletter Lifecycle: Draft → Publish** | Generated `.md` saved to `./ready/` (draft); author triggers publish action to convert to `.html` in `./published/`, immediately served by the application server. |
| F6 | **Content Guardrails** | Automated enforcement of SAP AI domain lock (non-SAP content refused or flagged) and educational tone (guidance/recommendation language detected and rewritten or flagged during generation). |

---

## 5. Constraints & Trade-offs

> **Audience:** Product · Engineering · Leadership


- **Web UI, TypeScript/JavaScript stack** → Full-stack web application (Node.js backend + browser frontend); deployed to Kyma on BTP for shared team access.
- **Kyma on BTP as deployment target** → Application is containerised and deployed to `api.c-5a930ed.kyma.ondemand.com`; local dev runs via `npm run dev` on port 8080.
- **SAP AI Core for LLM** → Newsletter generation uses `gpt-4o` (deployment `deaf6d11f22b1764`) via SAP AI Core API (`api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com`). Embeddings use `text-embedding-ada-002` (deployment `df7d80b9631d2737`). Credentials managed via environment variables; never committed to source.
- **SAP HANA Cloud as storage backend** → Curated content stored in HANA Cloud (`prod-eu10`); enables vector similarity search for hot-topics matching and scales naturally with multi-user Kyma deployment.
- **Newsletter lifecycle** → Draft `.md` in `./ready/`; publish action converts to `.html` in `./published/` served by the app. No email sending — distribution is the operator's responsibility.
- **SAP AI domain lock** → Generator must refuse or flag content that falls outside SAP AI scope, even if curated by the admin.
- **Educational tone enforcement** → Language resembling guidance, recommendation, or directive must be detected and rewritten or flagged during generation.
- **PDF as initial document format** → Only PDF ingestion supported at MVP; other document formats deferred.
- **Hot-topics source config** → Topic page URLs maintained in `_cfg/ai-topics.md` by the operator; system reads this file at generation time. No hardcoded URLs in code.

---

## 6. Success

> **Audience:** Product · Leadership · Stakeholders

### 5.1 North Star Metric
An admin can curate new content and an author can generate a fully structured, publication-ready biweekly newsletter — covering multiple SAP AI topics across all three audience layers — in under 30 minutes of active effort.

### 5.2 Launch Criteria
- Admin can ingest content via both modes: auto-fetch from `_cfg/ai-topics.md` sources and ad-hoc (PDF upload, SAP Community URL), with entries retrievable filtered by date range.
- Generator produces a valid `.md` file with correct three-section structure for every topic included.
- All generated content passes a manual tone review: no guidance/recommendation language; no non-SAP AI content.
- Newsletter author can run the full generation flow end-to-end without developer intervention.

### 5.3 Supporting Metrics *(optional)*
- Curated dataset retains full timeline metadata — every entry queryable by ingestion date and source type.
- Hot-topics strategy successfully fetches at least one new article from `_cfg/ai-topics.md` sources and matches it against the curated dataset per generation run.

---

## 7. Open Questions

> **Audience:** Product · Engineering

*None — all questions resolved.*

---

## 8. Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial draft from DevAgent ideation session | 2026-05-03 | SpecGantry |
| — | Q1 resolved: Web UI, TypeScript/JavaScript stack; Kyma on BTP as deployment target | 2026-05-03 | DevAgent |
| — | Q2+Q4 resolved: SAP AI Core (gpt-4o) for generation; HANA Cloud as storage backend | 2026-05-03 | DevAgent |
| — | Q3 resolved: hot-topics sources defined in `_cfg/ai-topics.md` (SAP Community pages, operator-maintained) | 2026-05-03 | DevAgent |
| — | Q4 resolved: system fetches last-2-weeks articles from ai-topics.md sources; author selects/adjusts before generation | 2026-05-03 | DevAgent |
| — | Scope revised: two ingestion modes clarified — auto-fetch from ai-topics.md and ad-hoc (paste/PDF upload/URL) | 2026-05-03 | DevAgent |
| — | C1 resolved: draft .md → ./ready/; publish action converts to .html → ./published/ served by app server | 2026-05-03 | DevAgent |
| — | C2 resolved: generation is a single unified flow — auto-fetched topics as default list, author supplements from curated dataset | 2026-05-03 | DevAgent |
| — | C3 resolved: PDF is the single upload format for all document content; no text-paste input needed | 2026-05-03 | DevAgent |
| — | Key Features section added (F1–F6) derived from confirmed scope | 2026-05-03 | SpecGantry |
| — | §1.2 Solution updated: removed stale "two strategies" language; reflects unified generation pipeline and web app deployment | 2026-05-03 | SpecGantry |
