import { getConnection } from './pool';
import { execQuery, withRetry } from './util';
import { DataStoreError } from './errors';
import type { VectorSearchResult, ContentEntry } from './types';

// [F-C05-VEC-SEARCH]
export async function vectorSearch(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      const vec = `[${queryEmbedding.join(',')}]`;
      const rows = await execQuery<Record<string, unknown>>(conn,
        `SELECT TOP ? id, title, body_text, source_type, source_ref, ingestion_date, approved_at, sensitivity,
                COSINE_SIMILARITY(embedding, TO_REAL_VECTOR(?)) AS score
         FROM content_entries
         WHERE sensitivity = 'Newsletter-ready'
           AND embedding IS NOT NULL
         ORDER BY score DESC`,
        [topK, vec]
      );
      return rows.map((row) => {
        const approvedRaw = row.APPROVED_AT ?? row.approved_at;
        const publishedRaw = row.PUBLISHED_DATE ?? row.published_date;
        return {
          entry: {
            id: row.ID as string ?? row.id as string,
            title: row.TITLE as string ?? row.title as string,
            bodyText: row.BODY_TEXT as string ?? row.body_text as string ?? '',
            sourceType: (row.SOURCE_TYPE ?? row.source_type) as ContentEntry['sourceType'],
            sourceRef: row.SOURCE_REF as string ?? row.source_ref as string,
            ingestionDate: new Date((row.INGESTION_DATE ?? row.ingestion_date) as string),
            publishedDate: publishedRaw ? new Date(publishedRaw as string) : null,
            approvedAt: approvedRaw ? new Date(approvedRaw as string) : null,
            sensitivity: (row.SENSITIVITY ?? row.sensitivity) as ContentEntry['sensitivity'],
            embedding: null,
          },
          score: Number(row.SCORE ?? row.score ?? 0),
        };
      });
    } finally {
      conn.disconnect();
    }
  });
}

// [F-C05-HEALTH]
export async function ping(): Promise<true> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      await execQuery(conn, 'SELECT 1 FROM DUMMY');
      return true as const;
    } catch (err) {
      throw new DataStoreError('DS_CONN_FAILED', 'HANA ping failed', err as Error);
    } finally {
      conn.disconnect();
    }
  });
}
