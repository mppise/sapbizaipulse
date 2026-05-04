import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { autoFetch } from './fetchService';
import { extractPdfText } from './pdfService';
import { fetchUrl } from './urlService';
import { approveEntry } from './approveService';
import {
  contentEntryExistsBySourceRef,
  insertContentEntry,
  getContentEntry,
  listContentEntries,
  updateContentEntry,
  deleteContentEntry,
} from '../db';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // [NFR-C01-PDFSIZE] 20MB max
});

function reqId() { return uuidv4(); }

function errorResponse(res: import('express').Response, status: number, code: string, message: string, requestId: string) {
  return res.status(status).json({ error: { code, message, requestId } });
}

// [F-C01-AUTOFETCH]
router.post('/fetch', async (req, res) => {
  const requestId = reqId();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setTimeout(0);
  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);

  const emit = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await autoFetch(emit);
  } catch (err: any) {
    const code = err.code === 'CURATOR_CONFIG_MISSING' ? err.code : 'CURATOR_FETCH_FAILED';
    emit('fetch_error', { code, message: (err as Error).message });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

// [F-C01-INGEST-PDF] Step 1: upload + extract preview
router.post('/ingest/pdf', upload.single('file'), async (req, res) => {
  const requestId = reqId();
  if (!req.file) return errorResponse(res, 400, 'CURATOR_INVALID_FILE_TYPE', 'No file uploaded', requestId);
  if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
    return errorResponse(res, 400, 'CURATOR_INVALID_FILE_TYPE', 'Only .pdf files are accepted', requestId);
  }
  try {
    const bodyText = await extractPdfText(req.file.buffer);
    const sourceRef = req.file.originalname;
    res.json({
      data: {
        title: sourceRef.replace(/\.pdf$/i, ''),
        bodyTextPreview: bodyText.slice(0, 500),
        fullBodyText: bodyText,
        sourceRef,
      },
      meta: { requestId },
    });
  } catch (err: any) {
    if (err.code === 'CURATOR_PDF_EXTRACT_FAILED') return errorResponse(res, 422, err.code, err.message, requestId);
    errorResponse(res, 500, 'CURATOR_PDF_EXTRACT_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-INGEST-PDF] Step 2: confirm + save
router.post('/ingest/pdf/confirm', async (req, res) => {
  const requestId = reqId();
  const { title, sourceRef, fullBodyText } = req.body;
  if (!title || !sourceRef || !fullBodyText) return errorResponse(res, 400, 'CURATOR_INVALID_INPUT', 'title, sourceRef, and fullBodyText are required', requestId);
  try {
    if (await contentEntryExistsBySourceRef(sourceRef)) return errorResponse(res, 409, 'CURATOR_DUPLICATE', `An entry with this source already exists: ${sourceRef}`, requestId);
    const truncated = fullBodyText.length > 500_000 ? fullBodyText.slice(0, 500_000) : fullBodyText;
    const id = await insertContentEntry({ title, bodyText: truncated, sourceType: 'pdf', sourceRef, sensitivity: 'Internal' });
    res.status(201).json({ data: { id, title, sensitivity: 'Internal' }, meta: { requestId } });
  } catch (err) {
    errorResponse(res, 500, 'CURATOR_FETCH_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-INGEST-URL] Step 1: fetch + preview
router.post('/ingest/url', async (req, res) => {
  const requestId = reqId();
  const { url } = req.body;
  if (!url) return errorResponse(res, 400, 'CURATOR_INVALID_URL', 'url is required', requestId);
  try {
    new URL(url);
  } catch {
    return errorResponse(res, 400, 'CURATOR_INVALID_URL', 'Invalid URL format', requestId);
  }
  try {
    if (await contentEntryExistsBySourceRef(url)) return errorResponse(res, 409, 'CURATOR_DUPLICATE', `An entry for this URL already exists: ${url}`, requestId);
    const { title, bodyText } = await fetchUrl(url);
    res.json({
      data: { title, bodyTextPreview: bodyText.slice(0, 500), fullBodyText: bodyText, sourceRef: url },
      meta: { requestId },
    });
  } catch (err: any) {
    errorResponse(res, 502, 'CURATOR_FETCH_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-INGEST-URL] Step 2: confirm + save
router.post('/ingest/url/confirm', async (req, res) => {
  const requestId = reqId();
  const { title, sourceRef, fullBodyText } = req.body;
  if (!title || !sourceRef || !fullBodyText) return errorResponse(res, 400, 'CURATOR_INVALID_INPUT', 'title, sourceRef, and fullBodyText are required', requestId);
  try {
    const truncated = fullBodyText.length > 500_000 ? fullBodyText.slice(0, 500_000) : fullBodyText;
    const id = await insertContentEntry({ title, bodyText: truncated, sourceType: 'url', sourceRef, sensitivity: 'Internal' });
    res.status(201).json({ data: { id, title, sensitivity: 'Internal' }, meta: { requestId } });
  } catch (err) {
    errorResponse(res, 500, 'CURATOR_FETCH_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-LIST]
router.get('/entries', async (req, res) => {
  const requestId = reqId();
  const sensitivity = req.query.sensitivity as 'Internal' | 'Newsletter-ready' | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  try {
    const all = await listContentEntries(sensitivity ? { sensitivity } : undefined);
    const page = all.slice(offset, offset + limit);
    res.json({ data: page, meta: { requestId, total: all.length, offset, limit } });
  } catch (err) {
    errorResponse(res, 500, 'CURATOR_FETCH_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-DETAIL]
router.get('/entries/:id', async (req, res) => {
  const requestId = reqId();
  try {
    const entry = await getContentEntry(req.params.id);
    const { embedding: _, ...safe } = entry;
    res.json({ data: { ...safe, bodyText: entry.bodyText }, meta: { requestId } });
  } catch (err: any) {
    if (err.code === 'DS_NOT_FOUND') return errorResponse(res, 404, 'CURATOR_NOT_FOUND', err.message, requestId);
    errorResponse(res, 500, 'CURATOR_FETCH_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-APPROVE]
router.patch('/entries/:id/approve', async (req, res) => {
  const requestId = reqId();
  try {
    const result = await approveEntry(req.params.id);
    res.json({ data: result, meta: { requestId } });
  } catch (err: any) {
    if (err.code === 'DS_NOT_FOUND') return errorResponse(res, 404, 'CURATOR_NOT_FOUND', err.message, requestId);
    if (err.code === 'CURATOR_ALREADY_APPROVED') return errorResponse(res, 409, err.code, err.message, requestId);
    if (err.code === 'AI_EMBEDDING_FAILED') return errorResponse(res, 502, 'CURATOR_EMBED_FAILED', err.message, requestId);
    errorResponse(res, 502, 'CURATOR_EMBED_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-UPDATE]
router.patch('/entries/:id', async (req, res) => {
  const requestId = reqId();
  const { title } = req.body;
  try {
    await updateContentEntry(req.params.id, { title });
    const entry = await getContentEntry(req.params.id);
    res.json({ data: { id: entry.id, title: entry.title }, meta: { requestId } });
  } catch (err: any) {
    if (err.code === 'DS_NOT_FOUND') return errorResponse(res, 404, 'CURATOR_NOT_FOUND', err.message, requestId);
    errorResponse(res, 500, 'CURATOR_FETCH_FAILED', (err as Error).message, requestId);
  }
});

// [F-C01-DELETE]
router.delete('/entries/:id', async (req, res) => {
  const requestId = reqId();
  try {
    await deleteContentEntry(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'DS_NOT_FOUND') return errorResponse(res, 404, 'CURATOR_NOT_FOUND', err.message, requestId);
    errorResponse(res, 500, 'CURATOR_FETCH_FAILED', (err as Error).message, requestId);
  }
});

export default router;
