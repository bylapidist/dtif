import type { DecodedDocument, DiagnosticEvent } from '../domain/models.js';
import type { JsonPointer, SourceSpan } from '../domain/primitives.js';
import type {
  ResolvedTokenTransformEntry,
  ResolvedTokenTransformEvaluation
} from '../plugins/index.js';
import type { GraphOverrideNode } from '../graph/nodes.js';

export interface DocumentResolverOptions {
  readonly context?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  readonly maxDepth?: number;
  readonly document?: DecodedDocument;
  readonly transforms?: readonly ResolvedTokenTransformEntry[];
}

export interface ResolutionSource {
  readonly uri: URL;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
}

export type AppliedOverrideKind =
  | 'override-ref'
  | 'override-value'
  | 'fallback-ref'
  | 'fallback-value';

export interface AppliedOverride {
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly kind: AppliedOverrideKind;
  readonly depth: number;
  readonly source?: ResolutionSource;
}

export type ResolutionTraceStepKind = 'token' | 'alias' | 'override' | 'fallback';

export interface ResolutionTraceStep {
  readonly pointer: JsonPointer;
  readonly kind: ResolutionTraceStepKind;
  readonly span?: SourceSpan;
}

export interface ResolvedToken {
  readonly pointer: JsonPointer;
  readonly uri: URL;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overridesApplied: readonly AppliedOverride[];
  readonly warnings: readonly DiagnosticEvent[];
  readonly trace: readonly ResolutionTraceStep[];
  toJSON(): unknown;
}

export interface ResolutionResult {
  readonly token?: ResolvedToken;
  readonly diagnostics: readonly DiagnosticEvent[];
  readonly transforms: readonly ResolvedTokenTransformEvaluation[];
}

export interface ResolverContextOptions {
  readonly overrides: ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]>;
  readonly maxDepth: number;
  readonly document?: DecodedDocument;
  readonly transforms: readonly ResolvedTokenTransformEntry[];
}
