import { createHash } from 'node:crypto';

import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import type { ContentType, ParseDataInputRecord, ParseInput, ParseInputRecord } from '../types.js';
import { hashJsonValue } from '../utils/hash-json.js';
import type { InlineDocumentRequestInput } from '../application/requests.js';
import {
  isDesignTokenDocument,
  isParseDataInputRecord,
  isParseInputRecord,
  isRecord
} from '../input/contracts.js';
import { inferContentTypeFromContent, isInlineDocumentText } from '../input/content-sniffing.js';

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
    if (
      isParseInputRecord(input) ||
      isParseDataInputRecord(input) ||
      isDesignTokenDocument(input)
    ) {
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
    if (!isInlineDocumentText(input)) {
      return undefined;
    }

    return {
      uri: createMemoryUriFromText(input),
      text: input,
      contentType: inferContentTypeFromContent(input) ?? 'application/json'
    } satisfies InlineInput;
  }

  if (input instanceof Uint8Array) {
    const text = new TextDecoder().decode(input);
    return {
      uri: createMemoryUriFromText(text),
      text,
      contentType: inferContentTypeFromContent(text) ?? 'application/json'
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
          contentType: input.contentType ?? inferContentTypeFromContent(content) ?? 'application/json'
        } satisfies InlineInput;
      }

      const decoded = new TextDecoder().decode(input.content);
      return {
        uri: resolveInlineUri(input.uri, () => createMemoryUriFromText(decoded)),
        text: decoded,
        contentType: input.contentType ?? inferContentTypeFromContent(decoded) ?? 'application/json'
      } satisfies InlineInput;
    }

    if (isContentsRecord(input)) {
      const uri = input.uri ?? createMemoryUriFromText(input.contents);
      return {
        uri,
        text: input.contents,
        contentType: inferContentTypeFromContent(input.contents) ?? 'application/json'
      } satisfies InlineInput;
    }

    if (isParseDataInputRecord(input)) {
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
