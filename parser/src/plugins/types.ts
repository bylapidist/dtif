import type { Diagnostic } from '../types.js';
import type { JsonPointer, RawDocument, SourceSpan } from '../types.js';
import type { ResolvedToken } from '../resolver/index.js';

export interface ExtensionHandlerInput {
  readonly namespace: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly value: unknown;
  readonly document: RawDocument;
}

export interface ExtensionHandlerResult {
  readonly normalized?: unknown;
  readonly diagnostics?: readonly Diagnostic[];
}

export type ExtensionHandler = (
  input: ExtensionHandlerInput
) => ExtensionHandlerResult | void;

export interface ExtensionEvaluation {
  readonly plugin: string;
  readonly namespace: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly value: unknown;
  readonly normalized?: unknown;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ResolvedTokenTransformContext {
  readonly document: RawDocument;
}

export interface ResolvedTokenTransformResult {
  readonly data?: unknown;
  readonly diagnostics?: readonly Diagnostic[];
}

export type ResolvedTokenTransform = (
  token: ResolvedToken,
  context: ResolvedTokenTransformContext
) => ResolvedTokenTransformResult | void;

export interface ResolvedTokenTransformEvaluation {
  readonly plugin: string;
  readonly pointer: JsonPointer;
  readonly data?: unknown;
  readonly diagnostics: readonly Diagnostic[];
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
