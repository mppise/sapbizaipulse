import { v4 as uuidv4 } from 'uuid';
import { getConnection } from './pool';
import { execQuery, withRetry } from './util';
import { DataStoreError } from './errors';
import type { Newsletter, InsertNewsletterInput, UpdateNewsletterInput } from './types';

// [F-C05-NL-INSERT]
export async function insertNewsletter(input: InsertNewsletterInput): Promise<string> {
  const id = uuidv4();
  await withRetry(async () => {
    const conn = getConnection();
    try {
      await execQuery(conn,
        `INSERT INTO newsletters (id, filename, status, topic_list, object_store_key)
         VALUES (?, ?, 'draft', ?, ?)`,
        [id, input.filename, JSON.stringify(input.topicList), input.objectStoreKey ?? null]
      );
    } finally { conn.disconnect(); }
  });
  return id;
}

// [F-C05-NL-READ]
export async function getNewsletter(id: string): Promise<Newsletter> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      const rows = await execQuery<Record<string, unknown>>(conn,
        `SELECT id, filename, status, created_at, published_at, topic_list, object_store_key
         FROM newsletters WHERE id = ?`,
        [id]
      );
      if (!rows.length) throw new DataStoreError('DS_NOT_FOUND', `Newsletter not found: ${id}`);
      return mapNewsletter(rows[0]);
    } finally { conn.disconnect(); }
  });
}

// [F-C05-NL-LIST]
export async function listNewsletters(): Promise<Newsletter[]> {
  return withRetry(async () => {
    const conn = getConnection();
    try {
      const rows = await execQuery<Record<string, unknown>>(conn,
        `SELECT id, filename, status, created_at, published_at, topic_list, object_store_key
         FROM newsletters ORDER BY created_at DESC`
      );
      return rows.map(mapNewsletter);
    } finally { conn.disconnect(); }
  });
}

// [F-C05-NL-UPDATE]
export async function updateNewsletter(id: string, input: UpdateNewsletterInput): Promise<void> {
  await getNewsletter(id); // throws DS_NOT_FOUND if missing
  await withRetry(async () => {
    const conn = getConnection();
    try {
      const sets: string[] = [];
      const params: string[] = [];
      if (input.status) { sets.push('status = ?'); params.push(input.status); }
      if (input.publishedAt) { sets.push('published_at = ?'); params.push(input.publishedAt.toISOString()); }
      if (input.objectStoreKey !== undefined) { sets.push('object_store_key = ?'); params.push(input.objectStoreKey); }
      if (!sets.length) return;
      params.push(id);
      await execQuery(conn, `UPDATE newsletters SET ${sets.join(', ')} WHERE id = ?`, params);
    } finally { conn.disconnect(); }
  });
}

// [F-C05-NL-DELETE]
export async function deleteNewsletter(id: string): Promise<void> {
  await getNewsletter(id); // throws DS_NOT_FOUND if missing
  await withRetry(async () => {
    const conn = getConnection();
    try {
      await execQuery(conn, `DELETE FROM newsletters WHERE id = ?`, [id]);
    } finally { conn.disconnect(); }
  });
}

function mapNewsletter(row: Record<string, unknown>): Newsletter {
  const topicRaw = (row.TOPIC_LIST ?? row.topic_list) as string | null;
  return {
    id: row.ID as string ?? row.id as string,
    filename: row.FILENAME as string ?? row.filename as string,
    status: (row.STATUS ?? row.status) as Newsletter['status'],
    createdAt: new Date((row.CREATED_AT ?? row.created_at) as string),
    publishedAt: (row.PUBLISHED_AT ?? row.published_at) ? new Date((row.PUBLISHED_AT ?? row.published_at) as string) : null,
    topicList: topicRaw ? JSON.parse(topicRaw) : [],
    objectStoreKey: (row.OBJECT_STORE_KEY ?? row.object_store_key) as string | null,
  };
}
