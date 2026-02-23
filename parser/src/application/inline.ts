import type { InlineDocumentRequestInput } from './requests.js';
import type { DocumentHandle } from '../types.js';
import type { DecodedDocument } from '../domain/models.js';
import { cloneJsonValue } from '../utils/clone-json.js';
import { decodeProvidedDataDocument, decodeTextDocument } from '../io/decoder/core.js';
import type { ProvidedDataHandle } from '../io/decoder/core.js';
import { isDesignTokenDocument } from '../input/contracts.js';

export function createInlineDocumentHandle(input: InlineDocumentRequestInput): DocumentHandle {
  const encoder = new TextEncoder();
  const bytes = typeof input.text === 'string' ? encoder.encode(input.text) : new Uint8Array(0);
  const uri = new URL(input.uri);

  return Object.freeze({
    uri,
    contentType: input.contentType,
    bytes,
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.data !== undefined ? { data: cloneJsonValue(input.data) } : {})
  });
}

export function decodeInlineDocument(handle: DocumentHandle): DecodedDocument {
  if (hasProvidedData(handle)) {
    return decodeProvidedDataDocument(handle);
  }

  return decodeTextDocument(handle);
}

function hasProvidedData(handle: DocumentHandle): handle is ProvidedDataHandle {
  return handle.data !== undefined && isDesignTokenDocument(handle.data);
}
