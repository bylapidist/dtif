import type { ParseInput } from '../types.js';
import type { DocumentRequest } from '../domain/ports.js';
import type { InlineDocumentRequestInput } from '../input/inline-document.js';
import {
  isDesignTokenDocument,
  isParseDataInputRecord,
  isParseInputRecord
} from '../input/contracts.js';

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

export type { InlineDocumentRequestInput } from '../input/inline-document.js';

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
