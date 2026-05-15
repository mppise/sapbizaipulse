---
name: c04-ai-service-specialized-specs
description: AI integration details and NFR thresholds for C04 AI Service.
license: Apache-2.0 (see LICENSE in project root)
---

# C04 AI Service — Specialized Specifications

---

## 1. AI Integration Details

### 1.1 Models and Deployments

| Model | Deployment ID | Endpoint suffix | Purpose |
| :---- | :------------ | :-------------- | :------ |
| gpt-4o | `deaf6d11f22b1764` (via `AI_CORE_LLM_DEPLOYMENT_ID`) | `/chat/completions` | Newsletter section generation, guardrail check |
| text-embedding-ada-002 | `df7d80b9631d2737` (via `AI_CORE_EMBED_DEPLOYMENT_ID`) | `/embeddings` | Content entry embedding |

Deployment IDs are injected via environment variables — no hardcoded values in source.

### 1.2 Default Completion Parameters

| Parameter | Default | Override allowed |
| :-------- | :------ | :--------------- |
| `temperature` | `0.7` | Yes — via `CompletionOptions.temperature` |
| `max_tokens` | `2048` | Yes — via `CompletionOptions.maxTokens` |
| `stream` | `false` for `generateCompletion`; `true` for `generateCompletionStream` | No — determined by function |

### 1.3 Guardrail Prompt Design

The `guardrail-check.md` prompt must:

1. Instruct the LLM to evaluate whether the provided content is **exclusively** about SAP AI technologies, products, or ecosystem.
2. Instruct the LLM to flag any language that gives explicit guidance, recommendations, or directives (e.g. "you should", "we recommend", "best practice is to").
3. Instruct the LLM to respond **only** with the structured JSON object — no prose before or after.
4. Include a one-shot example of a passing and a failing response to anchor the output format.

### 1.4 Streaming Protocol

`generateCompletionStream()` uses SAP AI Core's OpenAI-compatible SSE stream:

- Sets `stream: true` in the request body.
- Uses `axios` with `responseType: 'stream'`.
- Parses each `data: <json>` line; extracts `choices[0].delta.content`.
- Yields each non-null content chunk to the caller.
- On `data: [DONE]`, the generator returns.
- On stream error mid-flight: throws `AIServiceError (AI_COMPLETION_FAILED)` — caller is responsible for handling partial output.

---

## 2. Non-Functional Requirements

| ID | Requirement | Threshold | Measurement | Priority |
| :- | :---------- | :-------- | :---------- | :------: |
| NFR-C04-RETRY | Retry transient AI Core errors (5xx, 429, timeout) | Max 3 attempts; exponential backoff 500ms → 1000ms → 2000ms ± 100ms jitter | Error logs show attempt count | P0 |
| NFR-C04-TOKENC | Token cache must prevent redundant token requests | Token refreshed at most once per expiry window; no per-request token fetch | Log shows single token fetch per window | P1 |
| NFR-C04-NOSECRET | Credentials must never appear in logs, errors, or API responses | 0 occurrences | Code review / log audit | P0 |
| NFR-C04-EMBED | Embedding call must return a 1536-element float array | Validated on response; throw `AI_EMBEDDING_FAILED` if dimension mismatch | Unit assertion | P0 |

---

## 3. Retry Table

| Attempt | Delay before retry | Eligible errors |
| :------ | :----------------- | :-------------- |
| 1 (initial) | — | — |
| 2 | 500ms ± 100ms | HTTP 5xx, 429, `ECONNRESET`, `ETIMEDOUT` |
| 3 | 1000ms ± 100ms | same |
| 4 (final fail) | — | Throw `AIServiceError` |

**Non-retryable errors:** HTTP 400 (bad request), HTTP 401 (invalid token — re-fetch token once then fail), HTTP 404 (deployment not found). Throw immediately.

**Special case — 401:** On a 401 response, invalidate the token cache and re-acquire the token once. If the retry with the fresh token also returns 401, throw `AI_TOKEN_FAILED`.

---

## 4. Prompt Variable Substitution

`resolvePrompt()` performs a simple global string replacement:

- Pattern: `{{variable_name}}` (double curly braces, no spaces inside).
- All occurrences of each key in the `variables` map are replaced.
- If a placeholder exists in the template but is not present in `variables`, it is left as-is and a `warn` log entry is emitted — no error thrown.
- Variable values are not HTML-escaped by C04; callers are responsible for sanitising inputs before passing to prompts.

### 4.1 Section Generation Prompt Variables

| Variable | Supplied by | Notes |
| :------- | :---------- | :---- |
| `{{topic}}` | `pipelineWorker.ts` | Topic title string |
| `{{content_plan}}` | `pipelineWorker.ts` | Numbered list of `contentPlan` bullets from Pass 2; empty string if no plan available |
| `{{supporting_content}}` | `pipelineWorker.ts` | Formatted persona vector search results (up to 5 × 2,000 chars) |
| `{{sources}}` | `pipelineWorker.ts` | Numbered list of source titles and URLs |

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
| CHG-TOPIC-PLAN | §4 updated: added §4.1 section generation prompt variables table documenting content_plan injection | 2026-05-15 | SpecGantry |
