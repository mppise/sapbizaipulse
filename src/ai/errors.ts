export type AIServiceErrorCode =
  | 'AI_TOKEN_FAILED'
  | 'AI_COMPLETION_FAILED'
  | 'AI_EMBEDDING_FAILED'
  | 'AI_PROMPT_NOT_FOUND';

export class AIServiceError extends Error {
  readonly code: AIServiceErrorCode;
  readonly statusCode?: number;
  readonly cause?: Error;

  constructor(code: AIServiceErrorCode, message: string, statusCode?: number, cause?: Error) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}
