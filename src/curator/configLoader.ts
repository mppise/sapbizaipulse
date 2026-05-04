import fs from 'fs';
import path from 'path';
import { AIServiceError } from '../ai/errors';

const CFG_PATH = path.join(process.cwd(), '_cfg', 'ai-topics.md');

// [F-C01-CFGLOAD] Parse SAP Community topic URLs from _cfg/ai-topics.md
export function loadTopicUrls(): string[] {
  if (!fs.existsSync(CFG_PATH)) {
    throw Object.assign(new Error('CURATOR_CONFIG_MISSING: _cfg/ai-topics.md not found'), { code: 'CURATOR_CONFIG_MISSING' });
  }
  const content = fs.readFileSync(CFG_PATH, 'utf-8');
  const urls = [...content.matchAll(/^[\-\*]\s+\[.*?\]\((https?:\/\/\S+)\)/gm)]
    .map((m) => m[1])
    .concat([...content.matchAll(/^[\-\*]\s+(https?:\/\/\S+)/gm)].map((m) => m[1]));

  const unique = [...new Set(urls.map((u) => u.toLowerCase()).map((u, _, arr) => urls[arr.indexOf(u)]))];
  if (!unique.length) {
    throw Object.assign(new Error('CURATOR_CONFIG_MISSING: No URLs found in _cfg/ai-topics.md'), { code: 'CURATOR_CONFIG_MISSING' });
  }
  return unique;
}
