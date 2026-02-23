import type { DecodedDocument, DiagnosticEvent } from '../domain/models.js';
import type { JsonPointer, SourceSpan } from '../domain/primitives.js';

export interface ExtensionHandlerInput {
  readonly namespace: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly value: unknown;
  readonly document: DecodedDocument;
}

export interface ExtensionHandlerResult {
  readonly normalized?: unknown;
  readonly diagnostics?: readonly DiagnosticEvent[];
}

export type ExtensionHandler = (input: ExtensionHandlerInput) => ExtensionHandlerResult | undefined;

export interface ExtensionEvaluation {
  readonly plugin: string;
  readonly namespace: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly value: unknown;
  readonly normalized?: unknown;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface ResolvedTokenTransformContext {
  readonly document: DecodedDocument;
}

export interface ResolvedTokenTransformResult {
  readonly data?: unknown;
  readonly diagnostics?: readonly DiagnosticEvent[];
}

export type AppliedOverrideKind =
  | 'override-ref'
  | 'override-value'
  | 'fallback-ref'
  | 'fallback-value';

export interface ResolutionSource {
  readonly uri: URL;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
}

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

export type ResolvedTokenTransform = (
  token: ResolvedToken,
  context: ResolvedTokenTransformContext
) => ResolvedTokenTransformResult | undefined;

export interface ResolvedTokenTransformEvaluation {
  readonly plugin: string;
  readonly pointer: JsonPointer;
  readonly data?: unknown;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface ParserPlugin {
  readonly name: string;
  readonly extensions?:
    | ReadonlyMap<string, ExtensionHandler>
    | Readonly<Record<string, ExtensionHandler>>;
  readonly transformResolvedToken?: ResolvedTokenTransform;
}

export interface ResolvedTokenTransformEntry {
  readonly plugin: string;
  readonly transform: ResolvedTokenTransform;
}
