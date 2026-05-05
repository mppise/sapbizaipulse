import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import { saveDraft } from './draftService';
import { renderMarkdown } from './converter';
import { putObject, getObjectAsString, streamObjectToResponse, deleteObject } from './objectStore';
import { getNewsletter, listNewsletters, updateNewsletter, deleteNewsletter } from '../db';

const router = Router();

function reqId() { return uuidv4(); }
function err(res: Response, status: number, code: string, message: string, requestId: string) {
  return res.status(status).json({ error: { code, message, requestId } });
}

// [F-C03-LIST]
router.get('/', async (req, res) => {
  const requestId = reqId();
  try {
    const newsletters = await listNewsletters();
    res.json({ data: newsletters, meta: { requestId, total: newsletters.length } });
  } catch (e) {
    err(res, 500, 'LIFECYCLE_ERROR', (e as Error).message, requestId);
  }
});

// [F-C03-DETAIL]
router.get('/:id', async (req, res) => {
  const requestId = reqId();
  try {
    const nl = await getNewsletter(req.params.id);
    res.json({ data: nl, meta: { requestId } });
  } catch (e: any) {
    if (e.code === 'DS_NOT_FOUND') return err(res, 404, 'LIFECYCLE_NOT_FOUND', e.message, requestId);
    err(res, 500, 'LIFECYCLE_ERROR', (e as Error).message, requestId);
  }
});

// [F-C03-EDIT]
router.put('/:id/content', async (req, res) => {
  const requestId = reqId();
  const { markdownContent } = req.body as { markdownContent?: string };
  if (!markdownContent || typeof markdownContent !== 'string' || !markdownContent.trim()) {
    return err(res, 400, 'LIFECYCLE_INVALID_INPUT', 'markdownContent must be a non-empty string', requestId);
  }
  try {
    const nl = await getNewsletter(req.params.id);
    if (nl.status === 'published') return err(res, 409, 'LIFECYCLE_ALREADY_PUBLISHED', 'Cannot edit a published newsletter', requestId);
    await putObject(`drafts/${nl.filename}.md`, markdownContent, 'text/markdown; charset=utf-8');
    res.json({ data: { id: nl.id, filename: nl.filename }, meta: { requestId } });
  } catch (e: any) {
    if (e.code === 'DS_NOT_FOUND') return err(res, 404, 'LIFECYCLE_NOT_FOUND', e.message, requestId);
    if (e.code === 'LIFECYCLE_ALREADY_PUBLISHED') return err(res, 409, e.code, e.message, requestId);
    if (e.code === 'LIFECYCLE_STORE_WRITE_FAILED') return err(res, 502, e.code, e.message, requestId);
    err(res, 500, 'LIFECYCLE_ERROR', (e as Error).message, requestId);
  }
});

// [F-C03-PREVIEW]
router.get('/:id/preview', async (req, res) => {
  const requestId = reqId();
  try {
    const nl = await getNewsletter(req.params.id);
    if (nl.status === 'published') return err(res, 409, 'LIFECYCLE_NOT_DRAFT', `Newsletter is published — unpublish it first to edit.`, requestId);
    const markdownContent = await getObjectAsString(nl.objectStoreKey!);
    res.json({ data: { markdownContent }, meta: { requestId } });
  } catch (e: any) {
    if (e.code === 'DS_NOT_FOUND') return err(res, 404, 'LIFECYCLE_NOT_FOUND', e.message, requestId);
    if (e.code === 'LIFECYCLE_NOT_DRAFT') return err(res, 409, e.code, e.message, requestId);
    if (e.code === 'LIFECYCLE_STORE_READ_FAILED') return err(res, 502, e.code, e.message, requestId);
    err(res, 500, 'LIFECYCLE_ERROR', (e as Error).message, requestId);
  }
});

// [F-C03-PUBLISH]
router.post('/:id/publish', async (req, res) => {
  const requestId = reqId();
  try {
    const nl = await getNewsletter(req.params.id);
    if (nl.status === 'published') return err(res, 409, 'LIFECYCLE_ALREADY_PUBLISHED', 'Newsletter is already published', requestId);

    const markdownContent = await getObjectAsString(nl.objectStoreKey!);
    const htmlContent = renderMarkdown(markdownContent);
    const htmlKey = `published/${nl.filename}.html`;
    await putObject(htmlKey, htmlContent, 'text/html; charset=utf-8');

    const publishedAt = new Date();
    await updateNewsletter(nl.id, { status: 'published', publishedAt, objectStoreKey: htmlKey });

    res.json({
      data: { id: nl.id, filename: nl.filename, status: 'published', publishedAt: publishedAt.toISOString(), htmlPath: `/published/${nl.filename}.html` },
      meta: { requestId },
    });
  } catch (e: any) {
    if (e.code === 'DS_NOT_FOUND') return err(res, 404, 'LIFECYCLE_NOT_FOUND', e.message, requestId);
    if (e.code === 'LIFECYCLE_ALREADY_PUBLISHED') return err(res, 409, e.code, e.message, requestId);
    if (e.code === 'LIFECYCLE_STORE_READ_FAILED') return err(res, 502, e.code, e.message, requestId);
    if (e.code === 'LIFECYCLE_STORE_WRITE_FAILED') return err(res, 502, e.code, e.message, requestId);
    if (e.code === 'LIFECYCLE_CONVERT_FAILED') return err(res, 500, e.code, e.message, requestId);
    err(res, 500, 'LIFECYCLE_ERROR', (e as Error).message, requestId);
  }
});

// [F-C03-UNPUBLISH]
router.post('/:id/unpublish', async (req, res) => {
  const requestId = reqId();
  try {
    const nl = await getNewsletter(req.params.id);
    if (nl.status === 'draft') return err(res, 409, 'LIFECYCLE_NOT_PUBLISHED', 'Newsletter is not published', requestId);
    await deleteObject(`published/${nl.filename}.html`);
    await updateNewsletter(nl.id, { status: 'draft', publishedAt: null, objectStoreKey: `drafts/${nl.filename}.md` });
    res.json({ data: { id: nl.id, filename: nl.filename, status: 'draft' }, meta: { requestId } });
  } catch (e: any) {
    if (e.code === 'DS_NOT_FOUND') return err(res, 404, 'LIFECYCLE_NOT_FOUND', e.message, requestId);
    if (e.code === 'LIFECYCLE_STORE_WRITE_FAILED') return err(res, 502, e.code, e.message, requestId);
    err(res, 500, 'LIFECYCLE_ERROR', (e as Error).message, requestId);
  }
});

// [F-C03-DELETE]
router.delete('/:id', async (req, res) => {
  const requestId = reqId();
  try {
    const nl = await getNewsletter(req.params.id);
    await deleteObject(`drafts/${nl.filename}.md`);
    await deleteObject(`published/${nl.filename}.html`);
    await deleteNewsletter(nl.id);
    res.status(204).send();
  } catch (e: any) {
    if (e.code === 'DS_NOT_FOUND') return err(res, 404, 'LIFECYCLE_NOT_FOUND', e.message, requestId);
    err(res, 500, 'LIFECYCLE_ERROR', (e as Error).message, requestId);
  }
});

// [F-C03-SERVEHTML] — unauthenticated public route; mounted at /published in server.ts
export async function servePublishedHtml(req: import('express').Request, res: Response): Promise<void> {
  const filename = req.params.filename.replace(/\.html$/i, '');
  try {
    const newsletters = await listNewsletters();
    const nl = newsletters.find((n) => n.filename === filename && n.status === 'published');
    if (!nl) { res.status(404).type('text').send('Newsletter not found'); return; }
    await streamObjectToResponse(`published/${filename}.html`, res);
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', component: 'lifecycle', message: 'servePublishedHtml failed', filename, detail: (e as Error).message }));
    res.status(502).type('text').send('File unavailable');
  }
}

export { saveDraft };
export default router;
