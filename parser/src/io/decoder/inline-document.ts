import type { DecodedDocument } from '../../domain/models.js';
import type { DocumentHandle } from '../../types.js';
import { isDesignTokenDocument } from '../../input/contracts.js';
import { decodeProvidedDataDocument, decodeTextDocument, type ProvidedDataHandle } from './core.js';

export function decodeInlineDocument(handle: DocumentHandle): DecodedDocument {
  if (hasProvidedData(handle)) {
    return decodeProvidedDataDocument(handle);
  }

  return decodeTextDocument(handle);
}

function hasProvidedData(handle: DocumentHandle): handle is ProvidedDataHandle {
  return handle.data !== undefined && isDesignTokenDocument(handle.data);
}
