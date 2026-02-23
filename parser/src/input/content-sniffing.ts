import type { ContentType } from '../types.js';
import { isSingleLineInlineYaml } from '../io/decoder/inline-yaml.js';

export function inferContentTypeFromContent(content: string): ContentType | undefined {
  const trimmed = content.trimStart();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'application/json';
  }

  if (trimmed.startsWith('---') || trimmed.startsWith('%')) {
    return 'application/yaml';
  }

  if (trimmed.includes('\n')) {
    return 'application/yaml';
  }

  if (isSingleLineInlineYaml(trimmed)) {
    return 'application/yaml';
  }

  return undefined;
}

export function isInlineDocumentText(value: string): boolean {
  const trimmed = value.trimStart();
  if (trimmed.length === 0) {
    return true;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('---')) {
    return true;
  }

  if (trimmed.startsWith('%') || trimmed.includes('\n')) {
    return true;
  }

  if (isSingleLineInlineYaml(trimmed)) {
    return true;
  }

  return false;
}
