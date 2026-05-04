import axios from 'axios';
import { AIServiceError } from './errors';

// [F-C04-TOKEN] OAuth2 token cache
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const { AICORE_AUTH_URL, AICORE_CLIENT_ID, AICORE_CLIENT_SECRET } = process.env;
  if (!AICORE_AUTH_URL || !AICORE_CLIENT_ID || !AICORE_CLIENT_SECRET) {
    throw new AIServiceError('AI_TOKEN_FAILED', 'Missing required AICORE_AUTH_URL / AICORE_CLIENT_ID / AICORE_CLIENT_SECRET env vars');
  }

  try {
    const res = await axios.post(
      `${AICORE_AUTH_URL}/oauth/token`,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        auth: { username: AICORE_CLIENT_ID, password: AICORE_CLIENT_SECRET },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    cachedToken = res.data.access_token as string;
    // Refresh 60s before expiry
    tokenExpiresAt = Date.now() + (res.data.expires_in as number) * 1000 - 60_000;
    return cachedToken;
  } catch (err) {
    cachedToken = null;
    tokenExpiresAt = 0;
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    throw new AIServiceError('AI_TOKEN_FAILED', 'Failed to acquire SAP AI Core access token', status, err as Error);
  }
}

export function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'AI-Resource-Group': process.env.AICORE_RESOURCE_GROUP ?? 'default',
    'Content-Type': 'application/json',
  };
}

// [F-C04-RETRY] Retry wrapper for AI Core calls
export async function withAIRetry<T>(fn: () => Promise<T>, errorCode: AIServiceError['code']): Promise<T> {
  const delays = [0, 500, 1000, 2000];
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const jitter = Math.floor(Math.random() * 200) - 100;
      await new Promise((r) => setTimeout(r, delays[attempt] + jitter));
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err as Error;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        // 401: invalidate token and retry once
        if (status === 401 && attempt === 0) { cachedToken = null; tokenExpiresAt = 0; continue; }
        // Non-retryable: 400, 404
        if (status === 400 || status === 404) throw new AIServiceError(errorCode, `AI Core returned ${status}`, status, err);
      }
    }
  }
  const status = axios.isAxiosError(lastErr) ? lastErr.response?.status : undefined;
  throw new AIServiceError(errorCode, `AI Core request failed after 3 attempts`, status, lastErr);
}
