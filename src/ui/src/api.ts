export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
  }
}

const BASE = '/api/v1';

function getApiKey(): string {
  return localStorage.getItem('apiKey') ?? '';
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getApiKey(),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error ?? {};
    throw new ApiError(err.code ?? 'UNKNOWN', err.message ?? `HTTP ${res.status}`, err.requestId);
  }

  const contentLength = res.headers.get('content-length');
  const hasBody = res.status !== 204 && contentLength !== '0';
  if (!hasBody) return undefined as T;
  return res.json().then((body) => body.data ?? body);
}

export async function apiFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'X-API-Key': getApiKey(),
      ...(options.headers ?? {}),
    },
  });
  return res;
}
