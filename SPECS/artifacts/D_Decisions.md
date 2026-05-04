---
name: decisions
description: Living register of all decisions made during specification. Review and mark each as approved [X], rejected [-], deferred [>], or pending [ ].
license: Apache-2.0 (see LICENSE in project root)
---

# Decisions

> A decision left unreviewed blocks dependent work or, worse, lets it proceed on a rejected choice.
> This register must be reviewed and all blocking decisions resolved before dependent implementation begins.
>
> **Status codes:** `[ ]` Pending · `[X]` Approved · `[-]` Rejected · `[>]` Deferred
>
> **Decision types:** `ARCH` Architecture · `TECH` Technology / Library · `PRODUCT` Product / UX · `DATA` Data & Storage · `SEC` Security · `OPS` Operations · `COMPLIANCE` Compliance & Legal

---

## Summary

| Total | Pending `[ ]` | Approved `[X]` | Rejected `[-]` | Deferred `[>]` |
| :---: | :-----------: | :------------: | :------------: | :------------: |
| 19 | 0 | 18 | 1 | 0 |

---

## Architecture

| Status | ID | Decision | Rationale | Alternatives Rejected | Impact | Owner | Notes |
| :----: | :- | :------- | :-------- | :-------------------- | :----- | :---- | :---- |
| `[X]` | D-ARCH-M0N0L1TH | Single Node.js monolith — Express serves both REST API and static React frontend assets | Internal tool; no need for microservice complexity; simpler deploy and single container | Separate frontend deployment | Single container on port 8080; all components co-deployed | DevAgent | — |
| `[X]` | D-ARCH-COMP5PLIT | Five-component decomposition: C01 Content Curator, C02 Newsletter Generator, C03 Newsletter Lifecycle, C04 AI Service, C05 Data Store | Clean separation of concerns; C04 and C05 are shared internal libraries; matches feature boundaries from A_Project.md | Flat single-module design | Component specs map 1:1 to `./SPECS/components/` subdirectories | DevAgent | — |
| `[X]` | D-ARCH-STREAMNG | AI generation response streamed to UI (SSE or chunked transfer) | Generation for 10 topics can exceed 60s; streaming prevents UI timeout and gives progressive feedback | Polling; fire-and-forget with WebSocket | Requires streaming support in Express route handler and React UI consumer | DevAgent | — |

## Technology & Libraries

> 📦 Approved entries here constitute the permitted library list for development.
> No library may be used in code unless it appears in this section with status `[X]`.

| Status | ID | Decision | Rationale | Alternatives Rejected | Impact | Owner | Notes |
| :----: | :- | :------- | :-------- | :-------------------- | :----- | :---- | :---- |
| `[X]` | D-TECH-REACT18 | React 18 as frontend framework | Broad TypeScript support; component model suits multi-view admin tool | Vue.js (smaller ecosystem); plain HTML/JS (no component reuse) | All UI in `./src/ui/` | DevAgent | — |
| `[X]` | D-TECH-VITE5 | Vite as frontend build tool | Fast HMR in dev; optimised production bundle; modern ESM-first | Webpack (heavier config) | Dev workflow: `npm run dev`; prod: `vite build` | DevAgent | — |
| `[X]` | D-TECH-BOOTS5 | Bootstrap 5 CSS for styling | Rapid UI with no custom design system; adequate for internal tool | Tailwind CSS; shadcn/ui; plain CSS | No custom brand tokens; standard Bootstrap components only | DevAgent | — |
| `[X]` | D-TECH-EXPR4 | Express 4.x as HTTP framework | Minimal, widely known; sufficient for internal REST API | Fastify (more config); NestJS (over-engineered for MVP) | `./src/api/` | DevAgent | — |
| `[X]` | D-TECH-HCLIENT | `@sap/hana-client` with raw SQL — no ORM | BTP-required HANA client; raw SQL gives full control over vector search queries | Knex.js ORM (abstraction not needed; complicates vector SQL) | `./src/db/` | DevAgent | — |
| `[X]` | D-TECH-PDFJS4 | `pdfjs-dist` v4 for PDF text extraction | Mozilla PDF.js; robust; no native binaries; handles complex PDFs | `pdf-parse` (less actively maintained) | `./src/parser/` | DevAgent | — |
| `[X]` | D-TECH-PLAYWRT | Playwright (Chromium) for web scraping | SAP Community pages are JS-rendered; Playwright handles dynamic content | axios + cheerio (fails on JS-rendered pages); puppeteer (less actively maintained) | Larger container image; single browser instance reused across requests | DevAgent | — |
| `[X]` | D-TECH-MDIT14 | `markdown-it` v14 for Markdown → HTML conversion | Spec-compliant; HTML escaping on by default; extensible | `marked` (less strict); `remark` (heavier pipeline) | `./src/publisher/` | DevAgent | — |
| `[X]` | D-TECH-S3CLIENT | `@aws-sdk/client-s3` (AWS SDK v3) for SAP Object Store file I/O | SAP Object Store instance is S3-compatible (`s3-eu-central-1.amazonaws.com`); AWS SDK v3 is modular, actively maintained, and the standard for S3-compatible endpoints | `aws-sdk` v2 (monolithic, heavier); proprietary SAP client (not available for S3-compatible store) | C03 uses this library for all `.md`/`.html` file read/write to Object Store; credentials from env vars | DevAgent | Confirmed during C03 detailed design — credentials in `_cfg/.env` confirm S3-compatible endpoint |
| `[X]` | D-TECH-TSNODE | TypeScript 5.x across full stack | Type safety reduces runtime errors; consistent language across frontend and backend | Plain JavaScript (no type safety) | All source in TypeScript; compiled to JS for production | DevAgent | — |

## Product & UX

| Status | ID | Decision | Rationale | Alternatives Rejected | Impact | Owner | Notes |
| :----: | :- | :------- | :-------- | :-------------------- | :----- | :---- | :---- |
| `[-]` | D-PRODUCT-INTTAG | Sensitivity tag defaults to `Internal` on all ingested entries | Prevents accidental use of internal content in newsletters; operator must explicitly promote to `Newsletter-ready` | Default to `Newsletter-ready` (too risky) | Generator enforces `Newsletter-ready` filter at retrieval | DevAgent | — |
| `[X]` | D-PRODUCT-SENSTAG | All entries start as `Internal` on ingestion. Admin approval triggers vectorization. Successful vectorization automatically promotes entry to `Newsletter-ready`. Failed vectorization keeps entry as `Internal` and surfaces it to admin for retry. Admin cannot set `Newsletter-ready` directly — the only path is approve → vectorize → promote. | Vectorization is the quality gate; only embedded content is suitable for semantic retrieval in generation | Manual tagging (rejected — too error-prone); ingestion-mode-based default (rejected — ignores vectorization quality gate) | C01 must expose an approve action; C04 embedding result drives the status transition; C02 filters to `Newsletter-ready` only | DevAgent | Supersedes D-PRODUCT-INTTAG |
| `[X]` | D-PRODUCT-SUGGEST | Topic suggestion queries HANA for `Newsletter-ready` entries within the timeframe (max of last newsletter date or 2 weeks ago); runs two-pass LLM clustering to produce deduplicated topics; no Playwright scraping during suggest | All curated content is already in HANA with rich body_text from approval — re-scraping would lose synthesized content and waste time; LLM clustering over body_text produces semantically coherent topics; persona-specific vector search per section maximises relevance of supporting content | Playwright scraping (rejected — redundant; topic landing pages have no article body content); single-pass LLM (rejected — context window too small for all entries combined) | Removes `_cfg/ai-topics.md` dependency from C02; topic type simplifies to `clustered` with `entryIds`; pipelineWorker runs 3 embeddings per topic | DevAgent | — |

## Data & Storage

| Status | ID | Decision | Rationale | Alternatives Rejected | Impact | Owner | Notes |
| :----: | :- | :------- | :-------- | :-------------------- | :----- | :---- | :---- |
| `[X]` | D-DATA-HANAVEC | HANA Cloud as sole persistence layer (relational + vector) | BTP-native; REAL_VECTOR type eliminates separate vector DB; scales with Kyma deployment | PostgreSQL + pgvector (not BTP-native); Pinecone/Qdrant (extra dependency) | Single HANA Cloud instance (`prod-eu10`) for all storage | DevAgent | — |
| `[X]` | D-DATA-FILESYS | Newsletter `.md` and `.html` files stored in **SAP Object Store** (BTP service instance) | Durable object storage; survives pod restarts; credentials provisioned in `_cfg/.env` | Pod-local filesystem (risks file loss on restart); Kyma PV (more ops overhead) | C03 Newsletter Lifecycle must use SAP Object Store SDK for file read/write; credentials loaded from `_cfg/.env` | DevAgent | Resolved 2026-05-03 — SAP Object Store instance credentials available in `_cfg/.env` |

## Security

| Status | ID | Decision | Rationale | Alternatives Rejected | Impact | Owner | Notes |
| :----: | :- | :------- | :-------- | :-------------------- | :----- | :---- | :---- |
| `[X]` | D-SEC-APIKEY | Shared API key (`X-API-Key` header) as authentication mechanism | Internal tool; XSUAA OAuth2 adds significant BTP configuration overhead for 2–3 users | SAP BTP XSUAA OAuth2; no auth (unacceptable for Kyma-deployed service) | No per-user audit trail; manual key rotation; acceptable for MVP | DevAgent | Revisit if access expands beyond internal team |

## Operations & Deployment

| Status | ID | Decision | Rationale | Alternatives Rejected | Impact | Owner | Notes |
| :----: | :- | :------- | :-------- | :-------------------- | :----- | :---- | :---- |
| `[X]` | D-OPS-MANLDEP | Manual deployment trigger (operator builds image, applies Kyma manifests) | No CI/CD pipeline at MVP; small team; infrequent releases | GitHub Actions CI/CD (over-engineered for MVP) | Deployment steps documented in `./deploy/`; CI/CD deferred | DevAgent | — |
| `[X]` | D-OPS-NOSTAGE | No staging environment at MVP | Internal tool with a single small operator team; cost and complexity not justified | Staging environment | Manual smoke testing on prod after deploy | DevAgent | — |

## Compliance & Legal

*No compliance decisions required — no external regulations apply (see B_Architecture.md §12).*

---

## Rejected Decisions Log

| ID | Decision | Rejected by | Date | Reason | Superseded by |
| :- | :------- | :---------- | :--: | :----- | :------------ |
| D-PRODUCT-INTTAG | Sensitivity tag defaults to `Internal` on all ingested entries; admin manually promotes to `Newsletter-ready` | DevAgent | 2026-05-03 | Tag should be system-managed via vectorization pipeline, not manually set by admin | D-PRODUCT-SENSTAG |

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| D-TECH-S3CLIENT | `@aws-sdk/client-s3` selected for SAP Object Store I/O — confirmed S3-compatible endpoint from `_cfg/.env` | 2026-05-03 | SpecGantry |
| D-DATA-FILESYS | Resolved from deferred to approved — SAP Object Store selected; credentials in `_cfg/.env` | 2026-05-03 | DevAgent |
| — | D-PRODUCT-SENSTAG added (supersedes D-PRODUCT-INTTAG); rejected decision moved to log | 2026-05-03 | SpecGantry |
| D-PRODUCT-SUGGEST | Added — topic suggestion redesigned to use two-pass LLM clustering over HANA Newsletter-ready entries; persona-specific vector search per section | 2026-05-04 | SpecGantry |
| — | D-DATA-FILESYS changed from rejected to deferred — SAP Object Store or Kyma PV under consideration | 2026-05-03 | DevAgent |
