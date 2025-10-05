import type { ExtensionCollector, ExtensionEvaluation } from '../../plugins/index.js';
import type { DecodedDocument, DiagnosticEvent } from '../../domain/models.js';
import type { JsonPointer, SourceSpan } from '../../domain/primitives.js';
import type { DocumentAst } from '../nodes.js';

export interface NormaliserOptions {
  readonly extensions?: {
    createExtensionCollector(
      document: DecodedDocument,
      diagnostics: DiagnosticEvent[]
    ): ExtensionCollector | undefined;
  };
}

export interface NormaliserContext {
  readonly document: DecodedDocument;
  readonly diagnostics: DiagnosticEvent[];
  readonly extensions?: ExtensionCollector;
}

export interface NormaliserResult {
  readonly ast?: DocumentAst;
  readonly diagnostics: readonly DiagnosticEvent[];
  readonly extensions: readonly ExtensionEvaluation[];
}

const EMPTY_DIAGNOSTICS: readonly DiagnosticEvent[] = Object.freeze([]);
const EMPTY_EXTENSION_RESULTS: readonly ExtensionEvaluation[] = Object.freeze([]);

export function createNormaliserContext(
  document: DecodedDocument,
  options: NormaliserOptions
): NormaliserContext {
  const diagnostics: DiagnosticEvent[] = [];
  const extensions = options.extensions?.createExtensionCollector(document, diagnostics);

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
  const extensions = context.extensions ? context.extensions.results() : EMPTY_EXTENSION_RESULTS;

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
  return context.document.sourceMap?.pointers.get(pointer);
}
