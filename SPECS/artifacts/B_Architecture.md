---
name: architecture
description: Technical architecture specification for this project.
license: Apache-2.0 (see LICENSE in project root)
---

# ARCHITECTURE

> Full-stack Node.js + React web application that curates SAP AI-domain content and generates audience-layered Markdown newsletters via SAP AI Core, backed by HANA Cloud vector storage, deployed on Kyma/BTP.

---

## Table of Contents

| # | Section | Primary Audience |
| :-: | :------ | :--------------- |
| 1 | [System Blueprint](#1-system-blueprint) | All |
| 2 | [Functional Components](#2-functional-components) | All |
| 3 | [Technical Stack](#3-technical-stack) | Engineers |
| 4 | [AI Technologies](#4-ai-technologies) | Engineers · AI/ML |
| 5 | [User Experience](#5-user-experience) | Frontend · Design · Product |
| 6 | [Data Architecture](#6-data-architecture) | Backend · Data |
| 7 | [API Design](#7-api-design) | Backend · Frontend · Integrators |
| 8 | [Error Handling & Resilience](#8-error-handling--resilience) | Backend · SRE |
| 9 | [Notifications & Messaging](#9-notifications--messaging) | Backend · Product |
| 10 | [Observability & Analytics](#10-observability--analytics) | SRE · Product |
| 11 | [Security](#11-security) | Security · Backend · Compliance |
| 12 | [Compliance & Privacy](#12-compliance--privacy) | Legal · Compliance · Security |
| 13 | [Third-Party Integrations](#13-third-party-integrations) | Backend · Security |
| 14 | [Scalability](#14-scalability) | Backend · SRE · Architecture |
| 15 | [Testing Strategy](#15-testing-strategy) | Engineers · QA |
| 16 | [Deployment](#16-deployment) | DevOps · SRE |
| 17 | [Libraries](#17-libraries) | Engineers · Security |
| 18 | [Change History](#18-change-history) | All |

---

## 1. System Blueprint

> **Audience:** Everyone. Start here.

### 1.1 High-Level Data Flow

**Curation flow (Admin):**
```
Admin → [React UI] → [Express API] → [C01 Content Curator]
  → auto-fetch: Playwright scrapes SAP Community pages → [C05 Data Store / HANA Cloud]
  → ad-hoc PDF: pdfjs-dist extracts text → [C05 Data Store / HANA Cloud]
  → ad-hoc URL: Playwright fetches article → [C05 Data Store / HANA Cloud]
  → embed: [C04 AI Service] → SAP AI Core (text-embedding-ada-002) → vector stored in HANA Cloud
```

**Newsletter generation flow (Author):**
```
Author → [React UI] → [Express API] → [C02 Newsletter Generator]
  → fetch recent articles from SAP Community (Playwright) → suggest topic list to Author
  → Author selects/adjusts topics → confirms final list
  → [C05 Data Store] vector similarity search (Newsletter-ready entries only) → supporting content retrieved
  → [C04 AI Service] → SAP AI Core (gpt-4o) → per-topic 3-section content generated
  → [C03 Newsletter Lifecycle] → .md draft written to ./ready/
```

**Publish flow (Author):**
```
Author → [React UI] → [Express API] → [C03 Newsletter Lifecycle]
  → markdown-it converts .md → .html → written to ./published/
  → HTML served at /published/<filename>.html by Express static middleware
```

### 1.2 Component Interaction Map

| From | To | Protocol | Sync / Async |
| :--- | :- | :------- | :----------- |
| React UI | Express API (C01–C03) | REST/HTTP + API key header | Sync |
| C01 Content Curator | C04 AI Service | In-process function call | Sync |
| C01 Content Curator | C05 Data Store | SQL via @sap/hana-client | Sync |
| C02 Newsletter Generator | C04 AI Service | In-process function call | Sync (streaming response to UI) |
| C02 Newsletter Generator | C05 Data Store | SQL + vector search via @sap/hana-client | Sync |
| C03 Newsletter Lifecycle | C05 Data Store | SQL via @sap/hana-client | Sync |
| C04 AI Service | SAP AI Core API | HTTPS REST | Sync |
| C05 Data Store | HANA Cloud | TCP via @sap/hana-client | Sync |

### 1.3 Key Architectural Decisions

**Decision:** Single deployable Node.js monolith serving both API and static frontend assets.
**Context:** Internal tool with 2–3 operators; no need for microservice complexity.
**Choice:** Express serves REST API routes (`/api/*`) and static React build + published HTML files.
**Alternatives rejected:** Separate frontend deployment (unnecessary operational overhead).
**Consequences:** Simpler deploy, single container, single port (8080).

---

**Decision:** HANA Cloud as the sole persistence layer (relational + vector).
**Context:** BTP-native, supports vector similarity search natively, eliminates a separate vector DB.
**Choice:** HANA Cloud (`prod-eu10`) for all storage — structured content metadata + embeddings.
**Alternatives rejected:** PostgreSQL + pgvector (not BTP-native, additional managed service); separate Pinecone/Qdrant (extra dependency).
**Consequences:** HANA Cloud expertise required; single point of failure for storage.

---

**Decision:** SAP AI Core as the exclusive LLM and embedding provider.
**Context:** Enterprise requirement — SAP AI Core is the approved AI gateway for BTP deployments.
**Choice:** gpt-4o (`deaf6d11f22b1764`) for generation; text-embedding-ada-002 (`df7d80b9631d2737`) for embeddings.
**Alternatives rejected:** Direct OpenAI API (not BTP-approved); Anthropic Claude (not available via SAP AI Core at time of design).
**Consequences:** Bound to SAP AI Core availability and deployment IDs; credential rotation must go through SAP AI Core.

---

**Decision:** Playwright for all web content fetching (auto-fetch + ad-hoc URL).
**Context:** SAP Community pages are JS-rendered; a simple HTTP fetch + HTML parser would miss content.
**Choice:** Playwright (headless Chromium) for all web scraping.
**Alternatives rejected:** axios + cheerio (fails on JS-rendered pages); puppeteer (similar to Playwright but less actively maintained).
**Consequences:** Larger container image (~300MB chromium); longer cold start; scraping may break if SAP Community changes DOM structure.

---

**Decision:** API key authentication (shared secret) rather than BTP XSUAA.
**Context:** Internal tool accessed by a small, known team; XSUAA adds OAuth2 setup complexity.
**Choice:** Single API key passed via `X-API-Key` request header, validated by Express middleware.
**Alternatives rejected:** XSUAA OAuth2 (significant BTP configuration overhead for 2–3 users); no auth (unacceptable for Kyma-deployed service).
**Consequences:** Key must be rotated manually; no per-user audit trail; acceptable for internal MVP.

---

## 2. Functional Components

### [C01] Content Curator

| Field | Detail |
| :---- | :----- |
| **Purpose** | Admin interface for ingesting and managing curated content. Supports auto-fetch from SAP Community topic pages and ad-hoc ingestion (PDF upload, single URL). Tags entries with sensitivity (`Internal` / `Newsletter-ready`). |
| **Dependencies** | C04 (AI Service — embeddings), C05 (Data Store) |
| **Key data elements** | Content entry: title, body text, source type, source URL/filename, ingestion date, sensitivity tag, embedding vector |
| **Background process** | N |
| **External services consumed** | SAP Community pages (via Playwright), SAP AI Core embeddings API (via C04) |
| **Services exposed** | REST: `POST /api/curator/fetch`, `POST /api/curator/ingest/pdf`, `POST /api/curator/ingest/url`, `GET /api/curator/entries`, `PATCH /api/curator/entries/:id`, `DELETE /api/curator/entries/:id` |
| **AI capabilities** | Y — generates text embeddings for each ingested entry via C04 |
| **Events consumed** | None |
| **Events produced** | None |
| **Critical NFRs** | PDF upload max 20MB; auto-fetch completes within 60s; duplicate URL detection |
| **Component spec path** | `./SPECS/components/c01-content-curator/` |

### [C02] Newsletter Generator

| Field | Detail |
| :---- | :----- |
| **Purpose** | Drives the newsletter generation pipeline: fetches recent SAP Community articles as suggested topics, allows author to review/supplement from curated dataset, retrieves supporting content via vector search, and generates the three-section per-topic newsletter via LLM. |
| **Dependencies** | C04 (AI Service — LLM + embeddings), C05 (Data Store — content retrieval) |
| **Key data elements** | Topic list, selected topics, retrieved supporting content chunks, generated newsletter sections, guardrail flags |
| **Background process** | N |
| **External services consumed** | SAP Community pages (via Playwright for topic suggestion), SAP AI Core LLM API (via C04) |
| **Services exposed** | REST: `GET /api/generator/topics/suggest`, `GET /api/curator/entries` (read, shared with C01), `POST /api/generator/generate` |
| **AI capabilities** | Y — LLM generates per-topic Executive Summary, Leadership & Execution, and Technical Insight sections; embedding-based vector search retrieves relevant supporting content; guardrail prompt enforces SAP AI domain lock and educational tone |
| **Events consumed** | None |
| **Events produced** | None |
| **Critical NFRs** | Generation streaming response to UI; total generation time < 5 min for up to 10 topics; guardrail must flag or rewrite non-SAP-AI content |
| **Component spec path** | `./SPECS/components/c02-newsletter-generator/` |

### [C03] Newsletter Lifecycle

| Field | Detail |
| :---- | :----- |
| **Purpose** | Manages the draft → publish lifecycle. Saves generated `.md` drafts to `./ready/`, converts to `.html` on publish action, moves to `./published/`, and serves published files. |
| **Dependencies** | C05 (Data Store — newsletter metadata) |
| **Key data elements** | Newsletter record: filename, status (draft/published), created date, published date |
| **Background process** | N |
| **External services consumed** | None |
| **Services exposed** | REST: `GET /api/newsletters`, `GET /api/newsletters/:id`, `POST /api/newsletters/:id/publish`, `DELETE /api/newsletters/:id`; static file serving: `GET /published/:filename.html` |
| **AI capabilities** | N |
| **Events consumed** | None |
| **Events produced** | None |
| **Critical NFRs** | Publish conversion (md→html) completes < 5s; published HTML accessible immediately after publish action |
| **Component spec path** | `./SPECS/components/c03-newsletter-lifecycle/` |

### [C04] AI Service

| Field | Detail |
| :---- | :----- |
| **Purpose** | Shared internal wrapper around SAP AI Core API. Provides LLM completion calls (gpt-4o) and embedding generation (text-embedding-ada-002). Handles authentication, request formatting, and error handling for all AI Core interactions. |
| **Dependencies** | SAP AI Core API (external) |
| **Key data elements** | Prompt text, completion response, input text, embedding vector (1536 dimensions) |
| **Background process** | N |
| **External services consumed** | SAP AI Core API (`api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com`) |
| **Services exposed** | In-process functions only: `generateCompletion(prompt, options)`, `generateEmbedding(text)` |
| **AI capabilities** | Y — core AI orchestration layer |
| **Events consumed** | None |
| **Events produced** | None |
| **Critical NFRs** | Retry on transient AI Core errors (max 3 attempts, exponential backoff); surface clear error to caller on permanent failure |
| **Component spec path** | `./SPECS/components/c04-ai-service/` |

### [C05] Data Store

| Field | Detail |
| :---- | :----- |
| **Purpose** | All HANA Cloud read/write operations. Owns the schema, provides typed query functions for content entries, newsletter metadata, and vector similarity search. No business logic — pure data access layer. |
| **Dependencies** | HANA Cloud (`prod-eu10`, external) |
| **Key data elements** | `content_entries` table (content + embeddings + metadata), `newsletters` table (lifecycle metadata) |
| **Background process** | N |
| **External services consumed** | HANA Cloud via `@sap/hana-client` |
| **Services exposed** | In-process functions only: CRUD for content entries, newsletter metadata, vector similarity search |
| **AI capabilities** | N |
| **Events consumed** | None |
| **Events produced** | None |
| **Critical NFRs** | Connection pooling; vector search returns top-K results within 3s |
| **Component spec path** | `./SPECS/components/c05-data-store/` |

---

## 3. Technical Stack

> Standardize wherever possible. Flag per-component deviations explicitly.

| Layer | Technology | Rationale | Source Path |
| :---- | :--------- | :-------- | :---------- |
| **Runtime** | Node.js 20 LTS | LTS stability; broad ecosystem | — |
| **Language** | TypeScript 5.x | Type safety across full stack | — |
| **Data** | HANA Cloud via `@sap/hana-client` | BTP-native, relational + vector in one store | `./src/db/` |
| **API / Middleware** | Express 4.x | Minimal, widely known, sufficient for internal tool | `./src/api/` |
| **AI** | SAP AI Core REST API (via `axios`) | Approved BTP AI gateway; gpt-4o + embeddings | `./src/ai/` |
| **Web scraping** | Playwright (Chromium) | Handles JS-rendered SAP Community pages | `./src/scraper/` |
| **PDF parsing** | pdfjs-dist | Mozilla PDF.js; robust text extraction | `./src/parser/` |
| **Markdown → HTML** | markdown-it | Spec-compliant, extensible | `./src/publisher/` |
| **Frontend framework** | React 18 | Component model; TypeScript support | `./src/ui/` |
| **Frontend build** | Vite | Fast HMR in dev; optimised prod bundle | `./src/ui/` |
| **Frontend styling** | Bootstrap 5 CSS | Rapid UI, no custom design system needed | `./src/ui/` |
| **Configuration** | JSON files in `_cfg/` | Central behaviour config (e.g. `ai-topics.md`) | `./_cfg/` |
| **App credentials** | Environment variables | Never committed to source | — |
| **External service credentials** | Environment variables | SAP AI Core, HANA Cloud credentials | — |
| **Container** | Docker (node:20-slim base) | Kyma deployment requirement | `Dockerfile` |

---

## 4. AI Technologies

> **Audience:** Engineers · AI/ML

| Concern | Choice | Notes |
| :------ | :----- | :---- |
| **LLM** | gpt-4o via SAP AI Core | Deployment ID: `deaf6d11f22b1764`; endpoint: `api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com` |
| **Text-embedding model** | text-embedding-ada-002 via SAP AI Core | Deployment ID: `df7d80b9631d2737`; 1536-dimension vectors |
| **Vector database** | HANA Cloud (native vector type) | Vectors stored alongside content metadata in `content_entries` table |
| **Prompt storage** | Markdown files in `./src/ai/prompts/` | One file per prompt (e.g., `generate-executive-summary.md`, `guardrail-check.md`), versioned in source control |
| **MCP servers deployed** | N | — |
| **MCP servers consumed** | N | — |

---

## 5. User Experience

> **Audience:** Frontend · Design · Product

### 5.1 Interface Surfaces

- [x] Web app (React SPA, served by Express)
- [x] Dashboard / admin panel (curation management)
- [ ] Mobile app — not applicable; internal desktop-first tool
- [ ] CLI — not applicable
- [ ] Conversational / chat interface — not applicable
- [ ] Notification surface — not applicable (no email/push/SMS)

### 5.2 Key User Flows

**Flow: Auto-fetch & curate**
- Entry point: Admin opens Curator tab
- Steps: 1. Click "Fetch Latest" → 2. System fetches SAP Community pages from `_cfg/ai-topics.md` → 3. New entries appear in list with `Internal` default tag → 4. Admin reviews each entry, updates tag to `Newsletter-ready` where appropriate
- Success exit: Entries saved to HANA Cloud with correct metadata and embeddings
- Error path: Fetch failure shown inline per source URL; partial successes retained

**Flow: Ad-hoc PDF ingestion**
- Entry point: Admin clicks "Add Content" → selects "Upload PDF"
- Steps: 1. Admin uploads PDF → 2. System extracts text via pdfjs-dist → 3. Admin reviews extracted preview, sets title, sensitivity tag → 4. Confirms → entry saved with embedding
- Success exit: Entry appears in curator list
- Error path: Extraction failure shown with option to retry or discard

**Flow: Ad-hoc URL ingestion**
- Entry point: Admin clicks "Add Content" → selects "Enter URL"
- Steps: 1. Admin pastes SAP Community article URL → 2. System fetches via Playwright → 3. Admin reviews preview, sets sensitivity tag → 4. Confirms → entry saved with embedding
- Success exit: Entry appears in curator list
- Error path: Fetch failure shown with error detail; admin can retry or cancel

**Flow: Generate newsletter**
- Entry point: Author opens Generator tab
- Steps: 1. Click "Suggest Topics" → system fetches recent articles → topic list rendered → 2. Author removes unwanted topics, optionally adds from curated dataset search → 3. Author clicks "Generate" → streaming progress shown per topic → 4. Draft `.md` saved to `./ready/`
- Success exit: Draft appears in Newsletter list with status "Draft"
- Error path: Per-topic generation failure shown; author can retry individual topics or abort

**Flow: Publish newsletter**
- Entry point: Author opens Newsletter list, selects a Draft
- Steps: 1. Author previews rendered HTML → 2. Clicks "Publish" → 3. `.md` converted to `.html`, moved to `./published/`
- Success exit: Published URL displayed and accessible
- Error path: Conversion error shown with retry option

### 5.3 Design System

| Concern | Decision |
| :------ | :------- |
| Design system | Bootstrap 5 CSS (CDN or bundled) |
| Component library | None — standard Bootstrap components only |
| Theming | Bootstrap default; no custom brand tokens at MVP |
| Accessibility standard | WCAG 2.1 AA minimum for interactive elements |

### 5.4 Mobile-First
Not a primary concern for this internal desktop tool. Bootstrap's responsive grid applied as a baseline but no specific mobile breakpoint optimization. Operators are expected to use desktop browsers.

### 5.5 Cloud-First
Application deployed to Kyma on BTP. No CDN — static assets served by Express from the same container. Async operations (AI generation, Playwright scraping) use streaming HTTP responses to avoid timeout on long-running requests.

### 5.6 AI-First
- Generation progress streamed to UI (Server-Sent Events or chunked transfer) — author sees content appear per topic rather than waiting for full completion.
- Loading states shown for all AI and scraping operations.
- Guardrail flags surfaced inline in the draft UI (flagged sections highlighted).
- No user opt-out of guardrails — they are a product requirement, not a preference.

### 5.7 UX Non-Negotiables
- No email composition or sending UI at any point.
- Sensitivity tag defaults to `Internal` on all ingested entries — author must explicitly change to `Newsletter-ready`.
- Generator must only surface `Newsletter-ready` entries in topic supplementation and content retrieval.

---

## 6. Data Architecture

> **Audience:** Backend · Data

### 6.1 Data Models

```
content_entries  (owned by C01/C05)
  id             UUID PK
  title          VARCHAR
  body_text      NCLOB
  source_type    VARCHAR  -- 'auto-fetch' | 'pdf' | 'url'
  source_ref     VARCHAR  -- URL or filename
  ingestion_date TIMESTAMP
  sensitivity    VARCHAR  -- 'Internal' | 'Newsletter-ready'
  embedding      REAL_VECTOR(1536)

newsletters  (owned by C03/C05)
  id             UUID PK
  filename       VARCHAR  -- e.g. newsletter_2026-05-03.md
  status         VARCHAR  -- 'draft' | 'published'
  created_at     TIMESTAMP
  published_at   TIMESTAMP NULL
  topic_list     NCLOB    -- JSON array of topic titles used
```

`content_entries` —< `newsletters` relationship is indirect: newsletters draw from entries at generation time; no FK constraint needed.

### 6.2 Storage Strategy

| Store type | Technology | Used for | Component(s) |
| :--------- | :--------- | :------- | :----------- |
| Primary DB | HANA Cloud (relational) | content_entries, newsletters metadata | C01, C03, C05 |
| Vector store | HANA Cloud (REAL_VECTOR type) | Embedding vectors for similarity search | C02, C05 |
| Object / blob | Local filesystem (`./ready/`, `./published/`) | `.md` drafts and `.html` published files | C03 |
| Cache | None at MVP | — | — |
| Queue / stream | None at MVP | — | — |

### 6.3 Data Flow & Ownership

| Entity | Owner (write) | Readers |
| :----- | :------------ | :------ |
| `content_entries` | C01 (ingest/update/delete) | C02 (read for topic supplement + vector search) |
| `newsletters` | C03 (create on generate, update on publish) | C03 (list/detail) |
| `./ready/*.md` | C02 (writes draft) | C03 (reads for conversion) |
| `./published/*.html` | C03 (writes on publish) | Express static middleware (serves) |

### 6.4 Retention & Archival
- `content_entries`: retained indefinitely at MVP; no automated archival. Admin manually deletes stale entries via the Curator UI.
- `newsletters`: retained indefinitely. Draft files in `./ready/` may be manually cleaned up.
- No PII stored — no special disposal obligations.

---

## 7. API Design

> **Audience:** Backend · Frontend · Integrators

### 7.1 API Patterns

| Boundary | Pattern | Rationale |
| :------- | :------ | :-------- |
| Client ↔ Backend | REST JSON over HTTP; `X-API-Key` header auth | Simple, stateless; sufficient for internal SPA |
| Backend ↔ AI service | HTTPS REST (SAP AI Core OpenAI-compatible API via axios) | SAP AI Core exposes OpenAI-compatible endpoints |
| Backend ↔ DB | SQL via `@sap/hana-client` connection pool | HANA native client; no ORM overhead |
| Service ↔ Service | In-process function calls (C04, C05 are shared libraries) | All components run in one Node.js process |

### 7.2 Versioning Strategy
All API routes prefixed `/api/v1/`. Breaking changes increment the version prefix. No formal deprecation policy at MVP — internal tool with single team.

### 7.3 Request / Response Conventions

Success:
```json
{ "data": <payload>, "meta": { "requestId": "<uuid>" } }
```
Error:
```json
{ "error": { "code": "<ERROR_CODE>", "message": "<human-readable>", "requestId": "<uuid>" } }
```
Pagination (list endpoints): `meta` includes `{ "total": N, "offset": N, "limit": N }`.

### 7.4 Rate Limiting & Throttling
No rate limiting at MVP — internal tool with 2–3 users. SAP AI Core enforces its own upstream limits; C04 will surface 429 errors to the caller with a descriptive message.

---

## 8. Error Handling & Resilience

> **Audience:** Backend · SRE

### 8.1 Error Classification

| Class | Examples | Retry? | User-visible? |
| :---- | :------- | :----- | :------------ |
| Transient | SAP AI Core timeout, HANA connection blip | Y | N (retried silently) |
| Permanent | Invalid PDF, 404 on URL, bad API key | N | Y (inline error message) |
| Upstream | SAP AI Core 5xx, HANA Cloud unavailable | Y (max 3, exp backoff) | Degraded (toast notification) |
| User-caused | Missing required field, unsupported file type | N | Y (field-level validation message) |

### 8.2 Retry Policy
- Transient and upstream errors: max 3 attempts, exponential backoff starting at 500ms, jitter ±100ms.
- Applies to: SAP AI Core calls (C04), HANA Cloud queries (C05), Playwright fetches (C01/C02).

### 8.3 Circuit Breaker
Not implemented at MVP. If SAP AI Core is unavailable, C04 will exhaust retries and return a structured error to the caller. No automatic circuit-open state. Revisit if reliability issues emerge post-launch.

### 8.4 Graceful Degradation
- If SAP AI Core is unavailable: curation (ingestion without embedding) can proceed; generation is blocked with a clear error.
- If HANA Cloud is unavailable: all features requiring persistence are blocked; app shows a service-unavailable banner.
- If Playwright fails on a specific URL: that entry is skipped and an error logged; other entries in the same batch proceed.

### 8.5 User-Facing Errors
- Friendly, actionable messages only — no stack traces in UI.
- Each error includes a `requestId` for correlation with server logs.
- Toast notifications for background operation failures; inline field errors for validation failures.

### 8.6 Unhandled Exceptions
- Express global error handler catches all unhandled errors, logs them with `requestId`, `component`, `timestamp`, and `error.message`, and returns a `500` with a generic message.
- Process-level `uncaughtException` and `unhandledRejection` handlers log the error and exit (Kyma will restart the pod).

---

## 9. Notifications & Messaging

> **Audience:** Backend · Product

Not applicable. SAP BizAI Pulse has no notification or messaging requirements. No email, push, SMS, webhook, or in-app notification channels are used. Newsletter distribution is entirely the operator's responsibility after the publish action.

---

## 10. Observability & Analytics

> **Audience:** SRE · Product

### 10.1 Logging
- Structured JSON logs to stdout/stderr — picked up by Kyma log aggregation.
- Required fields per log entry: `timestamp`, `level` (info/warn/error), `component` (C01–C05), `requestId`, `message`.
- No PII in log payloads. Source URLs and filenames may appear in info logs.
- Log level configurable via `LOG_LEVEL` env var (default: `info`).

### 10.2 Distributed Tracing
Not implemented at MVP. `requestId` (UUID generated per request) is propagated through all log entries and included in API responses for manual correlation.

### 10.3 Metrics & SLOs

| Signal | SLI definition | SLO target | Owner |
| :----- | :------------- | :--------- | :---- |
| Availability | `/health` returns 200 | Best-effort (internal tool) | DevAgent |
| Generation latency | Time from "Generate" click to draft saved | < 5 min for ≤10 topics | DevAgent |
| Ingestion latency | Time from "Fetch Latest" click to entries saved | < 60s | DevAgent |

### 10.4 Alerting & On-Call
No formal alerting at MVP. Kyma pod restart handles process crashes. Manual monitoring via Kyma dashboard and application logs.

### 10.5 Dashboards
No dedicated dashboard at MVP. Kyma BTP cockpit provides basic pod health visibility.

### 10.6 Product Analytics
Not applicable. Internal tool; no user behaviour analytics platform.

---

## 11. Security

> **Audience:** Security · Backend · Compliance

### 11.1 Authentication

| Concern | Detail |
| :------ | :----- |
| Mechanism | Shared API key passed via `X-API-Key` request header |
| Provider | Self-managed — key stored as `API_KEY` environment variable in Kyma secret |
| Token expiry & refresh | No expiry at MVP; key rotated manually by operator |
| Revocation mechanism | Update `API_KEY` env var and redeploy |
| Intentionally public surfaces | `GET /published/:filename.html` (served HTML newsletters); `GET /health` |

### 11.2 Authorization

| Concern | Detail |
| :------ | :----- |
| Model | Single-role (all authenticated users have full access) |
| Roles & permissions | No role differentiation at MVP — admin and author share the same key |
| Enforcement layer | Express middleware validates `X-API-Key` header on all `/api/*` routes |
| Least-privilege confirmation | Only `/published/*` and `/health` are unauthenticated; all mutation endpoints require the key |

### 11.3 Data Sensitivity

- [x] Credentials / secrets — SAP AI Core credentials, HANA Cloud credentials, API key
- [x] Internal / proprietary — curated content tagged `Internal` must never appear in newsletter output
- [ ] PII — none collected
- [ ] PHI — not applicable
- [ ] Financial — not applicable
- [ ] Public only — newsletter-ready content and published HTML

Credentials: stored only in environment variables; never in source code, logs, or API responses.
Internal-tagged content: enforced at the generator layer — C02 filters to `Newsletter-ready` only before retrieval.

### 11.4 Encryption

| Concern | Standard |
| :------ | :------- |
| In transit | TLS 1.2+ — enforced by Kyma ingress for all external traffic; SAP AI Core and HANA Cloud connections are HTTPS/TLS |
| At rest | HANA Cloud managed encryption at rest (AES-256, SAP-managed keys) |
| Field-level | No additional field-level encryption beyond HANA Cloud storage encryption |

### 11.5 Input Validation & Output Encoding
- Server-side validation on all API inputs (required fields, type checks, file type enforcement for PDF upload).
- PDF upload: max 20MB, `.pdf` extension only, no executable content check at MVP.
- React frontend renders API responses via React's DOM (XSS-safe by default); published HTML is generated from trusted LLM output — markdown-it escapes HTML by default.
- SQL parameters passed via `@sap/hana-client` parameterised queries only — no string concatenation in SQL.

### 11.6 Secrets Management

| Concern | Detail |
| :------ | :----- |
| Secret store | Kyma Secrets (Kubernetes Secrets) injected as environment variables at runtime |
| No secrets in source / logs | Confirmed — credential values never logged or committed |
| Rotation policy | Manual rotation by operator; no automated rotation at MVP |
| Access audit | Kyma RBAC controls access to secrets; no application-level audit log for key usage |

### 11.7 Threat Surface & Known Risks
- External-facing surfaces: Kyma ingress (HTTPS only), `/published/*` static files, `/health`.
- All API routes behind `X-API-Key` middleware.
- Playwright scraping runs in the server container — untrusted HTML from SAP Community is parsed in headless Chromium sandbox; scraped text is treated as untrusted input and sanitised before storage.
- Dependency vulnerability posture: `npm audit` run as part of Dockerfile build; lockfile (`package-lock.json`) committed.
- Residual risk: API key is a shared secret with no per-user attribution. Accepted for MVP — see D_Decisions.

### 11.8 Compliance & Audit Hooks
No formal compliance standard applies (see §12). Application logs (structured JSON to stdout) serve as the audit trail for all ingestion and generation operations.

---

## 12. Compliance & Privacy

> **Audience:** Legal · Compliance · Security

### 12.1 Applicable Regulations

No external compliance regulations apply. Basis for conclusion:
- No PII from end users collected or stored.
- Newsletter consumers (SAP customers) receive the published HTML via operator-managed distribution — the application has no direct contact with those individuals.
- Content is SAP AI domain knowledge — no financial, health, or personal data.
- Internal tool operated by SAP employees on BTP — subject to SAP internal data handling policies, not external regulatory frameworks.

### 12.2 PII & Sensitive Data Inventory

| Data element | Classification | Source | Storage location | Retention | Disposal |
| :----------- | :------------- | :----- | :--------------- | :-------- | :------- |
| None | — | — | — | — | — |

### 12.3 Lawful Basis & Consent
Not applicable — no PII collected.

### 12.4 Data Subject Rights
Not applicable — no personal data stored.

### 12.5 Data Minimization
All stored fields have a documented purpose in the data model (§6.1). No analytics or telemetry pipelines. No "just in case" fields.

### 12.6 Cross-Border Transfers
HANA Cloud runs in `prod-eu10` (EU); SAP AI Core endpoint is `eu-central-1` (EU). No cross-border transfer concern for content data.

### 12.7 Audit Logging
Structured JSON logs (stdout) capture all ingestion events (source, type, sensitivity tag) and generation events (topic list, timestamp). No PII in payloads. Retained per Kyma log aggregation policy.

### 12.8 Incident & Breach Response
Internal SAP incident response procedures apply. No personal data at risk. No external notification obligations.

### 12.9 Third-Party & Vendor Obligations
SAP AI Core and HANA Cloud are SAP-internal services covered by SAP's existing enterprise agreements. No additional DPA/BAA required.

---

## 13. Third-Party Integrations

> **Audience:** Backend · Security

| Service / SDK | Type | Purpose | Failure mode | Fallback |
| :------------ | :--- | :------ | :----------- | :------- |
| SAP AI Core (gpt-4o) | External HTTPS API | Newsletter section generation | 5xx / timeout → retry (max 3) | Surface error to author; no generation |
| SAP AI Core (text-embedding-ada-002) | External HTTPS API | Embedding generation for curated entries | 5xx / timeout → retry (max 3) | Entry stored without embedding; vector search excludes it |
| HANA Cloud | External TCP (hana-client) | All data persistence and vector search | Connection failure → retry (max 3) | App shows service-unavailable; no data loss |
| SAP Community pages | External HTTPS (Playwright) | Auto-fetch and ad-hoc URL ingestion | Page unavailable / DOM change → skip + log | Partial results returned; error shown per URL |

---

## 14. Scalability

> **Audience:** Backend · SRE · Architecture

### 14.1 Load Profile

| Metric | At launch | At 10× growth |
| :----- | :-------- | :------------ |
| RPS / throughput | < 5 RPS (2–3 operators, infrequent use) | < 20 RPS (still internal tool) |
| Concurrent users | 1–2 | 5–10 |
| Data volume | ~500 content entries, ~20 newsletters | ~5,000 entries, ~200 newsletters |

### 14.2 Scaling Model
Single Node.js process in one Kyma pod. Stateless application layer — horizontal scaling possible (multiple pods behind Kyma ingress) but not required at MVP given load profile. HANA Cloud scales independently. Filesystem state (`./ready/`, `./published/`) is pod-local — multi-pod scaling would require shared persistent volume; deferred to post-MVP.

### 14.3 Bottlenecks & Mitigations

| Bottleneck | Component | Mitigation |
| :--------- | :-------- | :--------- |
| AI generation latency (gpt-4o per topic) | C02 | Streaming response to UI; per-topic progress display |
| Playwright cold start in container | C01, C02 | Reuse single Playwright browser instance across requests (lazy init, keep-alive) |
| HANA Cloud vector search at scale | C05 | HANA native HNSW vector index on embedding column; acceptable at projected data volumes |

---

## 15. Testing Strategy

> **Audience:** Engineers · QA

### 15.1 Coverage Matrix

| Test type | Applies | Owner | Minimum threshold |
| :-------- | :------ | :---- | :---------------- |
| Unit | N | — | None at MVP |
| Integration | N | — | None at MVP |
| End-to-end | N | — | None at MVP |
| Contract | N | — | None at MVP |
| Smoke (post-deploy) | Y | DevAgent | Manual — run full curation + generation flow after each deploy |

### 15.2 Critical Paths (manual smoke test checklist)
- Admin auto-fetch: new entries appear in curator list with correct metadata.
- Admin PDF upload: extracted text previewed; entry saved with `Internal` default tag.
- Admin URL ingestion: article fetched; entry saved.
- Sensitivity tag update: tag change persisted correctly.
- Newsletter generation: topic list suggested; draft `.md` saved to `./ready/`.
- Publish: draft converted to `.html`; accessible at `/published/` URL.
- Guardrail: non-SAP-AI content flagged or refused by generator.

### 15.3 Test Data & Fixtures
Manual testing uses real SAP Community articles and sample PDFs prepared by the operator. No test fixtures committed to source at MVP.

### 15.4 Constraints
No automated test framework mandated at MVP. Manual smoke testing is the gate for deployment readiness.

---

## 16. Deployment

> **Audience:** DevOps · SRE

### 16.1 Environment Matrix

| Environment | Purpose | Mirrors prod? | Access |
| :---------- | :------ | :------------ | :----- |
| dev | Local development via `npm run dev` on port 8080 | N | Engineers |
| prod | Kyma on BTP (`api.c-5a930ed.kyma.ondemand.com`) | — | Operators |

No staging environment at MVP — internal tool with a single small operator team.

### 16.2 Component Deployment Map

| Component | Platform | Region | Scaling model |
| :-------- | :------- | :----- | :------------ |
| C01 Content Curator | Kyma pod (same container) | EU10 | Single pod |
| C02 Newsletter Generator | Kyma pod (same container) | EU10 | Single pod |
| C03 Newsletter Lifecycle | Kyma pod (same container) | EU10 | Single pod |
| C04 AI Service | In-process (same container) | EU10 | Single pod |
| C05 Data Store | In-process client → HANA Cloud (external managed service) | EU10 | HANA Cloud managed |

All application components (C01–C04) run in a single Node.js process within one Docker container deployed as a Kyma workload.

### 16.3 Containerization
- Base image: `node:20-slim`
- Multi-stage build: stage 1 builds React frontend (Vite), stage 2 compiles TypeScript, stage 3 assembles production image with compiled JS + static frontend assets + Playwright Chromium.
- Local port: 8080 (HTTP)
- Image registry: SAP BTP Container Registry (or equivalent BTP-integrated registry)

### 16.4 Configuration & Secrets at Runtime

| Variable | Purpose | Source |
| :------- | :------ | :----- |
| `API_KEY` | Shared API key for request authentication | Kyma Secret |
| `HANA_HOST` | HANA Cloud hostname | Kyma Secret |
| `HANA_PORT` | HANA Cloud port | Kyma Secret |
| `HANA_USER` | HANA Cloud user | Kyma Secret |
| `HANA_PASSWORD` | HANA Cloud password | Kyma Secret |
| `AI_CORE_BASE_URL` | SAP AI Core API base URL | Kyma Secret |
| `AI_CORE_CLIENT_ID` | SAP AI Core OAuth client ID | Kyma Secret |
| `AI_CORE_CLIENT_SECRET` | SAP AI Core OAuth client secret | Kyma Secret |
| `AI_CORE_TOKEN_URL` | SAP AI Core token endpoint | Kyma Secret |
| `AI_CORE_LLM_DEPLOYMENT_ID` | gpt-4o deployment ID | Kyma ConfigMap |
| `AI_CORE_EMBED_DEPLOYMENT_ID` | text-embedding-ada-002 deployment ID | Kyma ConfigMap |
| `LOG_LEVEL` | Logging verbosity (`info` default) | Kyma ConfigMap |

### 16.5 Deploy Mechanism

| Concern | Detail |
| :------ | :----- |
| Trigger | Manual — operator builds and pushes Docker image, applies Kyma manifests |
| Deploy tool | `kubectl` / Kyma CLI (`kyma deploy`) |
| Rollback strategy | Re-deploy previous image tag via Kyma workload update |
| Health check signal | `GET /health` returns `200 { status: "ok" }` |

### 16.6 Deploy-Time Dependencies
- HANA Cloud instance must be running and reachable from Kyma cluster.
- SAP AI Core deployments (`deaf6d11f22b1764`, `df7d80b9631d2737`) must be active.
- Kyma Secrets for all env vars listed in §16.4 must be created before pod starts.
- HANA Cloud schema (tables + vector index) must be initialised before first use — migration script provided in `./deploy/`.

---

## 17. Libraries

> **Audience:** Engineers · Security
> 📦 Only libraries listed here (approved in `D_Decisions.md`) may be used in development.

| Library | Version | Purpose | License | Alternatives considered | Security notes |
| :------ | :------ | :------ | :------ | :---------------------- | :------------- |
| express | ^4.18 | HTTP server, routing, middleware | MIT | Fastify, NestJS | Mature, low CVE surface |
| @sap/hana-client | latest stable | HANA Cloud connectivity, SQL, vector search | SAP proprietary | None (BTP-required) | SAP-managed |
| axios | ^1.6 | HTTP client for SAP AI Core API calls | MIT | node-fetch, got | Pin version; audit regularly |
| playwright | ^1.40 | Headless Chromium for web scraping | Apache-2.0 | puppeteer, cheerio | Chromium sandbox; run as non-root |
| pdfjs-dist | ^4.0 | PDF text extraction | Apache-2.0 | pdf-parse | No native binaries |
| markdown-it | ^14.0 | Markdown → HTML conversion | MIT | marked, remark | HTML escaping on by default |
| @aws-sdk/client-s3 | ^3.0 | SAP Object Store file I/O (S3-compatible) | Apache-2.0 | aws-sdk v2 (monolithic) | Use with S3-compatible endpoint; credentials from env vars only |
| react | ^18.2 | Frontend UI framework | MIT | Vue, Svelte | — |
| react-dom | ^18.2 | React DOM renderer | MIT | — | — |
| vite | ^5.0 | Frontend build tool | MIT | webpack, parcel | — |
| bootstrap | ^5.3 | CSS framework | MIT | Tailwind, shadcn | CDN or bundled; no JS bundle needed |
| typescript | ^5.4 | Type-safe development across full stack | Apache-2.0 | — | — |
| uuid | ^9.0 | Request ID generation | MIT | crypto.randomUUID (built-in) | Use built-in if Node 20 available |

---

## 18. Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial architecture defined from A_Project.md ideation; all sections populated | 2026-05-03 | SpecGantry |
| D-TECH-S3CLIENT | Added `@aws-sdk/client-s3` to libraries — SAP Object Store confirmed S3-compatible during C03 detailed design | 2026-05-03 | SpecGantry |
