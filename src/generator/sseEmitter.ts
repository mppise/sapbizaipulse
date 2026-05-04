import { Response } from 'express';

// [F-C02-STREAM] SSE emitter helpers
export function sseStart(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setTimeout(0); // disable socket timeout for long-running SSE — [NFR-C02-SSECONN]
}

export function sseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function sseKeepAlive(res: Response): NodeJS.Timeout {
  return setInterval(() => res.write(': keep-alive\n\n'), 15_000);
}
