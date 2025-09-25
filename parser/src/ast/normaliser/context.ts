import type { ExtensionCollector, ExtensionEvaluation } from '../../plugins/index.js';
import type { Diagnostic, JsonPointer, RawDocument, SourceSpan } from '../../types.js';
import type { DocumentAst } from '../nodes.js';

export interface NormaliserOptions {
  readonly extensions?: {
    createExtensionCollector(
      document: RawDocument,
      diagnostics: Diagnostic[]
    ): ExtensionCollector | undefined;
  };
}

export interface NormaliserContext {
  readonly document: RawDocument;
  readonly diagnostics: Diagnostic[];
  readonly extensions?: ExtensionCollector;
}

export interface NormaliserResult {
  readonly ast?: DocumentAst;
  readonly diagnostics: readonly Diagnostic[];
  readonly extensions: readonly ExtensionEvaluation[];
}

const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);
const EMPTY_EXTENSION_RESULTS: readonly ExtensionEvaluation[] = Object.freeze([]);

export function createNormaliserContext(
  document: RawDocument,
  options: NormaliserOptions
): NormaliserContext {
  const diagnostics: Diagnostic[] = [];
  const extensions = options.extensions?.createExtensionCollector(
    document,
    diagnostics
  );

  return {
    document,
    diagnostics,
    extensions
  };
}

export function finalizeNormalisation(
  context: NormaliserContext,
  ast?: DocumentAst
): NormaliserResult {
  const diagnostics =
    context.diagnostics.length === 0
      ? EMPTY_DIAGNOSTICS
      : Object.freeze(context.diagnostics.map((diagnostic) => Object.freeze(diagnostic)));
  const extensions = context.extensions
    ? context.extensions.results()
    : EMPTY_EXTENSION_RESULTS;

  return {
    ast,
    diagnostics,
    extensions
  };
}

export function getSourceSpan(
  context: NormaliserContext,
  pointer: JsonPointer
): SourceSpan | undefined {
  return context.document.sourceMap.pointers.get(pointer);
}
