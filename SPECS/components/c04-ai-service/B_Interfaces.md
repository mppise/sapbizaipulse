---
name: c04-ai-service-interfaces
description: Interface specification for C04 AI Service — all exported function signatures and their contracts.
license: Apache-2.0 (see LICENSE in project root)
---

# C04 AI Service — Interfaces

> C04 exposes in-process TypeScript functions only. No REST endpoints. No events.

---

## 1. Module Structure

```
src/
  ai/
    index.ts          -- public exports (re-exports from sub-modules)
    client.ts         -- axios instance, token acquisition and cache, request dispatch
    completion.ts     -- generateCompletion(), generateCompletionStream()
    embedding.ts      -- generateEmbedding()
    guardrail.ts      -- checkGuardrail()
    prompts.ts        -- loadPrompt(), resolvePrompt()
    errors.ts         -- AIServiceError class and error codes
    types.ts          -- shared TypeScript types/interfaces
    prompts/
      generate-executive-summary.md
      generate-leadership-execution.md
      generate-technical-insight.md
      guardrail-check.md
```

---

## 2. Shared Types

```typescript
// types.ts

export interface CompletionOptions {
  temperature?: number;     // default: 0.7
  maxTokens?: number;       // default: 2048
  systemPrompt?: string;    // optional system message prepended to the conversation
}

export interface CompletionResult {
  content: string;          // full generated text
  promptTokens: number;
  completionTokens: number;
}

export interface GuardrailResult {
  pass: boolean;
  flaggedExcerpt?: string;  // excerpt that triggered failure, if pass === false
  reason?: string;          // brief explanation from the LLM, if pass === false
}

export type AIServiceErrorCode =
  | 'AI_TOKEN_FAILED'
  | 'AI_COMPLETION_FAILED'
  | 'AI_EMBEDDING_FAILED'
  | 'AI_PROMPT_NOT_FOUND'
  | 'AI_GUARDRAIL_FAILED';
```

---

## 3. Error Class

```typescript
// errors.ts

export class AIServiceError extends Error {
  readonly code: AIServiceErrorCode;
  readonly statusCode?: number;   // HTTP status from AI Core, if available
  readonly cause?: Error;
  constructor(
    code: AIServiceErrorCode,
    message: string,
    statusCode?: number,
    cause?: Error
  );
}
```

---

## 4. Prompt Functions

```typescript
// prompts.ts

/**
 * Load a prompt template from ./src/ai/prompts/<name>.md.
 * Returns the raw Markdown string.
 * Throws AIServiceError (AI_PROMPT_NOT_FOUND) if the file does not exist.
 */
export function loadPrompt(name: string): string;

/**
 * Resolve a prompt template by substituting {{variable}} placeholders
 * with the provided values map.
 * Returns the resolved prompt string.
 */
export function resolvePrompt(
  template: string,
  variables: Record<string, string>
): string;
```

---

## 5. Completion Functions

```typescript
// completion.ts

/**
 * Send a non-streaming chat completion request to gpt-4o.
 * Loads and resolves the named prompt template before sending.
 * Retries on transient errors (max 3, exponential backoff).
 * Throws AIServiceError (AI_COMPLETION_FAILED) on permanent failure.
 */
export async function generateCompletion(
  promptName: string,
  variables: Record<string, string>,
  options?: CompletionOptions
): Promise<CompletionResult>;

/**
 * Send a streaming chat completion request to gpt-4o.
 * Yields string chunks as they arrive from SAP AI Core SSE stream.
 * Loads and resolves the named prompt template before sending.
 * Throws AIServiceError (AI_COMPLETION_FAILED) if the stream cannot be opened
 * or if a retryable error is exhausted before the stream starts.
 *
 * Usage:
 *   for await (const chunk of generateCompletionStream(name, vars)) {
 *     res.write(chunk);
 *   }
 */
export async function* generateCompletionStream(
  promptName: string,
  variables: Record<string, string>,
  options?: CompletionOptions
): AsyncGenerator<string, void, unknown>;
```

**Request format sent to SAP AI Core (OpenAI-compatible):**

```json
{
  "model": "<AI_CORE_LLM_DEPLOYMENT_ID>",
  "messages": [
    { "role": "system", "content": "<systemPrompt if provided>" },
    { "role": "user",   "content": "<resolved prompt>" }
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": true
}
```

**Required headers on every AI Core request:**

```
Authorization: Bearer <cached_access_token>
AI-Resource-Group: default
Content-Type: application/json
```

---

## 6. Embedding Function

```typescript
// embedding.ts

/**
 * Generate a 1536-dimension text embedding vector for the given input text.
 * Uses the text-embedding-ada-002 deployment (AI_CORE_EMBED_DEPLOYMENT_ID).
 * Retries on transient errors (max 3, exponential backoff).
 * Throws AIServiceError (AI_EMBEDDING_FAILED) on permanent failure.
 */
export async function generateEmbedding(text: string): Promise<number[]>;
```

**Request format:**

```json
{
  "input": "<text>",
  "model": "<AI_CORE_EMBED_DEPLOYMENT_ID>"
}
```

**Response extraction:** `response.data.data[0].embedding` — array of 1536 floats.

---

## 7. Guardrail Function

```typescript
// guardrail.ts

/**
 * Run a guardrail check on a generated content string.
 * Loads guardrail-check.md, resolves {{generated_content}}, sends as a
 * non-streaming completion request.
 * Returns a GuardrailResult — pass:true if content is within SAP AI domain
 * and uses educational tone; pass:false with flaggedExcerpt if not.
 * Throws AIServiceError (AI_GUARDRAIL_FAILED) if the LLM call itself fails.
 */
export async function checkGuardrail(content: string): Promise<GuardrailResult>;
```

**Guardrail prompt contract (`guardrail-check.md`):**

The prompt instructs the LLM to respond with a structured JSON object:

```json
{
  "pass": true | false,
  "flaggedExcerpt": "<string or null>",
  "reason": "<string or null>"
}
```

`checkGuardrail()` parses this JSON from the completion response. If the LLM returns malformed JSON, the result is treated as `pass: false` with `reason: "Guardrail response unparseable"`.

---

## 8. Token Acquisition (internal — not exported)

```typescript
// client.ts (internal)

// Module-level cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;  // Unix ms

async function getAccessToken(): Promise<string>;
// POST AI_CORE_TOKEN_URL with client_credentials grant
// Caches token; refreshes 60s before expiry
// Throws AIServiceError (AI_TOKEN_FAILED) on failure
```

**Token request (x-www-form-urlencoded):**

```
grant_type=client_credentials
client_id=<AI_CORE_CLIENT_ID>
client_secret=<AI_CORE_CLIENT_SECRET>
```

---

## 9. Consumed Services

| Service | Endpoint | Auth | Notes |
| :------ | :------- | :--- | :---- |
| SAP AI Core — token | `AI_CORE_TOKEN_URL` (POST) | Client credentials | x-www-form-urlencoded |
| SAP AI Core — LLM | `.../deployments/{LLM_ID}/chat/completions` (POST) | Bearer token | OpenAI-compatible |
| SAP AI Core — embeddings | `.../deployments/{EMBED_ID}/embeddings` (POST) | Bearer token | OpenAI-compatible |

---

## 10. Events

C04 produces no events and consumes no events.

---

## Change History

| ID | Description | Date | Author |
| :- | :---------- | :--: | :----- |
| — | Initial specification created | 2026-05-03 | SpecGantry |
