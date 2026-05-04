export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface CompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}
