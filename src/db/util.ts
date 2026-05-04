import hana from '@sap/hana-client';
import { DataStoreError } from './errors';

// Retry helper — [NFR-C05-RETRY]
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [0, 500, 1000];
  const jitter = () => Math.floor(Math.random() * 200) - 100;
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt] + jitter()));
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err as Error;
      if (err instanceof DataStoreError && (err.code === 'DS_NOT_FOUND' || err.code === 'DS_DUPLICATE')) {
        throw err;
      }
      console.error(JSON.stringify({ level: 'error', component: 'db', message: `HANA attempt ${attempt + 1} failed`, detail: (err as Error).message }));
    }
  }
  throw new DataStoreError('DS_QUERY_FAILED', 'HANA query failed after 3 attempts', lastErr);
}

// Execute a parameterised query and return rows — [NFR-C05-PARAMQ]
export function execQuery<T>(
  conn: hana.Connection,
  sql: string,
  params: hana.HanaParameterType[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.exec<T[]>(sql, params, (err: Error, rows?: T[]) => {
      if (err) reject(err);
      else resolve(rows ?? []);
    });
  });
}
