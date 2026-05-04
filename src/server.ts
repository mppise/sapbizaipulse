import 'dotenv/config';
import path from 'path';
// Load env from _cfg/.env before anything else
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '_cfg', '.env') });

import express from 'express';
import { initPool, closePool, ping } from './db';
import { initObjectStore } from './lifecycle/objectStore';
import { closeBrowser } from './scraper/browser';
import curatorRouter from './curator/index';
import lifecycleRouter from './lifecycle/index';
import { servePublishedHtml } from './lifecycle/index';
import generatorRouter from './generator/index';

const app = express();
const PORT = parseInt(process.env.PORT ?? '8080', 10);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// [D-SEC-APIKEY] API key middleware — all /api/* routes require X-API-Key
app.use('/api', (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-API-Key header' } });
  }
  next();
});

// Component routers
app.use('/api/v1/curator', curatorRouter);
app.use('/api/v1/newsletters', lifecycleRouter);
app.use('/api/v1/generator', generatorRouter);

// [F-C03-SERVEHTML] Unauthenticated public route for published newsletters
app.get('/published/:filename', servePublishedHtml);

// Serve React SPA static assets (production build)
const uiDist = path.join(__dirname, '..', 'dist', 'ui');
app.use(express.static(uiDist));
app.get('*', (_req, res) => res.sendFile(path.join(uiDist, 'index.html')));

// /health — unauthenticated
app.get('/health', async (_req, res) => {
  try {
    await ping();
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', detail: 'HANA Cloud unreachable' });
  }
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(JSON.stringify({ level: 'error', component: 'server', message: err.message, stack: err.stack }));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
});

async function start() {
  try {
    await initPool();
    initObjectStore();
    app.listen(PORT, () => {
      console.log(JSON.stringify({ level: 'info', component: 'server', message: `SAP BizAI Pulse listening on port ${PORT}` }));
    });
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', component: 'server', message: 'Startup failed', detail: (err as Error).message }));
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closePool();
  await closeBrowser();
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ level: 'error', component: 'server', message: 'uncaughtException', detail: err.message }));
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ level: 'error', component: 'server', message: 'unhandledRejection', detail: String(reason) }));
  process.exit(1);
});

start();
