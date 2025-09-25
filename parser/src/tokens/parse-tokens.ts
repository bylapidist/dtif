import { createHash } from 'node:crypto';

import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import { createSession } from '../session.js';
import type { ParseSession } from '../session.js';
import type { ParseSessionOptions } from '../session.js';
import type {
  ParseInput,
  ParseInputRecord,
  ParseDataInputRecord,
  ParseResult,
  RawDocument,
  Diagnostic,
  ContentType,
  DocumentHandle
} from '../types.js';
import type { DocumentGraph } from '../graph/nodes.js';
import { createDocumentResolver } from '../resolver/index.js';
import type { DocumentResolver } from '../resolver/index.js';
import { flattenTokens } from './flatten.js';
import { createMetadataSnapshot, createResolutionSnapshot } from './snapshots.js';
import {
  computeDocumentHash,
  createCacheKey,
  type CacheVariantOverrides,
  type ParseCache,
  type ParseCacheEntry,
  type ParseCacheKey
} from './cache.js';
import { toTokenDiagnostic } from './diagnostics.js';
import type {
  DtifFlattenedToken,
  ResolvedTokenView,
  TokenDiagnostic,
  TokenDiagnosticContext,
  TokenId,
  TokenMetadataSnapshot
} from './types.js';
import { DiagnosticBag } from '../diagnostics/bag.js';
import { normalizeDocument } from '../ast/normaliser.js';
import { buildDocumentGraph } from '../graph/builder.js';
import { decodeBytes } from '../io/decoder/encoding.js';
import { createSyntheticSourceMap } from '../io/decoder/synthetic-source-map.js';
import { parseYaml, toJavaScript } from '../io/decoder/yaml.js';
import { buildSourceMap } from '../io/decoder/source-map.js';
import { cloneJsonValue } from '../utils/clone-json.js';
import { hashJsonValue } from '../utils/hash-json.js';

export interface ParseTokensOptions extends Omit<ParseSessionOptions, 'cache'> {
  readonly flatten?: boolean;
  readonly includeGraphs?: boolean;
  readonly cache?: ParseCache;
  readonly documentCache?: ParseSessionOptions['cache'];
  readonly onDiagnostic?: (diagnostic: TokenDiagnostic) => void;
  readonly warn?: (diagnostic: TokenDiagnostic) => void;
}

export type ParseTokensInput =
  | ParseInput
  | DesignTokenInterchangeFormat
  | { readonly contents: string; readonly uri?: string };

export interface ParseTokensResult {
  readonly document?: RawDocument;
  readonly graph?: DocumentGraph;
  readonly resolver?: DocumentResolver;
  readonly flattened: readonly DtifFlattenedToken[];
  readonly metadataIndex: ReadonlyMap<TokenId, TokenMetadataSnapshot>;
  readonly resolutionIndex: ReadonlyMap<TokenId, ResolvedTokenView>;
  readonly diagnostics: readonly TokenDiagnostic[];
}

export async function parseTokens(
  input: ParseTokensInput,
  options: ParseTokensOptions = {}
): Promise<ParseTokensResult> {
  const {
    flatten = true,
    includeGraphs = true,
    cache: parseCache,
    documentCache,
    onDiagnostic,
    warn,
    ...sessionOptions
  } = options;

  const session = createSession({ ...sessionOptions, cache: documentCache });
  const normalizedInput = normalizeInput(input);
  const result = await session.parseDocument(normalizedInput);
  const cacheContext =
    parseCache && result.document
      ? await resolveCacheContextAsync(parseCache, result.document, session, {
          flatten,
          includeGraphs
        })
      : undefined;
  const artifacts = buildParseTokensArtifacts(
    result,
    { session, flatten, includeGraphs, onDiagnostic, warn },
    cacheContext
  );

  if (parseCache && cacheContext && artifacts.cacheEntry) {
    await ensureAsync(parseCache.set(cacheContext.key, artifacts.cacheEntry));
  }

  return artifacts.outcome;
}

export function parseTokensSync(
  input: ParseTokensInput,
  options: ParseTokensOptions = {}
): ParseTokensResult {
  const {
    flatten = true,
    includeGraphs = true,
    cache: parseCache,
    documentCache,
    onDiagnostic,
    warn,
    ...sessionOptions
  } = options;

  if (documentCache) {
    throw new Error('parseTokensSync does not support document caches.');
  }

  const inline = normalizeInlineInput(input);
  if (!inline) {
    throw new Error('parseTokensSync requires inline content or design token objects.');
  }

  const session = createSession(sessionOptions);
  const handle = createInlineHandle(inline);
  const diagnostics = new DiagnosticBag();
  const document = decodeDocumentSync(handle);

  const schemaResult = session.options.schemaGuard.validate(document);
  if (!schemaResult.valid) {
    diagnostics.addMany(schemaResult.diagnostics);
    return finalizeSync({ document, diagnostics } satisfies ParseResult, {
      session,
      flatten,
      includeGraphs,
      parseCache,
      onDiagnostic,
      warn
    });
  }

  const normalised = normalizeDocument(document, {
    extensions: session.options.plugins
  });
  diagnostics.addMany(normalised.diagnostics);

  if (!normalised.ast) {
    return finalizeSync(
      {
        document,
        diagnostics,
        extensions: normalised.extensions
      } satisfies ParseResult,
      { session, flatten, includeGraphs, parseCache, onDiagnostic, warn }
    );
  }

  const graphResult = buildDocumentGraph(normalised.ast);
  diagnostics.addMany(graphResult.diagnostics);
  const graph = graphResult.graph;

  const resolver =
    graph &&
    createDocumentResolver(graph, {
      context: session.options.overrideContext,
      maxDepth: session.options.maxDepth,
      document,
      transforms: session.options.plugins?.transforms
    });

  return finalizeSync(
    {
      document,
      graph,
      resolver,
      diagnostics,
      extensions: normalised.extensions,
      ast: normalised.ast
    },
    { session, flatten, includeGraphs, parseCache, onDiagnostic, warn }
  );
}

function normalizeInput(input: ParseTokensInput): ParseInput {
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

function isParseInputRecord(value: unknown): value is ParseInputRecord {
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

function isParseDataRecord(value: unknown): value is ParseDataInputRecord {
  if (!isRecord(value)) {
    return false;
  }

  if (!('data' in value)) {
    return false;
  }

  return isDesignTokenDocument(value.data);
}

function createMemoryUriFromDesignTokens(
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

interface FinalizeOptions {
  readonly session: ParseSession;
  readonly flatten: boolean;
  readonly includeGraphs: boolean;
  readonly onDiagnostic?: (diagnostic: TokenDiagnostic) => void;
  readonly warn?: (diagnostic: TokenDiagnostic) => void;
}

interface CacheContext {
  readonly key: ParseCacheKey;
  readonly documentHash: string;
  readonly entry?: ParseCacheEntry;
}

interface FinalizeArtifacts {
  readonly outcome: ParseTokensResult;
  readonly cacheEntry?: ParseCacheEntry;
}

function buildParseTokensArtifacts(
  result: ParseResult,
  options: FinalizeOptions,
  cacheContext?: CacheContext
): FinalizeArtifacts {
  const document = result.document;
  const graph = result.graph;
  const resolver = result.resolver;
  const includeGraphs = options.includeGraphs;
  const flatten = options.flatten;

  const diagnosticContext: TokenDiagnosticContext = {
    documentUri: document ? document.uri.href : undefined,
    pointerSpans: document ? document.sourceMap.pointers : undefined
  };

  const baseDiagnostics = result.diagnostics.toArray();
  const parseDiagnostics = baseDiagnostics.map((diagnostic) =>
    toTokenDiagnostic(diagnostic, diagnosticContext)
  );

  if (!document || !graph || !resolver) {
    const outcome = {
      document: includeGraphs ? document : undefined,
      graph: includeGraphs ? graph : undefined,
      resolver: includeGraphs ? resolver : undefined,
      flattened: [],
      metadataIndex: graph ? createMetadataSnapshot(graph) : new Map(),
      resolutionIndex: new Map(),
      diagnostics: parseDiagnostics
    } satisfies ParseTokensResult;

    notifyDiagnostics(outcome.diagnostics, options);

    return { outcome } satisfies FinalizeArtifacts;
  }

  if (cacheContext?.entry && cacheContext.entry.documentHash === cacheContext.documentHash) {
    const cachedDiagnostics = mergeDiagnostics(
      cacheContext.entry.diagnostics ?? [],
      parseDiagnostics
    );
    const outcome = {
      document: includeGraphs ? document : undefined,
      graph: includeGraphs ? graph : undefined,
      resolver: includeGraphs ? resolver : undefined,
      flattened: flatten
        ? cacheContext.entry.flattened
          ? [...cacheContext.entry.flattened]
          : []
        : [],
      metadataIndex: cacheContext.entry.metadataIndex
        ? new Map(cacheContext.entry.metadataIndex)
        : new Map(),
      resolutionIndex: cacheContext.entry.resolutionIndex
        ? new Map(cacheContext.entry.resolutionIndex)
        : new Map(),
      diagnostics: cachedDiagnostics
    } satisfies ParseTokensResult;

    notifyDiagnostics(outcome.diagnostics, options);

    return { outcome } satisfies FinalizeArtifacts;
  }

  const resolutionDiagnostics: Diagnostic[] = [];
  const metadataIndex = createMetadataSnapshot(graph);
  const resolutionIndex = flatten
    ? createResolutionSnapshot(graph, resolver, {
        onDiagnostic: (diagnostic) => resolutionDiagnostics.push(diagnostic)
      })
    : new Map<TokenId, ResolvedTokenView>();

  const flattened = flatten ? flattenTokens(graph, resolutionIndex) : [];
  const formattedResolutionDiagnostics = resolutionDiagnostics.map((diagnostic) =>
    toTokenDiagnostic(diagnostic, diagnosticContext)
  );
  const diagnostics = mergeDiagnostics(parseDiagnostics, formattedResolutionDiagnostics);

  notifyDiagnostics(diagnostics, options);

  const cacheEntry: ParseCacheEntry | undefined = cacheContext
    ? {
        documentHash: cacheContext.documentHash,
        flattened: flatten ? flattened : undefined,
        metadataIndex,
        resolutionIndex: flatten ? resolutionIndex : undefined,
        diagnostics,
        timestamp: Date.now()
      }
    : undefined;

  return {
    outcome: {
      document: includeGraphs ? document : undefined,
      graph: includeGraphs ? graph : undefined,
      resolver: includeGraphs ? resolver : undefined,
      flattened,
      metadataIndex,
      resolutionIndex,
      diagnostics
    },
    cacheEntry
  } satisfies FinalizeArtifacts;
}

interface SyncFinalizeOptions extends FinalizeOptions {
  readonly parseCache?: ParseCache;
}

function finalizeSync(result: ParseResult, options: SyncFinalizeOptions): ParseTokensResult {
  const cacheContext =
    options.parseCache && result.document
      ? resolveCacheContextSync(options.parseCache, result.document, options.session, {
          flatten: options.flatten,
          includeGraphs: options.includeGraphs
        })
      : undefined;
  const artifacts = buildParseTokensArtifacts(result, options, cacheContext);

  if (options.parseCache && cacheContext && artifacts.cacheEntry) {
    ensureSync(options.parseCache.set(cacheContext.key, artifacts.cacheEntry));
  }

  return artifacts.outcome;
}

async function resolveCacheContextAsync(
  cache: ParseCache,
  document: RawDocument,
  session: ParseSession,
  variantOptions?: CacheVariantOverrides
): Promise<CacheContext> {
  const documentHash = computeDocumentHash(document);
  const key = createCacheKey(document.uri.href, session.options, variantOptions);
  const entry = await ensureAsync(cache.get(key));
  return { key, documentHash, entry: entry ?? undefined } satisfies CacheContext;
}

function resolveCacheContextSync(
  cache: ParseCache,
  document: RawDocument,
  session: ParseSession,
  variantOptions?: CacheVariantOverrides
): CacheContext {
  const documentHash = computeDocumentHash(document);
  const key = createCacheKey(document.uri.href, session.options, variantOptions);
  const candidate = cache.get(key);
  if (isPromiseLike(candidate)) {
    throw new Error('parseTokensSync requires caches with synchronous get/set semantics.');
  }
  return { key, documentHash, entry: candidate ?? undefined } satisfies CacheContext;
}

async function ensureAsync<T>(value: T | Promise<T>): Promise<T> {
  return isPromiseLike(value) ? await value : value;
}

function ensureSync<T>(value: T | Promise<T>): T {
  if (isPromiseLike(value)) {
    throw new Error('parseTokensSync requires caches with synchronous get/set semantics.');
  }
  return value;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  if (!isObjectLike(value)) {
    return false;
  }

  const then = Reflect.get(value, 'then');
  return typeof then === 'function';
}

function notifyDiagnostics(
  diagnostics: readonly TokenDiagnostic[],
  options: Pick<FinalizeOptions, 'onDiagnostic' | 'warn'>
): void {
  if (diagnostics.length === 0) {
    return;
  }

  if (options.onDiagnostic) {
    for (const diagnostic of diagnostics) {
      options.onDiagnostic(diagnostic);
    }
  }

  if (options.warn) {
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity !== 'error') {
        options.warn(diagnostic);
      }
    }
  }
}

function mergeDiagnostics(
  ...groups: readonly (readonly TokenDiagnostic[])[]
): readonly TokenDiagnostic[] {
  const map = new Map<string, TokenDiagnostic>();
  for (const group of groups) {
    for (const diagnostic of group) {
      const key = createDiagnosticKey(diagnostic);
      map.set(key, diagnostic);
    }
  }
  return Array.from(map.values());
}

function createDiagnosticKey(diagnostic: TokenDiagnostic): string {
  const { severity, code, message, target } = diagnostic;
  const range = target.range;
  const parts = [
    severity,
    code,
    message,
    target.uri,
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character
  ];
  return parts.join('|');
}

interface InlineInput {
  readonly uri: string;
  readonly contentType: ContentType;
  readonly text?: string;
  readonly data?: DesignTokenInterchangeFormat;
}

function normalizeInlineInput(input: ParseTokensInput): InlineInput | undefined {
  if (typeof input === 'string') {
    if (!looksLikeInlineDocument(input)) {
      return undefined;
    }
    const text = input;
    const hash = createHash('sha1').update(text).digest('hex');
    return {
      uri: `memory://dtif-inline/${hash}.yaml`,
      text,
      contentType: detectContentTypeFromContent(text) ?? 'application/yaml'
    } satisfies InlineInput;
  }

  if (input instanceof Uint8Array || input instanceof URL) {
    return undefined;
  }

  if (isRecord(input)) {
    if (isParseInputRecord(input)) {
      const content =
        typeof input.content === 'string' ? input.content : new TextDecoder().decode(input.content);
      const uri = resolveInlineUri(input.uri, () => createMemoryUriFromText(content));
      return {
        uri,
        text: content,
        contentType:
          input.contentType ?? detectContentTypeFromContent(content) ?? 'application/json'
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
  if (/^[^{}\[\]\r\n]+:\s+\S/u.test(trimmed)) {
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
  if (/^[^{}\[\]\r\n]+:\s+\S/u.test(trimmed)) {
    return 'application/yaml';
  }
  return undefined;
}

function createMemoryUriFromText(text: string): string {
  const hash = createHash('sha1').update(text).digest('hex');
  return `memory://dtif-inline/${hash}.txt`;
}

function createInlineHandle(input: InlineInput): DocumentHandle {
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

function decodeDocumentSync(handle: DocumentHandle): RawDocument {
  if (handle.data !== undefined && isDesignTokenDocument(handle.data)) {
    return Object.freeze(createRawDocumentFromProvidedData(handle, handle.data));
  }

  const { text } = decodeBytes(handle.bytes);
  const { document: yamlDocument, lineCounter } = parseYaml(text);
  const data = toJavaScript(yamlDocument);
  const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

  return Object.freeze({
    uri: handle.uri,
    contentType: handle.contentType,
    bytes: handle.bytes,
    text,
    data,
    sourceMap
  });
}

function createRawDocumentFromProvidedData(
  handle: DocumentHandle,
  data: DesignTokenInterchangeFormat
): RawDocument {
  if (typeof handle.text === 'string' && handle.text.length > 0) {
    const text = handle.text;
    const { document: yamlDocument, lineCounter } = parseYaml(text);
    const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

    return {
      uri: handle.uri,
      contentType: handle.contentType,
      bytes: handle.bytes,
      text,
      data,
      sourceMap
    } satisfies RawDocument;
  }

  const text = handle.text ?? '';
  const sourceMap = createSyntheticSourceMap(handle.uri, data);

  return {
    uri: handle.uri,
    contentType: handle.contentType,
    bytes: handle.bytes,
    text,
    data,
    sourceMap
  } satisfies RawDocument;
}

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObjectLike(value);
}

function isDesignTokenDocument(value: unknown): value is DesignTokenInterchangeFormat {
  if (!isObjectLike(value)) {
    return false;
  }

  if (value instanceof URL || value instanceof Uint8Array) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
