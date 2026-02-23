import type { DocumentHandle } from '../types.js';
import type { DecodedDocument } from '../domain/models.js';
import { decodeProvidedDataDocument, decodeTextDocument } from './decoder/core.js';
import type { ProvidedDataHandle } from './decoder/core.js';

export { DecoderError } from './decoder/errors.js';

function hasProvidedData(handle: DocumentHandle): handle is ProvidedDataHandle {
  return handle.data !== undefined;
}

function ensureError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function decodeDocument(handle: DocumentHandle): Promise<DecodedDocument> {
  if (hasProvidedData(handle)) {
    try {
      return Promise.resolve(decodeProvidedDataDocument(handle));
    } catch (error) {
      return Promise.reject(ensureError(error));
    }
  }

  try {
    return Promise.resolve(decodeTextDocument(handle));
  } catch (error) {
    return Promise.reject(ensureError(error));
  }
}
