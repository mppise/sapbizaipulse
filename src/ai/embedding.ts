import axios from 'axios';
import { getAccessToken, buildHeaders, withAIRetry } from './client';
import { AIServiceError } from './errors';

// [F-C04-EMBED]
export async function generateEmbedding(text: string): Promise<number[]> {
  return withAIRetry(async () => {
    const token = await getAccessToken();
    const { AICORE_BASE_URL, AICORE_EMBED_DEPLOYMENT_ID, AICORE_API_VERSION } = process.env;
    const url = `${AICORE_BASE_URL}/v2/inference/deployments/${AICORE_EMBED_DEPLOYMENT_ID}/embeddings?api-version=${AICORE_API_VERSION ?? '2024-02-01'}`;

    const res = await axios.post(url,
      { input: text, model: AICORE_EMBED_DEPLOYMENT_ID },
      { headers: buildHeaders(token) }
    );

    const embedding = res.data?.data?.[0]?.embedding as number[] | undefined;
    if (!embedding || embedding.length !== 1536) {
      throw new AIServiceError('AI_EMBEDDING_FAILED', `Expected 1536-dimension embedding, got ${embedding?.length ?? 0}`);
    }
    return embedding;
  }, 'AI_EMBEDDING_FAILED');
}
