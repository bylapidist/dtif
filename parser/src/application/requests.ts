import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import type { ContentType, ParseInput, ParseInputRecord, ParseDataInputRecord } from '../types.js';
import type { DocumentRequest } from '../domain/ports.js';

export function createDocumentRequest(input: ParseInput): DocumentRequest {
  if (typeof input === 'string' || input instanceof URL) {
    return { uri: input } satisfies DocumentRequest;
  }

  if (input instanceof Uint8Array) {
    return { inlineContent: input } satisfies DocumentRequest;
  }

  if (isParseInputRecord(input)) {
    return {
      uri: input.uri,
      inlineContent: input.content,
      contentTypeHint: input.contentType
    } satisfies DocumentRequest;
  }

  if (isParseDataInputRecord(input)) {
    return {
      uri: input.uri,
      inlineData: input.data,
      contentTypeHint: input.contentType
    } satisfies DocumentRequest;
  }

  if (isDesignTokenDocument(input)) {
    return {
      inlineData: input,
      contentTypeHint: 'application/json'
    } satisfies DocumentRequest;
  }

  throw new TypeError('Unsupported parse input.');
}

export interface InlineDocumentRequestInput {
  readonly uri: string;
  readonly contentType: ContentType;
  readonly text?: string;
  readonly data?: DesignTokenInterchangeFormat;
}

export function createInlineDocumentRequest(input: InlineDocumentRequestInput): DocumentRequest {
  if (input.data !== undefined) {
    return {
      uri: input.uri,
      inlineData: input.data,
      contentTypeHint: input.contentType
    } satisfies DocumentRequest;
  }

  return {
    uri: input.uri,
    inlineContent: input.text ?? '',
    contentTypeHint: input.contentType
  } satisfies DocumentRequest;
}

function isParseInputRecord(value: unknown): value is ParseInputRecord {
  if (!isRecord(value)) {
    return false;
  }

  const content = value.content;
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    return false;
  }

  const uri = value.uri;
  const contentType = value.contentType;
  const validUri = uri === undefined || typeof uri === 'string' || uri instanceof URL;
  const validContentType =
    contentType === undefined ||
    contentType === 'application/json' ||
    contentType === 'application/yaml';

  return validUri && validContentType;
}

function isParseDataInputRecord(value: unknown): value is ParseDataInputRecord {
  if (!isRecord(value)) {
    return false;
  }

  if (!('data' in value)) {
    return false;
  }

  return isDesignTokenDocument(value.data);
}

function isDesignTokenDocument(value: unknown): value is DesignTokenInterchangeFormat {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value instanceof URL || value instanceof Uint8Array) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
