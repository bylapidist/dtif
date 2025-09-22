import type { DiagnosticSeverity } from '../types.js';
import type { AppliedOverride, ResolutionResult, ResolvedToken } from '../resolver/index.js';
import type { Diagnostic, JsonPointer, ParseInput, SourcePosition, SourceSpan } from '../types.js';

export interface CliOptions {
  readonly inputs: readonly string[];
  readonly allowHttp: boolean;
  readonly maxDepth?: number;
  readonly format: 'pretty' | 'json';
  readonly pointers: readonly JsonPointer[];
  readonly context: ReadonlyMap<string, unknown>;
}

export interface CliArgumentsResult {
  readonly kind: 'run';
  readonly options: CliOptions;
}

export interface CliHelpResult {
  readonly kind: 'help';
}

export interface CliVersionResult {
  readonly kind: 'version';
}

export interface CliErrorResult {
  readonly kind: 'error';
  readonly message: string;
}

export type CliArguments = CliArgumentsResult | CliHelpResult | CliVersionResult | CliErrorResult;

export interface CliIo {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

export interface CliRunOptions {
  readonly stdin?: NodeJS.ReadableStream;
  readonly stdout?: NodeJS.WritableStream;
  readonly stderr?: NodeJS.WritableStream;
}

export interface DiagnosticsSummary {
  readonly total: number;
  readonly error: number;
  readonly warning: number;
  readonly info: number;
}

export interface SerializablePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SerializableSpan {
  readonly uri: string;
  readonly start: SerializablePosition;
  readonly end: SerializablePosition;
}

export interface SerializableDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly pointer?: JsonPointer;
  readonly span?: SerializableSpan;
  readonly related?: readonly SerializableRelatedInformation[];
}

export interface SerializableRelatedInformation {
  readonly message: string;
  readonly pointer?: JsonPointer;
  readonly span?: SerializableSpan;
}

export interface SerializableResolutionSource {
  readonly uri: string;
  readonly pointer: JsonPointer;
  readonly span?: SerializableSpan;
}

export interface SerializableAppliedOverride {
  readonly pointer: JsonPointer;
  readonly kind: AppliedOverride['kind'];
  readonly depth: number;
  readonly span?: SerializableSpan;
  readonly source?: SerializableResolutionSource;
}

export interface SerializableTraceStep {
  readonly pointer: JsonPointer;
  readonly kind: 'token' | 'alias' | 'override' | 'fallback';
  readonly span?: SerializableSpan;
}

export interface SerializableResolvedToken {
  readonly pointer: JsonPointer;
  readonly uri: string;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: SerializableResolutionSource;
  readonly overridesApplied: readonly SerializableAppliedOverride[];
  readonly warnings: readonly SerializableDiagnostic[];
  readonly trace: readonly SerializableTraceStep[];
}

export interface ResolutionSummary {
  readonly pointer: JsonPointer;
  readonly token?: SerializableResolvedToken;
  readonly diagnostics: readonly SerializableDiagnostic[];
}

export interface DocumentSummary {
  readonly uri: string | null;
  readonly diagnostics: readonly SerializableDiagnostic[];
  readonly diagnosticCounts: DiagnosticsSummary;
  readonly resolverAvailable: boolean;
  readonly resolutions?: Readonly<Record<string, ResolutionSummary>>;
}

export interface CliOutput {
  readonly documents: readonly DocumentSummary[];
  readonly diagnostics: readonly SerializableDiagnostic[];
  readonly summary: DiagnosticsSummary;
}

export interface GatherInputsResult {
  readonly inputs: ParseInput[];
  readonly errors: string[];
}

export interface ResolutionSerializer {
  serialize(pointer: JsonPointer, resolution: ResolutionResult): ResolutionSummary;
  serializeToken(token: ResolvedToken): SerializableResolvedToken;
}
