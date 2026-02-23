import type {
  DecodedDocument,
  DiagnosticEvent,
  GraphSnapshot,
  NormalizedDocument,
  PipelineDiagnostics,
  RawDocument,
  ResolutionOutcome,
  TokenSnapshot
} from '../domain/models.js';
import type {
  DiagnosticPort,
  DocumentCachePort,
  DocumentRequest,
  TokenCacheKey,
  TokenCachePort
} from '../domain/ports.js';
import type {
  DocumentDecodingService,
  DocumentIngestionService,
  DocumentNormalizationService,
  GraphConstructionService,
  ResolutionService,
  SchemaValidationService,
  TokenFlatteningService
} from '../domain/services.js';
import { DiagnosticCodes } from '../diagnostics/codes.js';
import type { TokenCacheVariantOverrides, TokenCacheSnapshot } from '../tokens/cache.js';
import { areByteArraysEqual } from '../utils/bytes.js';

export interface ParseDocumentDependencies<TAst, TGraph, TResult> {
  readonly ingestion: DocumentIngestionService;
  readonly decoding: DocumentDecodingService;
  readonly schema: SchemaValidationService;
  readonly normalization: DocumentNormalizationService<TAst>;
  readonly graph: GraphConstructionService<TGraph, TAst>;
  readonly resolution: ResolutionService<TGraph, TResult, TAst>;
  readonly documentCache?: DocumentCachePort;
  readonly diagnostics?: DiagnosticPort;
}

export interface ParseDocumentInput {
  readonly request: DocumentRequest;
  readonly bypassDocumentCache?: boolean;
}

export interface ParseDocumentExecuteOptions {
  readonly reportDiagnostics?: boolean;
}

export interface ParseDocumentExecution<TAst, TGraph, TResult> {
  readonly document?: RawDocument;
  readonly decoded?: DecodedDocument;
  readonly normalized?: NormalizedDocument<TAst>;
  readonly graph?: GraphSnapshot<TGraph>;
  readonly resolution?: ResolutionOutcome<TResult>;
  readonly diagnostics: readonly DiagnosticEvent[];
  readonly fromCache: boolean;
}

export class ParseDocumentUseCase<TAst = unknown, TGraph = unknown, TResult = unknown> {
  readonly #ingestion: DocumentIngestionService;
  readonly #decoding: DocumentDecodingService;
  readonly #schema: SchemaValidationService;
  readonly #normalization: DocumentNormalizationService<TAst>;
  readonly #graph: GraphConstructionService<TGraph, TAst>;
  readonly #resolution: ResolutionService<TGraph, TResult, TAst>;
  readonly #documentCache?: DocumentCachePort;
  readonly #diagnostics?: DiagnosticPort;

  constructor(dependencies: ParseDocumentDependencies<TAst, TGraph, TResult>) {
    this.#ingestion = dependencies.ingestion;
    this.#decoding = dependencies.decoding;
    this.#schema = dependencies.schema;
    this.#normalization = dependencies.normalization;
    this.#graph = dependencies.graph;
    this.#resolution = dependencies.resolution;
    this.#documentCache = dependencies.documentCache;
    this.#diagnostics = dependencies.diagnostics;
  }

  async execute(
    input: ParseDocumentInput,
    options: ParseDocumentExecuteOptions = {}
  ): Promise<ParseDocumentExecution<TAst, TGraph, TResult>> {
    const { reportDiagnostics = true } = options;
    const aggregated: DiagnosticEvent[] = [];

    const ingestionResult = await this.#ingestion.ingest(input.request);
    appendDiagnostics(aggregated, ingestionResult.diagnostics);

    const rawDocument = ingestionResult.outcome;
    if (!rawDocument || hasErrors(ingestionResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: { diagnostics, fromCache: false }
      });
    }

    let document = rawDocument;
    let fromCache = false;

    if (this.#documentCache && !input.bypassDocumentCache) {
      try {
        const cached = await this.#documentCache.get(rawDocument.identity);
        if (cached && areByteArraysEqual(cached.bytes, rawDocument.bytes)) {
          document = cached;
          fromCache = true;
        }
      } catch (error) {
        aggregated.push(createCacheReadEvent(error));
      }
    }

    const decodedResult = await this.#decoding.decode(document);
    const decoded = decodedResult.outcome;
    appendDiagnostics(aggregated, decodedResult.diagnostics);

    if (!decoded || hasErrors(decodedResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: { document, decoded, diagnostics, fromCache }
      });
    }

    document = enrichDocument(document, decoded);

    if (!fromCache && this.#documentCache && !input.bypassDocumentCache) {
      try {
        await this.#documentCache.set(document);
      } catch (error) {
        aggregated.push(createCacheWriteEvent(error));
      }
    }

    const validationResult = await this.#schema.validate(decoded);
    appendDiagnostics(aggregated, validationResult.diagnostics);
    if (!validationResult.outcome || hasErrors(validationResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: { document, decoded, diagnostics, fromCache }
      });
    }

    const normalizationResult = await this.#normalization.normalize(decoded);
    const normalized = normalizationResult.outcome;
    appendDiagnostics(aggregated, normalizationResult.diagnostics);

    if (!normalized || hasErrors(normalizationResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: {
          document,
          decoded,
          normalized,
          diagnostics,
          fromCache
        }
      });
    }

    const graphResult = await this.#graph.build(normalized);
    const graph = graphResult.outcome;
    appendDiagnostics(aggregated, graphResult.diagnostics);

    if (!graph || hasErrors(graphResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: {
          document,
          decoded,
          normalized,
          graph,
          diagnostics,
          fromCache
        }
      });
    }

    const resolutionResult = await this.#resolution.resolve(graph, {
      document,
      decoded,
      normalized
    });
    const resolution = resolutionResult.outcome;
    appendDiagnostics(aggregated, resolutionResult.diagnostics);

    if (!resolution || hasErrors(resolutionResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: {
          document,
          decoded,
          normalized,
          graph,
          diagnostics,
          fromCache
        }
      });
    }

    appendDiagnostics(aggregated, resolution.diagnostics);

    const diagnostics = finalizeDiagnostics(aggregated);
    return this.#finalize({
      reportDiagnostics,
      result: {
        document,
        decoded,
        normalized,
        graph,
        resolution,
        diagnostics,
        fromCache
      }
    });
  }

  executeSync(
    input: ParseDocumentInput,
    options: ParseDocumentExecuteOptions = {}
  ): ParseDocumentExecution<TAst, TGraph, TResult> {
    const { reportDiagnostics = true } = options;
    const aggregated: DiagnosticEvent[] = [];

    const ingestionResult = ensureSynchronous(
      this.#ingestion.ingest(input.request),
      'ingest document'
    );
    appendDiagnostics(aggregated, ingestionResult.diagnostics);

    const rawDocument = ingestionResult.outcome;
    if (!rawDocument || hasErrors(ingestionResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: { diagnostics, fromCache: false }
      });
    }

    let document = rawDocument;
    let fromCache = false;

    if (this.#documentCache && !input.bypassDocumentCache) {
      try {
        const cached = ensureSynchronous(
          this.#documentCache.get(rawDocument.identity),
          'read document cache'
        );
        if (cached && areByteArraysEqual(cached.bytes, rawDocument.bytes)) {
          document = cached;
          fromCache = true;
        }
      } catch (error) {
        aggregated.push(createCacheReadEvent(error));
      }
    }

    const decodedResult = ensureSynchronous(this.#decoding.decode(document), 'decode document');
    const decoded = decodedResult.outcome;
    appendDiagnostics(aggregated, decodedResult.diagnostics);

    if (!decoded || hasErrors(decodedResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: { document, decoded, diagnostics, fromCache }
      });
    }

    document = enrichDocument(document, decoded);

    if (!fromCache && this.#documentCache && !input.bypassDocumentCache) {
      try {
        ensureSynchronous(this.#documentCache.set(document), 'write document cache');
      } catch (error) {
        aggregated.push(createCacheWriteEvent(error));
      }
    }

    const validationResult = ensureSynchronous(this.#schema.validate(decoded), 'validate document');
    appendDiagnostics(aggregated, validationResult.diagnostics);
    if (!validationResult.outcome || hasErrors(validationResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: { document, decoded, diagnostics, fromCache }
      });
    }

    const normalizationResult = ensureSynchronous(
      this.#normalization.normalize(decoded),
      'normalize document'
    );
    const normalized = normalizationResult.outcome;
    appendDiagnostics(aggregated, normalizationResult.diagnostics);

    if (!normalized || hasErrors(normalizationResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: {
          document,
          decoded,
          normalized,
          diagnostics,
          fromCache
        }
      });
    }

    const graphResult = ensureSynchronous(this.#graph.build(normalized), 'build document graph');
    const graph = graphResult.outcome;
    appendDiagnostics(aggregated, graphResult.diagnostics);

    if (!graph || hasErrors(graphResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: {
          document,
          decoded,
          normalized,
          graph,
          diagnostics,
          fromCache
        }
      });
    }

    const resolutionResult = ensureSynchronous(
      this.#resolution.resolve(graph, { document, decoded, normalized }),
      'resolve document'
    );
    const resolution = resolutionResult.outcome;
    appendDiagnostics(aggregated, resolutionResult.diagnostics);

    if (!resolution || hasErrors(resolutionResult.diagnostics)) {
      const diagnostics = finalizeDiagnostics(aggregated);
      return this.#finalize({
        reportDiagnostics,
        result: {
          document,
          decoded,
          normalized,
          graph,
          diagnostics,
          fromCache
        }
      });
    }

    appendDiagnostics(aggregated, resolution.diagnostics);

    const diagnostics = finalizeDiagnostics(aggregated);
    return this.#finalize({
      reportDiagnostics,
      result: {
        document,
        decoded,
        normalized,
        graph,
        resolution,
        diagnostics,
        fromCache
      }
    });
  }

  #finalize({
    reportDiagnostics,
    result
  }: {
    reportDiagnostics: boolean;
    result: ParseDocumentExecution<TAst, TGraph, TResult>;
  }): ParseDocumentExecution<TAst, TGraph, TResult> {
    if (reportDiagnostics) {
      this.#reportDiagnostics(result.diagnostics);
    }
    return result;
  }

  #reportDiagnostics(events: readonly DiagnosticEvent[]): void {
    if (!this.#diagnostics) {
      return;
    }

    this.#diagnostics.report({ events });
  }
}

function enrichDocument(document: RawDocument, decoded: DecodedDocument): RawDocument {
  if (
    document.text === decoded.text &&
    document.data === decoded.data &&
    document.sourceMap === decoded.sourceMap
  ) {
    return document;
  }

  return {
    identity: document.identity,
    bytes: decoded.bytes,
    text: decoded.text,
    data: decoded.data,
    sourceMap: decoded.sourceMap ?? document.sourceMap
  } satisfies RawDocument;
}

export interface ParseTokensDependencies<TAst, TGraph, TResult> {
  readonly documents: Pick<ParseDocumentUseCase<TAst, TGraph, TResult>, 'execute' | 'executeSync'>;
  readonly flattening: TokenFlatteningService<TResult, TGraph, TokenCacheSnapshot>;
  readonly tokenCache?: TokenCachePort<TokenCacheSnapshot>;
  readonly diagnostics?: DiagnosticPort;
  readonly hashDocument?: (document: RawDocument) => string;
  readonly resolveVariant?: (overrides: TokenCacheVariantOverrides) => string;
}

export interface ParseTokensInput extends ParseDocumentInput {
  readonly variant?: string;
  readonly bypassTokenCache?: boolean;
  readonly flatten?: boolean;
  readonly includeGraphs?: boolean;
}

export interface ParseTokensExecution<TAst, TGraph, TResult> extends ParseDocumentExecution<
  TAst,
  TGraph,
  TResult
> {
  readonly tokens?: TokenSnapshot<TokenCacheSnapshot>;
  readonly tokensFromCache: boolean;
}

export class ParseTokensUseCase<TAst = unknown, TGraph = unknown, TResult = unknown> {
  readonly #documents: Pick<ParseDocumentUseCase<TAst, TGraph, TResult>, 'execute' | 'executeSync'>;
  readonly #flattening: TokenFlatteningService<TResult, TGraph, TokenCacheSnapshot>;
  readonly #tokenCache?: TokenCachePort<TokenCacheSnapshot>;
  readonly #diagnostics?: DiagnosticPort;
  readonly #hashDocument?: (document: RawDocument) => string;
  readonly #resolveVariant?: (overrides: TokenCacheVariantOverrides) => string;

  constructor(dependencies: ParseTokensDependencies<TAst, TGraph, TResult>) {
    this.#documents = dependencies.documents;
    this.#flattening = dependencies.flattening;
    this.#tokenCache = dependencies.tokenCache;
    this.#diagnostics = dependencies.diagnostics;
    this.#hashDocument = dependencies.hashDocument;
    this.#resolveVariant = dependencies.resolveVariant;
  }

  async execute(input: ParseTokensInput): Promise<ParseTokensExecution<TAst, TGraph, TResult>> {
    const documentResult = await this.#documents.execute(input, {
      reportDiagnostics: false
    });
    const aggregated = [...documentResult.diagnostics];
    let tokensFromCache = false;
    let snapshot: TokenSnapshot<TokenCacheSnapshot> | undefined;

    if (documentResult.resolution && documentResult.document) {
      const variant = this.#resolveVariantValue(input);
      const key: TokenCacheKey = {
        document: documentResult.document.identity,
        variant
      };

      const documentHash = this.#hashDocument
        ? this.#hashDocument(documentResult.document)
        : undefined;

      if (this.#tokenCache && !input.bypassTokenCache) {
        const cached = await this.#tokenCache.get(key);
        if (cached && (!documentHash || cached.documentHash === documentHash)) {
          snapshot = createSnapshotFromCache(cached);
          tokensFromCache = true;
          appendDiagnostics(aggregated, snapshot.diagnostics);
        } else {
          snapshot = await this.#flattenTokens(
            documentResult,
            aggregated,
            documentHash,
            input.flatten ?? true
          );
          if (snapshot && !hasErrors(snapshot.diagnostics)) {
            const entry = normalizeTokenCacheEntryDiagnostics(
              ensureDocumentHash(snapshot.token, documentHash),
              snapshot.diagnostics
            );
            await this.#tokenCache.set(key, entry);
          }
        }
      } else {
        snapshot = await this.#flattenTokens(
          documentResult,
          aggregated,
          documentHash,
          input.flatten ?? true
        );
      }
    }

    const diagnostics = finalizeDiagnostics(aggregated);
    this.#reportDiagnostics(diagnostics);

    return this.#createParseTokensExecution(documentResult, snapshot, diagnostics, tokensFromCache);
  }

  executeSync(input: ParseTokensInput): ParseTokensExecution<TAst, TGraph, TResult> {
    const documentResult = this.#documents.executeSync(input, {
      reportDiagnostics: false
    });
    const aggregated = [...documentResult.diagnostics];
    let tokensFromCache = false;
    let snapshot: TokenSnapshot<TokenCacheSnapshot> | undefined;

    if (documentResult.resolution && documentResult.document) {
      const variant = this.#resolveVariantValue(input);
      const key: TokenCacheKey = {
        document: documentResult.document.identity,
        variant
      };

      const documentHash = this.#hashDocument
        ? this.#hashDocument(documentResult.document)
        : undefined;

      if (this.#tokenCache && !input.bypassTokenCache) {
        const cached = ensureSynchronous(this.#tokenCache.get(key), 'read token cache');
        if (cached && (!documentHash || cached.documentHash === documentHash)) {
          snapshot = createSnapshotFromCache(cached);
          tokensFromCache = true;
          appendDiagnostics(aggregated, snapshot.diagnostics);
        } else {
          snapshot = this.#flattenTokensSync(
            documentResult,
            aggregated,
            documentHash,
            input.flatten ?? true
          );
          if (snapshot && !hasErrors(snapshot.diagnostics)) {
            const entry = normalizeTokenCacheEntryDiagnostics(
              ensureDocumentHash(snapshot.token, documentHash),
              snapshot.diagnostics
            );
            ensureSynchronous(this.#tokenCache.set(key, entry), 'write token cache');
          }
        }
      } else {
        snapshot = this.#flattenTokensSync(
          documentResult,
          aggregated,
          documentHash,
          input.flatten ?? true
        );
      }
    }

    const diagnostics = finalizeDiagnostics(aggregated);
    this.#reportDiagnostics(diagnostics);

    return this.#createParseTokensExecution(documentResult, snapshot, diagnostics, tokensFromCache);
  }

  async #flattenTokens(
    documentResult: ParseDocumentExecution<TAst, TGraph, TResult>,
    aggregated: DiagnosticEvent[],
    documentHash: string | undefined,
    flatten: boolean
  ): Promise<TokenSnapshot<TokenCacheSnapshot> | undefined> {
    if (!documentResult.document || !documentResult.graph || !documentResult.resolution) {
      return undefined;
    }

    const result = await this.#flattening.flatten({
      document: documentResult.document,
      graph: documentResult.graph,
      resolution: documentResult.resolution,
      documentHash,
      flatten
    });
    appendDiagnostics(aggregated, result.diagnostics);

    const snapshot = result.outcome;
    if (!snapshot) {
      return undefined;
    }

    const tokenDiagnostics = aggregated.length > 0 ? Object.freeze(aggregated.slice()) : undefined;
    const token = ensureDocumentHash(snapshot.token, documentHash);

    return {
      token: tokenDiagnostics ? { ...token, diagnostics: tokenDiagnostics } : token,
      diagnostics: snapshot.diagnostics
    } satisfies TokenSnapshot<TokenCacheSnapshot>;
  }

  #flattenTokensSync(
    documentResult: ParseDocumentExecution<TAst, TGraph, TResult>,
    aggregated: DiagnosticEvent[],
    documentHash: string | undefined,
    flatten: boolean
  ): TokenSnapshot<TokenCacheSnapshot> | undefined {
    if (!documentResult.document || !documentResult.graph || !documentResult.resolution) {
      return undefined;
    }

    const result = ensureSynchronous(
      this.#flattening.flatten({
        document: documentResult.document,
        graph: documentResult.graph,
        resolution: documentResult.resolution,
        documentHash,
        flatten
      }),
      'flatten tokens'
    );
    appendDiagnostics(aggregated, result.diagnostics);

    const snapshot = result.outcome;
    if (!snapshot) {
      return undefined;
    }

    const tokenDiagnostics = aggregated.length > 0 ? Object.freeze(aggregated.slice()) : undefined;
    const token = ensureDocumentHash(snapshot.token, documentHash);

    return {
      token: tokenDiagnostics ? { ...token, diagnostics: tokenDiagnostics } : token,
      diagnostics: snapshot.diagnostics
    } satisfies TokenSnapshot<TokenCacheSnapshot>;
  }

  #reportDiagnostics(events: readonly DiagnosticEvent[]): void {
    if (!this.#diagnostics) {
      return;
    }

    this.#diagnostics.report({ events });
  }

  #resolveVariantValue(input: ParseTokensInput): string | undefined {
    if (input.variant) {
      return input.variant;
    }

    if (!this.#resolveVariant) {
      return undefined;
    }

    return this.#resolveVariant({
      flatten: input.flatten ?? true,
      includeGraphs: input.includeGraphs ?? true
    });
  }

  #createParseTokensExecution(
    documentResult: ParseDocumentExecution<TAst, TGraph, TResult>,
    snapshot: TokenSnapshot<TokenCacheSnapshot> | undefined,
    diagnostics: readonly DiagnosticEvent[],
    tokensFromCache: boolean
  ): ParseTokensExecution<TAst, TGraph, TResult> {
    return {
      ...documentResult,
      tokens: snapshot,
      diagnostics,
      tokensFromCache
    } satisfies ParseTokensExecution<TAst, TGraph, TResult>;
  }
}

const EMPTY_DIAGNOSTICS: readonly DiagnosticEvent[] = Object.freeze([]);

function appendDiagnostics(
  target: DiagnosticEvent[],
  diagnostics?: PipelineDiagnostics | readonly DiagnosticEvent[]
): boolean {
  const events = toDiagnosticEvents(diagnostics);
  if (!events || events.length === 0) {
    return false;
  }

  for (const event of events) {
    target.push(event);
  }

  return events.some((event) => event.severity === 'error');
}

function finalizeDiagnostics(aggregated: readonly DiagnosticEvent[]): readonly DiagnosticEvent[] {
  return aggregated.length === 0 ? EMPTY_DIAGNOSTICS : aggregated.slice();
}

function hasErrors(diagnostics?: PipelineDiagnostics | readonly DiagnosticEvent[]): boolean {
  const events = toDiagnosticEvents(diagnostics);
  if (!events) {
    return false;
  }

  return events.some((event) => event.severity === 'error');
}

function createSnapshotFromCache(entry: TokenCacheSnapshot): TokenSnapshot<TokenCacheSnapshot> {
  const diagnostics = entry.diagnostics ?? EMPTY_DIAGNOSTICS;
  return {
    token: entry,
    diagnostics
  } satisfies TokenSnapshot<TokenCacheSnapshot>;
}

function ensureDocumentHash(
  entry: TokenCacheSnapshot,
  documentHash: string | undefined
): TokenCacheSnapshot {
  if (!documentHash || entry.documentHash === documentHash) {
    return entry;
  }

  return { ...entry, documentHash } satisfies TokenCacheSnapshot;
}

function normalizeTokenCacheEntryDiagnostics(
  entry: TokenCacheSnapshot,
  diagnostics: readonly DiagnosticEvent[] | undefined
): TokenCacheSnapshot {
  const { diagnostics: existingDiagnostics, ...entryWithoutDiagnostics } = entry;

  if (diagnostics && diagnostics.length > 0) {
    return { ...entryWithoutDiagnostics, diagnostics } satisfies TokenCacheSnapshot;
  }

  if (!existingDiagnostics || existingDiagnostics.length === 0) {
    return entry;
  }

  return entryWithoutDiagnostics satisfies TokenCacheSnapshot;
}

function toDiagnosticEvents(
  diagnostics?: PipelineDiagnostics | readonly DiagnosticEvent[]
): readonly DiagnosticEvent[] | undefined {
  if (!diagnostics) {
    return undefined;
  }

  if (isDiagnosticEventArray(diagnostics)) {
    return diagnostics;
  }

  return diagnostics.events;
}

function isDiagnosticEventArray(
  diagnostics: PipelineDiagnostics | readonly DiagnosticEvent[]
): diagnostics is readonly DiagnosticEvent[] {
  return Array.isArray(diagnostics);
}

function createCacheReadEvent(error: unknown): DiagnosticEvent {
  return {
    code: DiagnosticCodes.core.CACHE_FAILED,
    message:
      error instanceof Error
        ? `Failed to read DTIF document from cache: ${error.message}`
        : 'Failed to read DTIF document from cache.',
    severity: 'warning'
  } satisfies DiagnosticEvent;
}

function createCacheWriteEvent(error: unknown): DiagnosticEvent {
  return {
    code: DiagnosticCodes.core.CACHE_FAILED,
    message:
      error instanceof Error
        ? `Failed to update DTIF document cache: ${error.message}`
        : 'Failed to update DTIF document cache.',
    severity: 'warning'
  } satisfies DiagnosticEvent;
}

function ensureSynchronous<T>(value: Promise<T> | T, stage: string): T {
  if (isPromise(value)) {
    throw new Error(`synchronous get/set semantics are required to ${stage}.`);
  }

  return value;
}

function isPromise<T>(value: Promise<T> | T): value is Promise<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const then = Reflect.get(value, 'then');
  return typeof then === 'function';
}
