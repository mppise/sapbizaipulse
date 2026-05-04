---
name: c04-ai-service-core-spec
description: Core specification for C04 AI Service — SAP AI Core wrapper for LLM completion and text embedding.
license: Apache-2.0 (see LICENSE in project root)
---

# C04 AI Service — Core Specification

> Shared internal library. Wraps all SAP AI Core API interactions — LLM completion (gpt-4o) and text embedding (text-embedding-ada-002). No business logic. All callers (C01, C02) go through this component exclusively.

---

## 1. Purpose

C04 is the single integration point with SAP AI Core. It:

- Acquires and caches OAuth2 access tokens from the SAP AI Core token endpoint.
- Formats and dispatches completion requests to the gpt-4o deployment.
- Formats and dispatches embedding requests to the text-embedding-ada-002 deployment.
- Implements retry logic (max 3, exponential backoff) for transient AI Core errors.
- Surfaces structured `AIServiceError` to callers on permanent or exhausted failures.
- Loads prompt templates from `./src/ai/prompts/` at call time.

C04 has no knowledge of content entries, newsletters, or any domain concept — it only knows about prompts, completions, and embedding vectors.

---

## 2. Features

| Status | ID | Description | Priority | Doc Level |
| :----: | :- | :---------- | :------: | :-------: |
| `Complete` | F-C04-TOKEN | Acquire an OAuth2 access token from `AI_CORE_TOKEN_URL` using client credentials (`AI_CORE_CLIENT_ID` / `AI_CORE_CLIENT_SECRET`); cache the token until 60s before expiry; refresh automatically on next call | P0 | - |
| `Complete` | F-C04-COMPLETE | Send a chat completion request to the gpt-4o deployment (`AI_CORE_LLM_DEPLOYMENT_ID`) and return the response content string | P0 | - |
| `Complete` | F-C04-STREAM | Send a streaming chat completion request (SSE) and yield chunks progressively to the caller via an async generator | P0 | - |
| `Complete` | F-C04-EMBED | Send a text embedding request to the text-embedding-ada-002 deployment (`AI_CORE_EMBED_DEPLOYMENT_ID`) and return the 1536-dimension vector | P0 | - |
| `Complete` | F-C04-PROMPT | Load a prompt template from `./src/ai/prompts/<name>.md`, perform variable substitution (`{{variable}}`), and return the resolved prompt string | P0 | - |
| `Complete` | F-C04-RETRY | Retry transient AI Core errors (5xx, timeout, 429) up to 3 times with exponential backoff; throw `AIServiceError` after exhausting retries | P0 | - |
| `Complete` | F-C04-GUARDRAIL | Send a guardrail check prompt to the LLM to verify that generated content is within the SAP AI domain and uses educational (non-guidance) tone; return a structured result (`pass` / `fail` + flagged excerpt) | P0 | - |

---

## 3. Dependencies

| Dependency | Type | Direction | Notes |
| :--------- | :--- | :-------- | :---- |
| SAP AI Core API | External HTTPS REST API | Outbound | Base URL: `AI_CORE_BASE_URL` env var; OpenAI-compatible chat completions and embeddings endpoints |
| `axios` | Library | Consumed | HTTP client for all AI Core requests |
| Prompt files in `./src/ai/prompts/` | File system | Consumed | Markdown files loaded at call time; one file per prompt |

C04 has **no dependencies on other application components** (C01, C02, C03, C05).

---

## 4. Prompt Files

All prompts are stored as Markdown files under `./src/ai/prompts/`. Variable placeholders use `{{variable_name}}` syntax.

| File | Used by | Variables |
| :--- | :------ | :-------- |
| `generate-executive-summary.md` | C02 | `{{topic}}`, `{{supporting_content}}` |
| `generate-leadership-execution.md` | C02 | `{{topic}}`, `{{supporting_content}}` |
| `generate-technical-insight.md` | C02 | `{{topic}}`, `{{supporting_content}}` |
| `guardrail-check.md` | C04 (F-C04-GUARDRAIL) | `{{generated_content}}` |

Prompt files are versioned in source control. Changing a prompt does not require a code change — only a file edit and redeploy.

---

## 5. Data Flows

### 5.1 Inbound (callers invoking C04)

| Caller | Operation | C04 function |
| :----- | :-------- | :----------- |
| C01 Content Curator | Generate embedding for ingested entry | `generateEmbedding(text)` |
| C02 Newsletter Generator | Generate newsletter section (streaming) | `generateCompletionStream(promptName, vars)` |
| C02 Newsletter Generator | Generate newsletter section (non-streaming) | `generateCompletion(promptName, vars)` |
| C02 Newsletter Generator | Guardrail check on generated section | `checkGuardrail(content)` |

### 5.2 Outbound (C04 calling external systems)

| Target | Endpoint pattern | Purpose |
| :----- | :--------------- | :------ |
| SAP AI Core token endpoint | `AI_CORE_TOKEN_URL` (POST) | OAuth2 client credentials token acquisition |
| SAP AI Core LLM | `AI_CORE_BASE_URL/v2/inference/deployments/{AI_CORE_LLM_DEPLOYMENT_ID}/chat/completions` | Chat completions (gpt-4o) |
| SAP AI Core Embeddings | `AI_CORE_BASE_URL/v2/inference/deployments/{AI_CORE_EMBED_DEPLOYMENT_ID}/embeddings` | Text embeddings (text-embedding-ada-002) |

---

## 6. Token Cache

The OAuth2 access token is cached in-process (module-level variable):

- On first call: fetch token, cache it with its `expires_in` value minus a 60-second safety margin.
- On subsequent calls: return the cached token if it has not expired.
- On expiry: fetch a fresh token transparently before the next API call.
- Token is never written to disk, logged, or included in API responses.

---

## 7. Execution Mode

- **Synchronous** (async/await) for completion and embedding calls.
- **Streaming** (async generator, SSE) for `generateCompletionStream()`.
- No background workers, queues, or event emitters.
- All functions are `async` and throw `AIServiceError` on unrecoverable failure.

---

## 8. Error Handling

All public functions wrap AI Core errors in an `AIServiceError`:

| Field | Type | Description |
| :---- | :--- | :---------- |
| `code` | `string` | Stable error code (see codes table below) |
| `message` | `string` | Human-readable description |
| `statusCode` | `number \| undefined` | HTTP status from AI Core if available |
| `cause` | `Error \| undefined` | Original axios error |

| Code | Meaning |
| :--- | :------ |
| `AI_TOKEN_FAILED` | Could not acquire or refresh OAuth2 token |
| `AI_COMPLETION_FAILED` | Completion request failed after retries exhausted |
| `AI_EMBEDDING_FAILED` | Embedding request failed after retries exhausted |
| `AI_PROMPT_NOT_FOUND` | Prompt file not found at expected path |
| `AI_GUARDRAIL_FAILED` | Guardrail check request failed |

---

## 9. Configuration

All credentials and deployment IDs are read from environment variables at startup.

| Env var | Purpose |
| :------ | :------ |
| `AI_CORE_BASE_URL` | SAP AI Core API base URL |
| `AI_CORE_TOKEN_URL` | OAuth2 token endpoint URL |
| `AI_CORE_CLIENT_ID` | OAuth2 client ID |
| `AI_CORE_CLIENT_SECRET` | OAuth2 client secret |
| `AI_CORE_LLM_DEPLOYMENT_ID` | gpt-4o deployment ID (`deaf6d11f22b1764`) |
| `AI_CORE_EMBED_DEPLOYMENT_ID` | text-embedding-ada-002 deployment ID (`df7d80b9631d2737`) |

No defaults are provided for credential values — startup fails fast if any are missing.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
