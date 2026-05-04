import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import type { Response } from 'express';

let s3: S3Client | null = null;

// [F-C03-SAVEDRAFT / F-C03-PUBLISH] Initialise Object Store client
export function initObjectStore(): void {
  const { OBJECT_STORE_ACCESS_KEY_ID, OBJECT_STORE_SECRET_ACCESS_KEY, OBJECT_STORE_REGION, OBJECT_STORE_HOST } = process.env;
  if (!OBJECT_STORE_ACCESS_KEY_ID || !OBJECT_STORE_SECRET_ACCESS_KEY || !OBJECT_STORE_REGION || !OBJECT_STORE_HOST) {
    throw new Error('Missing required OBJECT_STORE_* environment variables');
  }
  s3 = new S3Client({
    region: OBJECT_STORE_REGION,
    endpoint: `https://${OBJECT_STORE_HOST}`,
    forcePathStyle: true, // required for SAP Object Store S3-compatible endpoint
    credentials: {
      accessKeyId: OBJECT_STORE_ACCESS_KEY_ID,
      secretAccessKey: OBJECT_STORE_SECRET_ACCESS_KEY,
    },
  });
}

function client(): S3Client {
  if (!s3) throw new Error('Object Store not initialised — call initObjectStore() first');
  return s3;
}

function bucket(): string {
  const b = process.env.OBJECT_STORE_BUCKET;
  if (!b) throw new Error('OBJECT_STORE_BUCKET not set');
  return b;
}

function lifecycleError(code: string, message: string, cause?: Error): Error {
  return Object.assign(new Error(message), { code, cause });
}

export async function putObject(key: string, body: string | Buffer, contentType: string): Promise<void> {
  try {
    await client().send(new PutObjectCommand({
      Bucket: bucket(), Key: key,
      Body: typeof body === 'string' ? Buffer.from(body, 'utf-8') : body,
      ContentType: contentType,
    }));
  } catch (err) {
    throw lifecycleError('LIFECYCLE_STORE_WRITE_FAILED', `Object Store write failed for key: ${key}`, err as Error);
  }
}

export async function getObjectAsString(key: string): Promise<string> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const stream = res.Body as Readable;
    return await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  } catch (err) {
    throw lifecycleError('LIFECYCLE_STORE_READ_FAILED', `Object Store read failed for key: ${key}`, err as Error);
  }
}

export async function streamObjectToResponse(key: string, res: Response): Promise<void> {
  try {
    const obj = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const stream = obj.Body as Readable;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    await new Promise<void>((resolve, reject) => {
      stream.pipe(res);
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } catch (err) {
    throw lifecycleError('LIFECYCLE_STORE_READ_FAILED', `Object Store read failed for key: ${key}`, err as Error);
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (err: any) {
    // NoSuchKey is idempotent — [NFR-C03-IDEMPOTDEL]
    if (err?.name === 'NoSuchKey' || err?.Code === 'NoSuchKey') return;
    throw lifecycleError('LIFECYCLE_STORE_WRITE_FAILED', `Object Store delete failed for key: ${key}`, err as Error);
  }
}
