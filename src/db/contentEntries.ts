import { v4 as uuidv4 } from 'uuid';
import { getConnection } from './pool';
import { execQuery, withRetry } from './util';
import { DataStoreError } from './errors';
import type {
  ContentEntry,
  ContentEntryMeta,
  InsertContentEntryInput,
  UpdateContentEntryInput,
  Sensitivity,
} from './types';

// [F-C05-CE-INSERT]
export async function insertContentEntry(input: InsertContentEntryInput): Promise<string> {
  const id = uuidv4();
  await withRetry(async () => {
    const conn = getConnection();
    try {
      await execQuery(conn,
        `INSERT INTO content_entries (id, title, body_text, source_type, source_ref, sensitivity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, input.title, input.bodyText ?? '', input.sourceType, input.sourceRef, input.sensitivity]
      );
    } finally { conn.disconnect(); }
  });
  return id;
}

// [F-C05-CE-UPSERT-VEC]
export async function updateContentEntryEmbedding(id: string, embedding: number[]): Promise<void> {
  await withRetry(async () => {
    const conn = getConnection();
    try {
      const vec = `[${embedding.join(',')}]`;
      await execQuery(conn,
        `UPDATE content_entries SET embedding = TO_REAL_VECTOR(?) WHERE id = ?`,
        [vec, id]
      );
    } finally { conn.disconnect(); }
  });
}

// [F-C05-CE-UPDATE-BODY]
export async function updateContentEntryBodyText(id: string, bodyText: string): Promise<void> {
  await withRetry(async () => {
    const conn = getConnection();
    try {
      await execQuery(conn,
        `UPDATE content_entries SET body_text = ? WHERE id = ?`,
        [bodyText, id]
      );
    } finally { conn.disconnect(); }
  });
}

// [F-C05-CE-READ]
export async function getContentEntry(id: string): Promise<ContentEntry> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      const rows = await execQuery<Record<string, unknown>>(conn,
        `SELECT id, title, body_text, source_type, source_ref, ingestion_date, approved_at, sensitivity
         FROM content_entries WHERE id = ?`,
        [id]
      );
      if (!rows.length) throw new DataStoreError('DS_NOT_FOUND', `Content entry not found: ${id}`);
      return mapContentEntry(rows[0]);
    } finally { conn.disconnect(); }
  });
}

// [F-C05-CE-LIST-TIMEFRAME] List Newsletter-ready entries approved within the timeframe
export async function listContentEntriesInTimeframe(from: Date): Promise<ContentEntry[]> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      const rows = await execQuery<Record<string, unknown>>(conn,
        `SELECT id, title, body_text, source_type, source_ref, ingestion_date, approved_at, sensitivity
         FROM content_entries
         WHERE sensitivity = 'Newsletter-ready' AND approved_at > ?
         ORDER BY approved_at DESC`,
        [from.toISOString()]
      );
      return rows.map(mapContentEntry);
    } finally { conn.disconnect(); }
  });
}

// [F-C05-CE-LIST]
export async function listContentEntries(filter?: { sensitivity?: Sensitivity }): Promise<ContentEntryMeta[]> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      const params: string[] = [];
      let sql = `SELECT id, title, source_type, source_ref, ingestion_date, approved_at, sensitivity FROM content_entries`;
      if (filter?.sensitivity) {
        sql += ` WHERE sensitivity = ?`;
        params.push(filter.sensitivity);
      }
      sql += ` ORDER BY ingestion_date DESC`;
      const rows = await execQuery<Record<string, unknown>>(conn, sql, params);
      return rows.map(mapContentEntryMeta);
    } finally { conn.disconnect(); }
  });
}

// [F-C05-CE-UPDATE]
export async function updateContentEntry(id: string, input: UpdateContentEntryInput): Promise<void> {
  if (!input.title && !input.sensitivity && !input.approvedAt) return;
  await withRetry(async () => {
    const conn = getConnection();
    try {
      const sets: string[] = [];
      const params: (string | null)[] = [];
      if (input.title)      { sets.push('title = ?');       params.push(input.title); }
      if (input.sensitivity){ sets.push('sensitivity = ?'); params.push(input.sensitivity); }
      if (input.approvedAt) { sets.push('approved_at = ?'); params.push(input.approvedAt.toISOString()); }
      params.push(id);
      await execQuery<Record<string, unknown>>(conn,
        `UPDATE content_entries SET ${sets.join(', ')} WHERE id = ?`, params
      );
    } finally { conn.disconnect(); }
  });
  await getContentEntry(id);
}

// [F-C05-CE-DELETE]
export async function deleteContentEntry(id: string): Promise<void> {
  await getContentEntry(id); // throws DS_NOT_FOUND if missing
  await withRetry(async () => {
    const conn = getConnection();
    try {
      await execQuery(conn, `DELETE FROM content_entries WHERE id = ?`, [id]);
    } finally { conn.disconnect(); }
  });
}

// [F-C05-CE-DUPCHECK]
export async function contentEntryExistsBySourceRef(sourceRef: string): Promise<boolean> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      const rows = await execQuery<Record<string, unknown>>(conn,
        `SELECT COUNT(*) AS cnt FROM content_entries WHERE source_ref = ?`, [sourceRef]
      );
      return Number(rows[0]?.CNT ?? rows[0]?.cnt ?? 0) > 0;
    } finally { conn.disconnect(); }
  });
}

function mapContentEntry(row: Record<string, unknown>): ContentEntry {
  const approvedRaw = row.APPROVED_AT ?? row.approved_at;
  return {
    id: row.ID as string ?? row.id as string,
    title: row.TITLE as string ?? row.title as string,
    bodyText: row.BODY_TEXT as string ?? row.body_text as string,
    sourceType: (row.SOURCE_TYPE ?? row.source_type) as ContentEntry['sourceType'],
    sourceRef: row.SOURCE_REF as string ?? row.source_ref as string,
    ingestionDate: new Date((row.INGESTION_DATE ?? row.ingestion_date) as string),
    approvedAt: approvedRaw ? new Date(approvedRaw as string) : null,
    sensitivity: (row.SENSITIVITY ?? row.sensitivity) as ContentEntry['sensitivity'],
    embedding: null,
  };
}

function mapContentEntryMeta(row: Record<string, unknown>): ContentEntryMeta {
  const approvedRaw = row.APPROVED_AT ?? row.approved_at;
  return {
    id: row.ID as string ?? row.id as string,
    title: row.TITLE as string ?? row.title as string,
    sourceType: (row.SOURCE_TYPE ?? row.source_type) as ContentEntry['sourceType'],
    sourceRef: row.SOURCE_REF as string ?? row.source_ref as string,
    ingestionDate: new Date((row.INGESTION_DATE ?? row.ingestion_date) as string),
    approvedAt: approvedRaw ? new Date(approvedRaw as string) : null,
    sensitivity: (row.SENSITIVITY ?? row.sensitivity) as ContentEntry['sensitivity'],
  };
}
