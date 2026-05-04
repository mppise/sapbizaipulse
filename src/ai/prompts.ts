import fs from 'fs';
import path from 'path';
import { AIServiceError } from './errors';

const PROMPTS_DIR = path.join(__dirname, 'prompts');

// [F-C04-PROMPT] Load and resolve prompt templates
export function loadPrompt(name: string): string {
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  if (!fs.existsSync(filePath)) {
    throw new AIServiceError('AI_PROMPT_NOT_FOUND', `Prompt file not found: ${name}.md`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function resolvePrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in variables)) {
      console.warn(`[C04] Prompt variable not supplied: {{${key}}}`);
      return `{{${key}}}`;
    }
    return variables[key];
  });
}
