import type {
  DecodedDocument,
  GraphSnapshot,
  NormalizedDocument,
  PipelineResult,
  RawDocument,
  ResolutionOutcome,
  TokenSnapshot
} from './models.js';
import type {
  DocumentRequest,
  DocumentSourcePort,
  GraphBuilderPort,
  NormalizationPort,
  ResolutionContext,
  ResolutionPort,
  SchemaValidationPort,
  TokenFlatteningPort,
  TokenFlatteningRequest
} from './ports.js';
export type { ResolutionContext } from './ports.js';

export interface DocumentIngestionService {
  readonly source: DocumentSourcePort;
  ingest(
    request: DocumentRequest
  ): Promise<PipelineResult<RawDocument | undefined>> | PipelineResult<RawDocument | undefined>;
}

export interface DocumentDecodingService {
  decode(
    document: RawDocument
  ):
    | Promise<PipelineResult<DecodedDocument | undefined>>
    | PipelineResult<DecodedDocument | undefined>;
}

export interface SchemaValidationService {
  readonly validator: SchemaValidationPort;
  validate(document: DecodedDocument): Promise<PipelineResult<boolean>> | PipelineResult<boolean>;
}

export interface DocumentNormalizationService<TAst = unknown> {
  readonly normalizer: NormalizationPort<TAst>;
  normalize(
    document: DecodedDocument
  ):
    | Promise<PipelineResult<NormalizedDocument<TAst> | undefined>>
    | PipelineResult<NormalizedDocument<TAst> | undefined>;
}

export interface GraphConstructionService<TGraph = unknown, TAst = unknown> {
  readonly builder: GraphBuilderPort<TGraph, TAst>;
  build(
    document: NormalizedDocument<TAst>
  ):
    | Promise<PipelineResult<GraphSnapshot<TGraph> | undefined>>
    | PipelineResult<GraphSnapshot<TGraph> | undefined>;
}
export interface ResolutionService<TGraph = unknown, TResult = unknown, TAst = unknown> {
  readonly resolver: ResolutionPort<TGraph, TResult>;
  resolve(
    graph: GraphSnapshot<TGraph>,
    context: ResolutionContext<TAst>
  ):
    | Promise<PipelineResult<ResolutionOutcome<TResult> | undefined>>
    | PipelineResult<ResolutionOutcome<TResult> | undefined>;
}

export interface TokenFlatteningService<
  TResolution = unknown,
  TGraph = unknown,
  TSnapshot = TResolution
> {
  readonly flattener: TokenFlatteningPort<TResolution, TGraph, TSnapshot>;
  flatten(
    request: TokenFlatteningRequest<TGraph, TResolution>
  ):
    | Promise<PipelineResult<TokenSnapshot<TSnapshot> | undefined>>
    | PipelineResult<TokenSnapshot<TSnapshot> | undefined>;
}
