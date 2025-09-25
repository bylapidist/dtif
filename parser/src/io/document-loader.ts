import { readFile as defaultReadFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
  ContentType,
  DocumentHandle,
  ParseInput,
  ParseInputRecord,
  ParseDataInputRecord
} from '../types.js';
import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';
import { cloneJsonValue } from '../utils/clone-json.js';
import { hashJsonValue } from '../utils/hash-json.js';

const MEMORY_SCHEME = 'memory://dtif-document/';

type ReadFileFn = (path: string | URL) => Promise<Uint8Array>;

export interface DefaultDocumentLoaderOptions {
  readonly allowHttp?: boolean;
  readonly fetch?: typeof fetch;
  readonly readFile?: ReadFileFn;
  readonly cwd?: string | URL;
  readonly defaultContentType?: ContentType;
  readonly maxBytes?: number;
}

export interface DocumentLoaderContext {
  readonly baseUri?: URL;
  readonly signal?: AbortSignal;
}

export interface DocumentLoader {
  load(input: ParseInput, context?: DocumentLoaderContext): Promise<DocumentHandle>;
}

export type DocumentLoaderErrorReason = 'MAX_BYTES_EXCEEDED';

export class DocumentLoaderError extends Error {
  readonly reason: DocumentLoaderErrorReason;
  readonly uri: URL;
  readonly limit?: number;
  readonly size: number;

  constructor(
    reason: DocumentLoaderErrorReason,
    message: string,
    options: { uri: URL; limit?: number; size: number; cause?: unknown }
  ) {
    super(message, { cause: options.cause });
    this.name = 'DocumentLoaderError';
    this.reason = reason;
    this.uri = options.uri;
    this.limit = options.limit;
    this.size = options.size;
  }
}

export class DefaultDocumentLoader implements DocumentLoader {
  readonly #allowHttp: boolean;
  readonly #fetch?: typeof fetch;
  readonly #readFile: ReadFileFn;
  readonly #cwd: string;
  readonly #defaultContentType: ContentType;
  readonly #maxBytes: number;
  #memoryCounter = 0;

  constructor(options: DefaultDocumentLoaderOptions = {}) {
    this.#allowHttp = options.allowHttp ?? false;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#readFile = options.readFile ?? defaultReadFile;
    this.#cwd = normalizeWorkingDirectory(options.cwd);
    this.#defaultContentType = options.defaultContentType ?? 'application/json';
    this.#maxBytes = resolveMaxBytes(options.maxBytes);
  }

  async load(input: ParseInput, context: DocumentLoaderContext = {}): Promise<DocumentHandle> {
    if (isParseInputRecord(input)) {
      return this.#loadFromRecord(input, context.baseUri);
    }

    if (input instanceof URL) {
      return this.#loadFromUrl(input, context);
    }

    if (input instanceof Uint8Array) {
      const uri = this.#createMemoryUri();
      this.#assertSizeWithinLimit(uri, input.byteLength);
      return this.#createHandle(uri, input, this.#defaultContentType);
    }

    if (typeof input === 'string') {
      if (looksLikeInlineDocument(input)) {
        const uri = this.#createMemoryUri();
        const bytes = encodeText(input);
        this.#assertSizeWithinLimit(uri, bytes.byteLength);
        return this.#createHandle(
          uri,
          bytes,
          detectContentType({ content: input, fallback: this.#defaultContentType }),
          { text: input }
        );
      }

      const uri = this.#resolveUriFromString(input, context.baseUri);
      return this.#loadFromUrl(uri, context);
    }

    if (isParseDataInputRecord(input)) {
      return this.#loadFromDataRecord(input, context.baseUri);
    }

    if (isDesignTokenDocument(input)) {
      return this.#loadFromDesignTokens(input);
    }

    throw new TypeError(`Unsupported DTIF parse input: ${String(input)}`);
  }

  #loadFromRecord(record: ParseInputRecord, baseUri?: URL): DocumentHandle {
    const uri = record.uri ? this.#normalizeUri(record.uri, baseUri) : this.#createMemoryUri();
    const contentType = record.contentType ?? detectContentType({ uri, content: record.content });

    if (typeof record.content === 'string') {
      const bytes = encodeText(record.content);
      this.#assertSizeWithinLimit(uri, bytes.byteLength);
      return this.#createHandle(uri, bytes, contentType, { text: record.content });
    }

    this.#assertSizeWithinLimit(uri, record.content.byteLength);
    return this.#createHandle(uri, record.content, contentType);
  }

  #loadFromDataRecord(record: ParseDataInputRecord, baseUri?: URL): DocumentHandle {
    const uri = record.uri
      ? this.#normalizeUri(record.uri, baseUri)
      : this.#createMemoryUriFromDesignTokens(record.data);
    return this.#createHandleFromDesignTokens(record.data, uri, record.contentType);
  }

  async #loadFromUrl(uri: URL, context: DocumentLoaderContext): Promise<DocumentHandle> {
    switch (uri.protocol) {
      case 'file:': {
        const filePath = fileURLToPath(uri);
        const data = await this.#readFile(filePath);
        const bytes = data instanceof Uint8Array ? new Uint8Array(data) : encodeText(String(data));
        this.#assertSizeWithinLimit(uri, bytes.byteLength);
        const contentType = detectContentType({ uri, fallback: this.#defaultContentType });
        return this.#createHandle(uri, bytes, contentType);
      }
      case 'http:':
      case 'https:': {
        if (!this.#allowHttp) {
          throw new Error(`HTTP(S) loading is disabled for DTIF documents: ${uri.href}`);
        }
        if (!this.#fetch) {
          throw new Error('No fetch implementation available for HTTP(S) loading.');
        }
        const response = await this.#fetch(uri, { signal: context.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch DTIF document. HTTP status: ${String(response.status)}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        this.#assertSizeWithinLimit(uri, bytes.byteLength);
        const contentType = detectContentType({
          uri,
          header: response.headers.get('content-type') ?? undefined,
          fallback: this.#defaultContentType
        });
        return this.#createHandle(uri, bytes, contentType);
      }
      default:
        throw new Error(`Unsupported URI scheme for DTIF documents: ${uri.protocol}`);
    }
  }

  #loadFromDesignTokens(document: DesignTokenInterchangeFormat): DocumentHandle {
    const uri = this.#createMemoryUriFromDesignTokens(document);
    return this.#createHandleFromDesignTokens(document, uri);
  }

  #createHandle(
    uri: URL,
    bytes: Uint8Array,
    contentType: ContentType,
    extras: { text?: string; data?: DesignTokenInterchangeFormat } = {}
  ): DocumentHandle {
    const copy = bytes instanceof Uint8Array ? new Uint8Array(bytes) : encodeText(String(bytes));
    const handle: DocumentHandle = {
      uri,
      contentType,
      bytes: copy,
      ...(extras.text !== undefined ? { text: extras.text } : {}),
      ...(extras.data !== undefined ? { data: cloneJsonValue(extras.data) } : {})
    };

    return Object.freeze(handle);
  }

  #createHandleFromDesignTokens(
    data: DesignTokenInterchangeFormat,
    uri: URL,
    contentType: ContentType = 'application/json'
  ): DocumentHandle {
    const handle: DocumentHandle = {
      uri,
      contentType,
      bytes: new Uint8Array(0),
      data: cloneJsonValue(data)
    };

    return Object.freeze(handle);
  }

  #createMemoryUriFromDesignTokens(value: DesignTokenInterchangeFormat): URL {
    const hash = hashJsonValue(value, { algorithm: 'sha1' });
    return new URL(`${MEMORY_SCHEME}${hash}.json`);
  }

  #assertSizeWithinLimit(uri: URL, size: number): void {
    if (size <= this.#maxBytes) {
      return;
    }

    const sizeText = String(size);
    const limitText = String(this.#maxBytes);

    throw new DocumentLoaderError(
      'MAX_BYTES_EXCEEDED',
      `DTIF document ${uri.href} is ${sizeText} bytes, exceeding the configured maximum of ${limitText} bytes.`,
      { uri, limit: this.#maxBytes, size }
    );
  }

  #normalizeUri(value: string | URL, baseUri?: URL): URL {
    if (value instanceof URL) {
      return value;
    }

    const trimmed = value.trim();

    try {
      return new URL(trimmed);
    } catch {
      return this.#resolveUriFromString(trimmed, baseUri);
    }
  }

  #resolveUriFromString(reference: string, baseUri?: URL): URL {
    try {
      return new URL(reference);
    } catch {
      // fall through
    }

    if (baseUri) {
      if (baseUri.protocol === 'file:') {
        return pathToFileURL(resolveFilePath(reference, baseUri, this.#cwd));
      }
      try {
        return new URL(reference, baseUri);
      } catch {
        // fall through to cwd resolution
      }
    }

    return pathToFileURL(resolveFilePath(reference, undefined, this.#cwd));
  }

  #createMemoryUri(): URL {
    const id = this.#memoryCounter++;
    return new URL(`${MEMORY_SCHEME}${String(id)}`);
  }
}

function normalizeWorkingDirectory(input?: string | URL): string {
  if (!input) {
    return process.cwd();
  }

  if (input instanceof URL) {
    return fileURLToPath(input);
  }

  return path.resolve(input);
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function resolveMaxBytes(input: number | undefined): number {
  if (input === undefined) {
    return DEFAULT_MAX_BYTES;
  }

  if (!Number.isFinite(input) || input <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return input;
}

function resolveFilePath(reference: string, baseUri: URL | undefined, cwd: string): string {
  if (path.isAbsolute(reference)) {
    return reference;
  }

  if (baseUri && baseUri.protocol === 'file:') {
    const basePath = fileURLToPath(baseUri.href.endsWith('/') ? baseUri : new URL('.', baseUri));
    return path.resolve(basePath, reference);
  }

  return path.resolve(cwd, reference);
}

interface ContentCarrier {
  readonly content?: unknown;
}

interface DataCarrier {
  readonly data?: unknown;
}

function hasContentProperty(value: object): value is ContentCarrier {
  return 'content' in value;
}

function hasDataProperty(value: object): value is DataCarrier {
  return 'data' in value;
}

function isObjectLike(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isParseInputRecord(value: ParseInput): value is ParseInputRecord {
  if (!isObjectLike(value)) {
    return false;
  }

  if (!hasContentProperty(value)) {
    return false;
  }

  const { content } = value;
  return typeof content === 'string' || content instanceof Uint8Array;
}

function isParseDataInputRecord(value: ParseInput): value is ParseDataInputRecord {
  if (!isObjectLike(value)) {
    return false;
  }

  if (!hasDataProperty(value)) {
    return false;
  }

  return isDesignTokenDocument(value.data);
}

function encodeText(content: string): Uint8Array {
  return new TextEncoder().encode(content);
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

function detectContentType(params: {
  uri?: URL;
  header?: string;
  content?: string | Uint8Array;
  fallback?: ContentType;
}): ContentType {
  if (params.uri) {
    const fromUri = detectContentTypeFromUri(params.uri);
    if (fromUri) {
      return fromUri;
    }
  }

  if (params.header) {
    const lowered = params.header.toLowerCase();
    if (lowered.includes('yaml')) {
      return 'application/yaml';
    }
    if (lowered.includes('json')) {
      return 'application/json';
    }
  }

  if (typeof params.content === 'string') {
    const fromContent = detectContentTypeFromContent(params.content);
    if (fromContent) {
      return fromContent;
    }
  }

  return params.fallback ?? 'application/json';
}

function detectContentTypeFromUri(uri: URL): ContentType | undefined {
  const pathname = uri.pathname.toLowerCase();
  if (pathname.endsWith('.yaml') || pathname.endsWith('.yml')) {
    return 'application/yaml';
  }
  if (pathname.endsWith('.json')) {
    return 'application/json';
  }
  return undefined;
}

function detectContentTypeFromContent(content: string): ContentType | undefined {
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
  return false;
}
