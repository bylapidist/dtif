import type { DecodedDocument, DiagnosticEvent } from '../domain/models.js';
import type { JsonPointer, SourceSpan } from '../domain/primitives.js';
import type { ResolvedToken } from '../resolver/index.js';

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
