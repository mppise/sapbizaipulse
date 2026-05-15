import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { suggestTopics } from './suggestService';
import { runTopicPipeline, TopicInput } from './pipelineWorker';
import { assembleNewsletter, generateFilename } from './assembler';
import { saveDraft } from '../lifecycle/draftService';
import { sseStart, sseEvent, sseKeepAlive } from './sseEmitter';

const router = Router();

function reqId() { return uuidv4(); }

// [F-C02-SUGGEST]
router.get('/topics/suggest', async (req, res) => {
  const requestId = reqId();
  try {
    const result = await suggestTopics();
    res.json({ data: result, meta: { requestId } });
  } catch (e: any) {
    res.status(500).json({ error: { code: 'GENERATOR_SUGGEST_FAILED', message: (e as Error).message, requestId } });
  }
});

// [F-C02-GENERATE] Streaming SSE generation pipeline
router.post('/generate', async (req, res) => {
  const { topics, timeframeFrom } = req.body as { topics: TopicInput[]; timeframeFrom?: string };

  if (!Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({ error: { code: 'GENERATOR_INVALID_INPUT', message: 'topics must be a non-empty array', requestId: reqId() } });
  }
  if (topics.length > 10) { // [NFR-C02-TOPICMAX]
    return res.status(400).json({ error: { code: 'GENERATOR_INVALID_INPUT', message: 'Maximum 10 topics per generation request', requestId: reqId() } });
  }

  const fromDate = timeframeFrom ? new Date(timeframeFrom) : undefined;

  sseStart(res);
  const keepAlive = sseKeepAlive(res);

  try {
    const results = [];
    for (let i = 0; i < topics.length; i++) {
      const result = await runTopicPipeline(topics[i], i, topics.length, res, fromDate);
      if (result) results.push(result);
    }

    if (results.length === 0) {
      sseEvent(res, 'generation_failed', { message: 'All topics failed to generate' });
      return;
    }

    const markdownContent = assembleNewsletter(results);
    const filename = generateFilename();
    const topicList = results.map((r) => r.title);

    const draft = await saveDraft({ filename, topicList, markdownContent });
    sseEvent(res, 'generation_complete', {
      newsletterId: draft.id,
      filename: draft.filename,
      successCount: results.length,
      errorCount: topics.length - results.length,
    });
  } catch (e) {
    sseEvent(res, 'generation_failed', { message: (e as Error).message });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

export default router;
