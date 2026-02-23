import type {
  DecodedDocument,
  GraphSnapshot,
  NormalizedDocument,
  PipelineDiagnostics,
  PipelineResult,
  RawDocument,
  RawDocumentIdentity,
  ResolutionOutcome,
  TokenSnapshot
} from './models.js';
import type { DocumentContentType } from './primitives.js';

export interface DocumentRequest {
  readonly uri?: string | URL;
  readonly inlineContent?: string | Uint8Array;
  readonly inlineData?: unknown;
  readonly contentTypeHint?: DocumentContentType | (string & {});
  readonly description?: string;
  readonly baseUri?: URL;
  readonly signal?: AbortSignal;
}

export interface DocumentSourcePort {
  load(request: DocumentRequest): Promise<RawDocument> | RawDocument;
}

export interface DocumentCachePort {
  get(identity: RawDocumentIdentity): Promise<RawDocument | undefined> | RawDocument | undefined;
  set(document: RawDocument): Promise<void> | void;
  delete?(identity: RawDocumentIdentity): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface TokenCacheKey {
  readonly document: RawDocumentIdentity;
  readonly variant?: string;
}

export interface TokenCachePort<TResult = unknown> {
  get(key: TokenCacheKey): Promise<TResult | undefined> | TResult | undefined;
  set(key: TokenCacheKey, snapshot: TResult): Promise<void> | void;
}

export interface DiagnosticPort {
  report(diagnostics: PipelineDiagnostics): void;
}

export interface TelemetryPort {
  record(metric: TelemetryMetric): void;
}

export interface TelemetryMetric {
  readonly name: string;
  readonly value: number;
  readonly tags?: ReadonlyMap<string, string> | Record<string, string>;
}

export interface ExtensionCollectorPort<TContext = unknown, TResult = unknown> {
  collect(context: TContext): Promise<TResult> | TResult;
}

export interface TransformExecutorPort<TInput = unknown, TResult = unknown> {
  execute(input: TInput): Promise<TResult> | TResult;
}

export interface SchemaValidationPort {
  validate(document: DecodedDocument): Promise<PipelineDiagnostics> | PipelineDiagnostics;
}

export interface NormalizationPort<TAst = unknown> {
  normalize(
    document: DecodedDocument
  ):
    | Promise<PipelineResult<NormalizedDocument<TAst> | undefined>>
    | PipelineResult<NormalizedDocument<TAst> | undefined>;
}

export interface GraphBuilderPort<TGraph = unknown, TAst = unknown> {
  build(
    document: NormalizedDocument<TAst>
  ):
    | Promise<PipelineResult<GraphSnapshot<TGraph> | undefined>>
    | PipelineResult<GraphSnapshot<TGraph> | undefined>;
}

export interface ResolutionContext<TAst = unknown> {
  readonly document: RawDocument;
  readonly decoded: DecodedDocument;
  readonly normalized?: NormalizedDocument<TAst>;
}

export interface ResolutionPort<TGraph = unknown, TResult = unknown, TAst = unknown> {
  resolve(
    graph: GraphSnapshot<TGraph>,
    context: ResolutionContext<TAst>
  ):
    | Promise<PipelineResult<ResolutionOutcome<TResult> | undefined>>
    | PipelineResult<ResolutionOutcome<TResult> | undefined>;
}

export interface TokenFlatteningRequest<TGraph = unknown, TResolution = unknown> {
  readonly document: RawDocument;
  readonly graph: GraphSnapshot<TGraph>;
  readonly resolution: ResolutionOutcome<TResolution>;
  readonly documentHash?: string;
  readonly flatten: boolean;
}

export interface TokenFlatteningPort<
  TResolution = unknown,
  TGraph = unknown,
  TSnapshot = TResolution
> {
  flatten(
    request: TokenFlatteningRequest<TGraph, TResolution>
  ):
    | Promise<PipelineResult<TokenSnapshot<TSnapshot> | undefined>>
    | PipelineResult<TokenSnapshot<TSnapshot> | undefined>;
}
