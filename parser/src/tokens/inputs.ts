import { createHash } from 'node:crypto';

import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import type { ContentType, ParseDataInputRecord, ParseInput, ParseInputRecord } from '../types.js';
import { hashJsonValue } from '../utils/hash-json.js';
import { isSingleLineInlineYaml } from '../io/decoder/inline-yaml.js';
import type { InlineDocumentRequestInput } from '../application/requests.js';

export type ParseTokensInput =
  | ParseInput
  | DesignTokenInterchangeFormat
  | { readonly contents: string; readonly uri?: string };

export type InlineInput = InlineDocumentRequestInput;

export function normalizeInput(input: ParseTokensInput): ParseInput {
  if (typeof input === 'string' || input instanceof Uint8Array || input instanceof URL) {
    return input;
  }

  if (isRecord(input)) {
    if (isParseInputRecord(input) || isParseDataRecord(input) || isDesignTokenDocument(input)) {
      return input;
    }

    if (isContentsRecord(input)) {
      return {
        uri: input.uri,
        content: input.contents
      } satisfies ParseInput;
    }
  }

  throw new TypeError('Unsupported parse tokens input.');
}

export function normalizeInlineInput(input: ParseTokensInput): InlineInput | undefined {
  if (typeof input === 'string') {
    if (!looksLikeInlineDocument(input)) {
      return undefined;
    }

    return {
      uri: createMemoryUriFromText(input),
      text: input,
      contentType: detectContentTypeFromContent(input) ?? 'application/json'
    } satisfies InlineInput;
  }

  if (input instanceof Uint8Array) {
    const text = new TextDecoder().decode(input);
    return {
      uri: createMemoryUriFromText(text),
      text,
      contentType: detectContentTypeFromContent(text) ?? 'application/json'
    } satisfies InlineInput;
  }

  if (input instanceof URL) {
    return undefined;
  }

  if (isRecord(input)) {
    if (isParseInputRecord(input)) {
      if (typeof input.content === 'string') {
        const content = input.content;
        return {
          uri: resolveInlineUri(input.uri, () => createMemoryUriFromText(content)),
          text: content,
          contentType:
            input.contentType ?? detectContentTypeFromContent(content) ?? 'application/json'
        } satisfies InlineInput;
      }

      const decoded = new TextDecoder().decode(input.content);
      return {
        uri: resolveInlineUri(input.uri, () => createMemoryUriFromText(decoded)),
        text: decoded,
        contentType:
          input.contentType ?? detectContentTypeFromContent(decoded) ?? 'application/json'
      } satisfies InlineInput;
    }

    if (isContentsRecord(input)) {
      const uri = input.uri ?? createMemoryUriFromText(input.contents);
      return {
        uri,
        text: input.contents,
        contentType: detectContentTypeFromContent(input.contents) ?? 'application/json'
      } satisfies InlineInput;
    }

    if (isParseDataRecord(input)) {
      const uri = resolveInlineUri(input.uri, () =>
        createMemoryUriFromDesignTokens(input.data, 'token')
      );
      return {
        uri,
        contentType: input.contentType ?? 'application/json',
        data: input.data
      } satisfies InlineInput;
    }

    if (isDesignTokenDocument(input)) {
      const uri = createMemoryUriFromDesignTokens(input, 'token');
      return {
        uri,
        contentType: 'application/json',
        data: input
      } satisfies InlineInput;
    }
  }

  return undefined;
}

function looksLikeInlineDocument(value: string): boolean {
  const trimmed = value.trimStart();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('---')) {
    return true;
  }
  if (trimmed.startsWith('%YAML') || trimmed.includes('\n')) {
    return true;
  }
  if (isSingleLineInlineYaml(trimmed)) {
    return true;
  }
  return false;
}

function detectContentTypeFromContent(value: string): ContentType | undefined {
  const trimmed = value.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'application/json';
  }
  if (trimmed.startsWith('---') || trimmed.startsWith('%YAML') || trimmed.includes('\n')) {
    return 'application/yaml';
  }
  if (isSingleLineInlineYaml(trimmed)) {
    return 'application/yaml';
  }
  return undefined;
}

export function createMemoryUriFromText(text: string): string {
  const hash = createHash('sha1').update(text).digest('hex');
  return `memory://dtif-inline/${hash}.txt`;
}

export function createMemoryUriFromDesignTokens(
  value: DesignTokenInterchangeFormat,
  kind: string
): string {
  const hash = hashJsonValue(value, { algorithm: 'sha1' });
  return `memory://dtif-${kind}/${hash}.json`;
}

function resolveInlineUri(value: string | URL | undefined, fallback: () => string): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  return fallback();
}

export function isParseInputRecord(value: unknown): value is ParseInputRecord {
  if (!isRecord(value)) {
    return false;
  }

  const content = value.content;
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    return false;
  }

  const { uri, contentType } = value;
  const validUri = uri === undefined || typeof uri === 'string' || uri instanceof URL;
  const validContentType =
    contentType === undefined ||
    contentType === 'application/json' ||
    contentType === 'application/yaml';

  return validUri && validContentType;
}

function isContentsRecord(value: unknown): value is { contents: string; uri?: string } {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.contents !== 'string') {
    return false;
  }

  const { uri } = value;
  return uri === undefined || typeof uri === 'string';
}

export function isParseDataRecord(value: unknown): value is ParseDataInputRecord {
  if (!isRecord(value)) {
    return false;
  }

  if (!('data' in value)) {
    return false;
  }

  return isDesignTokenDocument(value.data);
}

export function isDesignTokenDocument(value: unknown): value is DesignTokenInterchangeFormat {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value instanceof URL || value instanceof Uint8Array) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRecord(value: unknown): value is Record<string | number | symbol, unknown> {
  return Boolean(value) && typeof value === 'object';
}
