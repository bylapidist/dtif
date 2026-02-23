import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import type { ContentType, DocumentHandle } from '../types.js';
import { cloneJsonValue } from '../utils/clone-json.js';

export interface InlineDocumentRequestInput {
  readonly uri: string;
  readonly contentType: ContentType;
  readonly text?: string;
  readonly data?: DesignTokenInterchangeFormat;
}

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
