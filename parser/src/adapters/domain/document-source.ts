import type { RawDocument } from '../../domain/models.js';
import type { DocumentRequest, DocumentSourcePort } from '../../domain/ports.js';
import type { DocumentLoader, DocumentLoaderContext } from '../../io/document-loader.js';
import type {
  ContentType,
  ParseDataInputRecord,
  ParseInput,
  ParseInputRecord
} from '../../types.js';
import { isDesignTokenDocument } from '../../input/contracts.js';

export interface DocumentLoaderSourceOptions {
  readonly context?: DocumentLoaderContext;
}

export class DocumentLoaderSource implements DocumentSourcePort {
  readonly #loader: DocumentLoader;
  readonly #context?: DocumentLoaderContext;

  constructor(loader: DocumentLoader, options: DocumentLoaderSourceOptions = {}) {
    this.#loader = loader;
    this.#context = options.context;
  }

  async load(request: DocumentRequest): Promise<RawDocument> {
    const input = toParseInput(request);
    const context = this.#mergeContext(request);
    const handle = await this.#loader.load(input, context);

    return {
      identity: {
        uri: handle.uri,
        contentType: handle.contentType,
        description: request.description
      },
      bytes: handle.bytes,
      text: handle.text,
      data: handle.data
    } satisfies RawDocument;
  }

  #mergeContext(request: DocumentRequest): DocumentLoaderContext | undefined {
    if (!request.baseUri && !request.signal) {
      return this.#context;
    }

    if (!this.#context) {
      return {
        baseUri: request.baseUri,
        signal: request.signal
      } satisfies DocumentLoaderContext;
    }

    return {
      baseUri: request.baseUri ?? this.#context.baseUri,
      signal: request.signal ?? this.#context.signal
    } satisfies DocumentLoaderContext;
  }
}

function toParseInput(request: DocumentRequest): ParseInput {
  if (request.inlineData !== undefined) {
    return toDataRecord(request);
  }

  if (request.inlineContent !== undefined) {
    return toContentRecord(request);
  }

  if (request.uri !== undefined) {
    return request.uri;
  }

  throw new Error('Document request must provide a URI, inline content, or inline data.');
}

function toDataRecord(request: DocumentRequest): ParseDataInputRecord {
  const { inlineData } = request;
  assertDesignTokenDocument(inlineData);

  return {
    uri: request.uri,
    data: inlineData,
    contentType: normalizeContentType(request.contentTypeHint)
  } satisfies ParseDataInputRecord;
}

function toContentRecord(request: DocumentRequest): ParseInputRecord {
  const { inlineContent } = request;
  if (inlineContent === undefined) {
    throw new TypeError('Inline content must be provided when no URI is supplied.');
  }

  return {
    uri: request.uri,
    content: inlineContent,
    contentType: normalizeContentType(request.contentTypeHint)
  } satisfies ParseInputRecord;
}

function normalizeContentType(value: DocumentRequest['contentTypeHint']): ContentType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return isContentType(normalized) ? normalized : undefined;
}

function isContentType(value: string): value is ContentType {
  return value === 'application/json' || value === 'application/yaml';
}

function assertDesignTokenDocument(
  value: DocumentRequest['inlineData']
): asserts value is ParseDataInputRecord['data'] {
  if (!isDesignTokenDocument(value)) {
    throw new TypeError('Inline data must be a design token document.');
  }
}
