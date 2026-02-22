import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { normalizeDocument } from '../../ast/normaliser.js';
import { buildDocumentGraph } from '../../graph/builder.js';
import { createDocumentResolver } from '../../resolver/index.js';
import { decodeDocument } from '../../io/decoder.js';
import { DocumentLoaderError } from '../../io/document-loader.js';
import type { DocumentHandle } from '../../types.js';
import type { SchemaGuard } from '../../validation/schema-guard.js';
import type { ResolvedTokenTransformEntry } from '../../plugins/registry.js';
import type { PluginRegistry } from '../../plugins/index.js';
import type { ExtensionEvaluation } from '../../plugins/types.js';
import { flattenTokens } from '../../tokens/flatten.js';
import { createMetadataSnapshot, createResolutionSnapshot } from '../../tokens/snapshots.js';
import { computeDocumentHash } from '../../tokens/cache.js';
import type { TokenCacheSnapshot } from '../../tokens/cache.js';
import type { InlineDocumentRequestInput } from '../../application/requests.js';
import { createInlineDocumentHandle, decodeInlineDocument } from '../../application/inline.js';
import {
  EMPTY_PIPELINE_DIAGNOSTICS,
  toDomainDiagnostic,
  toPipelineDiagnostics
} from './diagnostics.js';
import type {
  DecodedDocument,
  DiagnosticEvent,
  ExtensionEvaluationSnapshot,
  GraphSnapshot,
  NormalizedDocument,
  PipelineDiagnostics,
  PipelineResult,
  RawDocument,
  ResolutionOutcome,
  TokenSnapshot
} from '../../domain/models.js';
import type {
  DocumentDecodingService,
  DocumentIngestionService,
  DocumentNormalizationService,
  GraphConstructionService,
  ResolutionContext,
  ResolutionService,
  SchemaValidationService,
  TokenFlatteningService
} from '../../domain/services.js';
import type {
  DocumentRequest,
  DocumentSourcePort,
  GraphBuilderPort,
  NormalizationPort,
  ResolutionPort,
  SchemaValidationPort,
  TokenFlatteningPort,
  TokenFlatteningRequest
} from '../../domain/ports.js';
import type { DocumentAst } from '../../ast/nodes.js';
import type { DocumentGraph } from '../../graph/nodes.js';
import type { DocumentLoader } from '../../io/document-loader.js';
import type { GraphOverrideFallbackNode, GraphReferenceTarget } from '../../graph/nodes.js';

const EMPTY_RESOLUTION_EVENTS: readonly DiagnosticEvent[] = Object.freeze([]);

export class DocumentIngestionAdapter implements DocumentIngestionService {
  readonly source: DocumentSourcePort;

  constructor(source: DocumentSourcePort) {
    this.source = source;
  }

  async ingest(request: DocumentRequest): Promise<PipelineResult<RawDocument | undefined>> {
    try {
      const document = await this.source.load(request);
      return {
        outcome: document,
        diagnostics: EMPTY_PIPELINE_DIAGNOSTICS
      } satisfies PipelineResult<RawDocument>;
    } catch (error) {
      return {
        outcome: undefined,
        diagnostics: createLoaderDiagnostics(error)
      } satisfies PipelineResult<RawDocument | undefined>;
    }
  }
}

export class InlineDocumentIngestionAdapter implements DocumentIngestionService {
  readonly #input: InlineDocumentRequestInput;
  readonly source: DocumentSourcePort;

  constructor(input: InlineDocumentRequestInput) {
    this.#input = input;
    this.source = {
      load: (request) => this.#createDocument(request)
    } satisfies DocumentSourcePort;
  }

  ingest(request: DocumentRequest): PipelineResult<RawDocument | undefined> {
    try {
      const document = this.#createDocument(request);
      return {
        outcome: document,
        diagnostics: EMPTY_PIPELINE_DIAGNOSTICS
      } satisfies PipelineResult<RawDocument>;
    } catch (error) {
      return {
        outcome: undefined,
        diagnostics: createFailureDiagnostics(
          DiagnosticCodes.loader.FAILED,
          error instanceof Error ? error.message : 'Failed to load inline DTIF document.'
        )
      } satisfies PipelineResult<RawDocument | undefined>;
    }
  }

  #createDocument(request: DocumentRequest): RawDocument {
    const handle = createInlineDocumentHandle(this.#input);
    const decoded = decodeInlineDocument(handle);
    const identity = Object.freeze({
      uri: decoded.identity.uri,
      contentType: decoded.identity.contentType,
      description: request.description
    });

    return Object.freeze({
      identity,
      bytes: decoded.bytes,
      text: decoded.text,
      data: decoded.data,
      sourceMap: decoded.sourceMap
    }) satisfies RawDocument;
  }
}

export interface DocumentDecodingAdapterOptions {
  readonly decode?: typeof decodeDocument;
}

export class DocumentDecodingAdapter implements DocumentDecodingService {
  readonly #decode: typeof decodeDocument;

  constructor(options: DocumentDecodingAdapterOptions = {}) {
    this.#decode = options.decode ?? decodeDocument;
  }

  async decode(document: RawDocument): Promise<PipelineResult<DecodedDocument | undefined>> {
    if (hasDecodedPayload(document)) {
      return {
        outcome: freezeDecodedDocument({
          identity: document.identity,
          text: document.text ?? '',
          data: document.data ?? {},
          bytes: document.bytes,
          sourceMap: document.sourceMap
        }),
        diagnostics: EMPTY_PIPELINE_DIAGNOSTICS
      } satisfies PipelineResult<DecodedDocument>;
    }

    try {
      const handle = toDocumentHandle(document);
      const decoded = await this.#decode(handle);
      return {
        outcome: freezeDecodedDocument({
          identity: document.identity,
          text: decoded.text,
          data: decoded.data,
          bytes: decoded.bytes,
          sourceMap: decoded.sourceMap
        }),
        diagnostics: EMPTY_PIPELINE_DIAGNOSTICS
      } satisfies PipelineResult<DecodedDocument>;
    } catch (error) {
      return {
        outcome: undefined,
        diagnostics: createFailureDiagnostics(
          DiagnosticCodes.decoder.FAILED,
          error instanceof Error ? error.message : 'Failed to decode DTIF document.'
        )
      } satisfies PipelineResult<DecodedDocument | undefined>;
    }
  }
}

export class InlineDocumentDecodingAdapter implements DocumentDecodingService {
  decode(document: RawDocument): PipelineResult<DecodedDocument | undefined> {
    if (
      document.text === undefined ||
      document.data === undefined ||
      document.sourceMap === undefined
    ) {
      return {
        outcome: undefined,
        diagnostics: createFailureDiagnostics(
          DiagnosticCodes.decoder.FAILED,
          'Inline document ingestion requires decoded content.'
        )
      } satisfies PipelineResult<DecodedDocument | undefined>;
    }

    const decoded: DecodedDocument = Object.freeze({
      identity: document.identity,
      text: document.text,
      data: document.data,
      bytes: document.bytes,
      sourceMap: document.sourceMap
    });

    return {
      outcome: decoded,
      diagnostics: EMPTY_PIPELINE_DIAGNOSTICS
    } satisfies PipelineResult<DecodedDocument>;
  }
}

export class SchemaValidationAdapter implements SchemaValidationService {
  readonly validator: SchemaValidationPort;
  readonly #guard: SchemaGuard;

  constructor(guard: SchemaGuard) {
    this.#guard = guard;
    this.validator = {
      validate: (document) => this.validate(document).diagnostics
    } satisfies SchemaValidationPort;
  }

  validate(document: DecodedDocument): PipelineResult<boolean> {
    try {
      const result = this.#guard.validate(document);
      return {
        outcome: result.valid,
        diagnostics: toPipelineDiagnostics(result.diagnostics)
      } satisfies PipelineResult<boolean>;
    } catch (error) {
      return {
        outcome: false,
        diagnostics: createFailureDiagnostics(
          DiagnosticCodes.schemaGuard.FAILED,
          error instanceof Error
            ? error.message
            : 'Failed to validate DTIF document against the schema.'
        )
      } satisfies PipelineResult<boolean>;
    }
  }
}

export interface DocumentNormalizationAdapterOptions {
  readonly normalizer?: NormalizationPort<DocumentAst>;
  readonly extensions?: PluginRegistry;
}

export class DocumentNormalizationAdapter implements DocumentNormalizationService<DocumentAst> {
  readonly normalizer: NormalizationPort<DocumentAst>;

  constructor(options: DocumentNormalizationAdapterOptions = {}) {
    this.normalizer =
      options.normalizer ??
      ({
        normalize: (document) => normalizeDecodedDocument(document, options.extensions)
      } satisfies NormalizationPort<DocumentAst>);
  }

  normalize(
    document: DecodedDocument
  ):
    | Promise<PipelineResult<NormalizedDocument<DocumentAst> | undefined>>
    | PipelineResult<NormalizedDocument<DocumentAst> | undefined> {
    return this.normalizer.normalize(document);
  }
}

export class GraphConstructionAdapter implements GraphConstructionService<
  DocumentGraph,
  DocumentAst
> {
  readonly builder: GraphBuilderPort<DocumentGraph, DocumentAst>;

  constructor(builder?: GraphBuilderPort<DocumentGraph, DocumentAst>) {
    this.builder =
      builder ??
      ({
        build: (document) => buildGraphSnapshot(document)
      } satisfies GraphBuilderPort<DocumentGraph, DocumentAst>);
  }

  build(
    document: NormalizedDocument<DocumentAst>
  ):
    | Promise<PipelineResult<GraphSnapshot<DocumentGraph> | undefined>>
    | PipelineResult<GraphSnapshot<DocumentGraph> | undefined> {
    return this.builder.build(document);
  }
}

export interface ResolutionAdapterOptions {
  readonly overrideContext?: ReadonlyMap<string, unknown>;
  readonly maxDepth?: number;
  readonly transforms?: readonly ResolvedTokenTransformEntry[];
  readonly loader?: DocumentLoader;
  readonly schemaGuard?: SchemaGuard;
  readonly extensions?: PluginRegistry;
  readonly allowNetworkReferences?: boolean;
}

type ResolverInstance = ReturnType<typeof createDocumentResolver>;

export class ResolutionAdapter implements ResolutionService<
  DocumentGraph,
  ResolverInstance,
  DocumentAst
> {
  readonly resolver: ResolutionPort<DocumentGraph, ResolverInstance, DocumentAst>;
  readonly #overrideContext: ReadonlyMap<string, unknown>;
  readonly #maxDepth: number;
  readonly #transforms: readonly ResolvedTokenTransformEntry[];
  readonly #loader?: DocumentLoader;
  readonly #schemaGuard?: SchemaGuard;
  readonly #extensions?: PluginRegistry;
  readonly #allowNetworkReferences: boolean;

  constructor(options: ResolutionAdapterOptions = {}) {
    this.#overrideContext = options.overrideContext ?? new Map();
    this.#maxDepth = options.maxDepth ?? 32;
    this.#transforms = options.transforms ?? [];
    this.#loader = options.loader;
    this.#schemaGuard = options.schemaGuard;
    this.#extensions = options.extensions;
    this.#allowNetworkReferences = options.allowNetworkReferences ?? false;
    this.resolver = {
      resolve: (graph, context) => this.resolve(graph, context)
    } satisfies ResolutionPort<DocumentGraph, ResolverInstance, DocumentAst>;
  }

  resolve(
    graph: GraphSnapshot<DocumentGraph>,
    context: ResolutionContext<DocumentAst>
  ):
    | PipelineResult<ResolutionOutcome<ResolverInstance> | undefined>
    | Promise<PipelineResult<ResolutionOutcome<ResolverInstance> | undefined>> {
    const externalTargets = collectExternalReferenceTargets(graph.graph);
    const loader = this.#loader;
    const schemaGuard = this.#schemaGuard;
    if (externalTargets.length > 0 && loader && schemaGuard) {
      return this.resolveWithExternalGraphs(graph, context, externalTargets, loader, schemaGuard);
    }

    try {
      const resolver = createDocumentResolver(graph.graph, {
        context: this.#overrideContext,
        maxDepth: this.#maxDepth,
        document: context.decoded,
        transforms: this.#transforms,
        allowNetworkReferences: this.#allowNetworkReferences
      });

      const outcome: ResolutionOutcome<ResolverInstance> = Object.freeze({
        identity: graph.identity,
        result: resolver,
        diagnostics: EMPTY_RESOLUTION_EVENTS
      });

      return {
        outcome,
        diagnostics: EMPTY_PIPELINE_DIAGNOSTICS
      } satisfies PipelineResult<ResolutionOutcome<ResolverInstance>>;
    } catch (error) {
      return {
        outcome: undefined,
        diagnostics: createFailureDiagnostics(
          DiagnosticCodes.resolver.FAILED,
          error instanceof Error ? error.message : 'Failed to create document resolver.'
        )
      } satisfies PipelineResult<ResolutionOutcome<ResolverInstance> | undefined>;
    }
  }

  private async resolveWithExternalGraphs(
    graph: GraphSnapshot<DocumentGraph>,
    context: ResolutionContext<DocumentAst>,
    externalTargets: readonly GraphReferenceTarget[],
    loader: DocumentLoader,
    schemaGuard: SchemaGuard
  ): Promise<PipelineResult<ResolutionOutcome<ResolverInstance> | undefined>> {
    const externalGraphs = new Map<string, DocumentGraph>();
    const diagnostics: DiagnosticEvent[] = [];
    const queue = [...externalTargets];
    const visited = new Set<string>([graph.graph.uri.href]);

    while (queue.length > 0) {
      const target = queue.shift();
      if (!target) {
        continue;
      }

      const href = target.uri.href;
      if (visited.has(href)) {
        continue;
      }
      visited.add(href);

      const protocol = target.uri.protocol.toLowerCase();
      const networkReference = protocol === 'http:' || protocol === 'https:';
      if (networkReference && !this.#allowNetworkReferences) {
        continue;
      }

      try {
        const handle = await loader.load(target.uri, { baseUri: context.document.identity.uri });
        const decoded = await decodeDocument(handle);
        const validation = schemaGuard.validate(decoded);
        diagnostics.push(...validation.diagnostics);
        if (!validation.valid) {
          continue;
        }

        const normalized = normalizeDocument(decoded, { extensions: this.#extensions });
        diagnostics.push(...normalized.diagnostics);
        if (!normalized.ast) {
          continue;
        }

        const graphResult = buildDocumentGraph(normalized.ast);
        diagnostics.push(...graphResult.diagnostics.map(toDomainDiagnostic));
        if (!graphResult.graph) {
          continue;
        }

        const loadedGraph = graphResult.graph;
        externalGraphs.set(loadedGraph.uri.href, loadedGraph);
        const nestedTargets = collectExternalReferenceTargets(loadedGraph);
        for (const nested of nestedTargets) {
          if (!visited.has(nested.uri.href)) {
            queue.push(nested);
          }
        }
      } catch (error) {
        const code =
          error instanceof DocumentLoaderError
            ? DiagnosticCodes.loader.TOO_LARGE
            : DiagnosticCodes.resolver.EXTERNAL_REFERENCE;
        diagnostics.push({
          code,
          message:
            error instanceof Error
              ? error.message
              : `Failed to load external DTIF document "${href}".`,
          severity: 'error',
          pointer: target.pointer
        });
      }
    }

    try {
      const resolver = createDocumentResolver(graph.graph, {
        context: this.#overrideContext,
        maxDepth: this.#maxDepth,
        document: context.decoded,
        transforms: this.#transforms,
        externalGraphs,
        allowNetworkReferences: this.#allowNetworkReferences
      });

      const outcome: ResolutionOutcome<ResolverInstance> = Object.freeze({
        identity: graph.identity,
        result: resolver,
        diagnostics: diagnostics.length === 0 ? EMPTY_RESOLUTION_EVENTS : Object.freeze(diagnostics)
      });

      return {
        outcome,
        diagnostics: EMPTY_PIPELINE_DIAGNOSTICS
      } satisfies PipelineResult<ResolutionOutcome<ResolverInstance>>;
    } catch (error) {
      return {
        outcome: undefined,
        diagnostics: createFailureDiagnostics(
          DiagnosticCodes.resolver.FAILED,
          error instanceof Error ? error.message : 'Failed to create document resolver.'
        )
      } satisfies PipelineResult<ResolutionOutcome<ResolverInstance> | undefined>;
    }
  }
}

export interface TokenFlatteningAdapterOptions {
  readonly metadataSnapshot?: typeof createMetadataSnapshot;
  readonly resolutionSnapshot?: typeof createResolutionSnapshot;
  readonly flattenTokens?: typeof flattenTokens;
  readonly clock?: () => number;
}

export class TokenFlatteningAdapter implements TokenFlatteningService<
  ResolverInstance,
  DocumentGraph,
  TokenCacheSnapshot
> {
  readonly flattener: TokenFlatteningPort<ResolverInstance, DocumentGraph, TokenCacheSnapshot>;
  readonly #metadataSnapshot: typeof createMetadataSnapshot;
  readonly #resolutionSnapshot: typeof createResolutionSnapshot;
  readonly #flattenTokens: typeof flattenTokens;
  readonly #clock: () => number;

  constructor(options: TokenFlatteningAdapterOptions = {}) {
    this.#metadataSnapshot = options.metadataSnapshot ?? createMetadataSnapshot;
    this.#resolutionSnapshot = options.resolutionSnapshot ?? createResolutionSnapshot;
    this.#flattenTokens = options.flattenTokens ?? flattenTokens;
    this.#clock = options.clock ?? Date.now;
    this.flattener = {
      flatten: (request) => this.flatten(request)
    } satisfies TokenFlatteningPort<ResolverInstance, DocumentGraph, TokenCacheSnapshot>;
  }

  flatten(
    request: TokenFlatteningRequest<DocumentGraph, ResolverInstance>
  ): PipelineResult<TokenSnapshot<TokenCacheSnapshot> | undefined> {
    const { document, graph, resolution, documentHash, flatten } = request;

    const metadataIndex = this.#metadataSnapshot(graph.graph);
    let resolutionIndex: TokenCacheSnapshot['resolutionIndex'];
    let flattenedTokens: TokenCacheSnapshot['flattened'];
    const resolutionDiagnostics: DiagnosticEvent[] = [];

    if (flatten) {
      resolutionIndex = this.#resolutionSnapshot(graph.graph, resolution.result, {
        onDiagnostic: (diagnostic) => {
          resolutionDiagnostics.push(diagnostic);
        }
      });
      flattenedTokens = this.#flattenTokens(graph.graph, resolutionIndex);
    }

    const snapshotDiagnostics =
      resolutionDiagnostics.length > 0
        ? Object.freeze(resolutionDiagnostics.map(toDomainDiagnostic))
        : EMPTY_RESOLUTION_EVENTS;

    const entryDiagnostics =
      resolutionDiagnostics.length > 0
        ? Object.freeze(resolutionDiagnostics.map(toDomainDiagnostic))
        : undefined;

    const entry: TokenCacheSnapshot = {
      documentHash: documentHash ?? computeDocumentHash(document),
      flattened: flatten ? (flattenedTokens ?? []) : undefined,
      metadataIndex,
      resolutionIndex: flatten ? resolutionIndex : undefined,
      diagnostics: entryDiagnostics,
      timestamp: this.#clock()
    } satisfies TokenCacheSnapshot;

    const snapshot: TokenSnapshot<TokenCacheSnapshot> = {
      token: entry,
      diagnostics: snapshotDiagnostics
    } satisfies TokenSnapshot<TokenCacheSnapshot>;

    const diagnostics: PipelineDiagnostics = snapshotDiagnostics.length
      ? { events: snapshotDiagnostics }
      : EMPTY_PIPELINE_DIAGNOSTICS;

    return { outcome: snapshot, diagnostics } satisfies PipelineResult<
      TokenSnapshot<TokenCacheSnapshot> | undefined
    >;
  }
}

function hasDecodedPayload(document: RawDocument): boolean {
  return (
    document.text !== undefined && document.data !== undefined && document.sourceMap !== undefined
  );
}

function toDocumentHandle(document: RawDocument): DocumentHandle {
  return {
    uri: document.identity.uri,
    contentType: document.identity.contentType,
    bytes: document.bytes,
    text: document.text,
    data: document.data
  } satisfies DocumentHandle;
}

function freezeDecodedDocument(decoded: DecodedDocument): DecodedDocument {
  const identity = Object.freeze({
    uri: decoded.identity.uri,
    contentType: decoded.identity.contentType,
    description: decoded.identity.description
  });

  return Object.freeze({
    ...decoded,
    identity,
    sourceMap: decoded.sourceMap
  });
}

function createFailureDiagnostics(code: string, message: string): PipelineDiagnostics {
  const event: DiagnosticEvent = Object.freeze({
    code,
    message,
    severity: 'error'
  });

  return { events: Object.freeze([event]) } satisfies PipelineDiagnostics;
}

function createLoaderDiagnostics(error: unknown): PipelineDiagnostics {
  if (error instanceof DocumentLoaderError) {
    return createFailureDiagnostics(DiagnosticCodes.loader.TOO_LARGE, error.message);
  }

  const message = error instanceof Error ? error.message : 'Failed to load DTIF document.';
  return createFailureDiagnostics(DiagnosticCodes.loader.FAILED, message);
}

function normalizeDecodedDocument(
  document: DecodedDocument,
  extensions?: PluginRegistry
): PipelineResult<NormalizedDocument<DocumentAst> | undefined> {
  try {
    const result = normalizeDocument(document, {
      extensions
    });
    const diagnostics = toPipelineDiagnostics(result.diagnostics);
    const outcome = result.ast
      ? Object.freeze({
          identity: document.identity,
          ast: result.ast,
          extensions: toExtensionSnapshots(result.extensions)
        })
      : undefined;

    return { outcome, diagnostics } satisfies PipelineResult<
      NormalizedDocument<DocumentAst> | undefined
    >;
  } catch (error) {
    return {
      outcome: undefined,
      diagnostics: createFailureDiagnostics(
        DiagnosticCodes.normaliser.FAILED,
        error instanceof Error ? error.message : 'Failed to normalise DTIF document.'
      )
    } satisfies PipelineResult<NormalizedDocument<DocumentAst> | undefined>;
  }
}

function buildGraphSnapshot(
  document: NormalizedDocument<DocumentAst>
): PipelineResult<GraphSnapshot<DocumentGraph> | undefined> {
  const result = buildDocumentGraph(document.ast);
  const diagnostics = toPipelineDiagnostics(result.diagnostics);
  const outcome = result.graph
    ? Object.freeze({ identity: document.identity, graph: result.graph })
    : undefined;

  return { outcome, diagnostics } satisfies PipelineResult<
    GraphSnapshot<DocumentGraph> | undefined
  >;
}

function collectExternalReferenceTargets(graph: DocumentGraph): readonly GraphReferenceTarget[] {
  const targets: GraphReferenceTarget[] = [];

  for (const node of graph.nodes.values()) {
    if (node.kind === 'alias' && node.ref.value.external) {
      targets.push(node.ref.value);
    }
  }

  for (const override of graph.overrides) {
    if (override.token.value.external) {
      targets.push(override.token.value);
    }
    if (override.ref?.value.external) {
      targets.push(override.ref.value);
    }
    if (override.fallback) {
      collectExternalFallbackTargets(override.fallback, targets);
    }
  }

  return Object.freeze(targets);
}

function collectExternalFallbackTargets(
  entries: readonly GraphOverrideFallbackNode[],
  targets: GraphReferenceTarget[]
): void {
  for (const entry of entries) {
    if (entry.ref?.value.external) {
      targets.push(entry.ref.value);
    }
    if (entry.fallback && entry.fallback.length > 0) {
      collectExternalFallbackTargets(entry.fallback, targets);
    }
  }
}

function toExtensionSnapshots(
  extensions?: readonly ExtensionEvaluation[]
): readonly ExtensionEvaluationSnapshot[] | undefined {
  if (!extensions || extensions.length === 0) {
    return undefined;
  }

  return Object.freeze(
    extensions.map(
      (extension) =>
        Object.freeze({
          plugin: extension.plugin,
          namespace: extension.namespace,
          pointer: extension.pointer,
          span: extension.span,
          value: extension.value,
          normalized: extension.normalized,
          diagnostics:
            extension.diagnostics.length === 0
              ? Object.freeze([])
              : Object.freeze(extension.diagnostics.map(toDomainDiagnostic))
        }) satisfies ExtensionEvaluationSnapshot
    )
  );
}
