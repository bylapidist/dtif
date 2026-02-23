import type {
  DiagnosticCode,
  DocumentContentType,
  JsonPointer,
  SourceMap,
  SourceSpan
} from './primitives.js';

export interface RawDocumentIdentity {
  readonly uri: URL;
  readonly contentType: DocumentContentType;
  readonly description?: string;
}

export interface RawDocument {
  readonly identity: RawDocumentIdentity;
  readonly bytes: Uint8Array;
  readonly text?: string;
  readonly data?: unknown;
  readonly sourceMap?: SourceMap;
}

export interface DecodedDocument {
  readonly identity: RawDocumentIdentity;
  readonly text: string;
  readonly data: unknown;
  readonly bytes: Uint8Array;
  readonly sourceMap?: SourceMap;
}

export interface DiagnosticEvent {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly pointer?: JsonPointer;
  readonly span?: SourceSpan;
  readonly related?: readonly DiagnosticEventRelatedInformation[];
}

export interface DiagnosticEventRelatedInformation {
  readonly message: string;
  readonly pointer?: JsonPointer;
  readonly span?: SourceSpan;
}

export interface NormalizedDocument<TAst = unknown> {
  readonly identity: RawDocumentIdentity;
  readonly ast: TAst;
  readonly extensions?: readonly ExtensionEvaluationSnapshot[];
}

export interface GraphSnapshot<TGraph = unknown> {
  readonly identity: RawDocumentIdentity;
  readonly graph: TGraph;
}

export interface ResolutionOutcome<TResult = unknown> {
  readonly identity: RawDocumentIdentity;
  readonly result: TResult;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface TokenSnapshot<TToken = unknown> {
  readonly token: TToken;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface ExtensionInvocation {
  readonly namespace: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly value: unknown;
}

export interface ExtensionCollectionContext {
  readonly document: DecodedDocument;
  readonly invocations: readonly ExtensionInvocation[];
}

export interface ExtensionEvaluationSnapshot {
  readonly plugin: string;
  readonly namespace: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly value: unknown;
  readonly normalized?: unknown;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface TransformExecutionContext<TToken = unknown> {
  readonly document: DecodedDocument;
  readonly token: TToken;
}

export interface TokenTransformEvaluationSnapshot {
  readonly plugin: string;
  readonly pointer: JsonPointer;
  readonly data?: unknown;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface PipelineDiagnostics {
  readonly events: readonly DiagnosticEvent[];
}

export interface PipelineResult<TResult> {
  readonly outcome: TResult;
  readonly diagnostics: PipelineDiagnostics;
}
