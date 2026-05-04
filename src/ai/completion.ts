import axios from 'axios';
import { getAccessToken, buildHeaders, withAIRetry } from './client';
import { loadPrompt, resolvePrompt } from './prompts';
import { AIServiceError } from './errors';
import type { CompletionOptions, CompletionResult } from './types';

function llmUrl(): string {
  const { AICORE_BASE_URL, AICORE_LLM_DEPLOYMENT_ID, AICORE_API_VERSION } = process.env;
  return `${AICORE_BASE_URL}/v2/inference/deployments/${AICORE_LLM_DEPLOYMENT_ID}/chat/completions?api-version=${AICORE_API_VERSION ?? '2024-02-01'}`;
}

// [F-C04-COMPLETE]
export async function generateCompletion(
  promptName: string,
  variables: Record<string, string>,
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const template = loadPrompt(promptName);
  const userContent = resolvePrompt(template, variables);
  const messages = [
    ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
    { role: 'user', content: userContent },
  ];

  return withAIRetry(async () => {
    const token = await getAccessToken();
    const res = await axios.post(llmUrl(), {
      model: process.env.AICORE_LLM_DEPLOYMENT_ID,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }, { headers: buildHeaders(token) });

    const choice = res.data.choices[0];
    return {
      content: choice.message.content as string,
      promptTokens: res.data.usage.prompt_tokens as number,
      completionTokens: res.data.usage.completion_tokens as number,
    };
  }, 'AI_COMPLETION_FAILED');
}

// [F-C04-STREAM]
export async function* generateCompletionStream(
  promptName: string,
  variables: Record<string, string>,
  options: CompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const template = loadPrompt(promptName);
  const userContent = resolvePrompt(template, variables);
  const messages = [
    ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
    { role: 'user', content: userContent },
  ];

  const token = await getAccessToken();
  let res;
  try {
    res = await axios.post(llmUrl(), {
      model: process.env.AICORE_LLM_DEPLOYMENT_ID,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    }, { headers: buildHeaders(token), responseType: 'stream' });
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    throw new AIServiceError('AI_COMPLETION_FAILED', 'Failed to open AI Core stream', status, err as Error);
  }

  let buffer = '';
  for await (const chunk of res.data) {
    buffer += (chunk as Buffer).toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content as string;
      } catch { /* malformed SSE line — skip */ }
    }
  }
}
