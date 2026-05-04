import hana from '@sap/hana-client';
import { DataStoreError } from './errors';

let pool: hana.ConnectionPool | null = null;

// [F-C05-CONNPOOL] Connection pool lifecycle
export async function initPool(): Promise<void> {
  const { HANA_HOST, HANA_PORT, HANA_USER, HANA_PASSWORD } = process.env;
  if (!HANA_HOST || !HANA_PORT || !HANA_USER || !HANA_PASSWORD) {
    throw new DataStoreError('DS_CONN_FAILED', 'Missing required HANA_* environment variables');
  }
  try {
    pool = hana.createPool(
      { serverNode: `${HANA_HOST}:${HANA_PORT}`, uid: HANA_USER, pwd: HANA_PASSWORD, encrypt: true, sslValidateCertificate: false },
      { min: 2, max: 10, acquireTimeout: 5000, idleTimeout: 30000 }
    );
    // Verify connectivity at startup
    const conn = pool.getConnection();
    await new Promise<void>((resolve, reject) => {
      conn.exec('SELECT 1 FROM DUMMY', (err: Error) => {
        conn.disconnect();
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    throw new DataStoreError('DS_CONN_FAILED', 'Failed to initialise HANA connection pool', err as Error);
  }
}

export function getConnection(): hana.Connection {
  if (!pool) throw new DataStoreError('DS_CONN_FAILED', 'Connection pool not initialised — call initPool() first');
  return pool.getConnection();
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await new Promise<void>((resolve) => pool!.clear(() => resolve()));
  pool = null;
}
