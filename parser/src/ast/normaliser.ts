import { DiagnosticCodes } from '../diagnostics/codes.js';
import { JSON_POINTER_ROOT } from '../utils/json-pointer.js';
import type { RawDocument } from '../types.js';
import { buildDocumentAst } from './normaliser/document.js';
import {
  createNormaliserContext,
  finalizeNormalisation,
  getSourceSpan
} from './normaliser/context.js';
import type { NormaliserContext, NormaliserOptions, NormaliserResult } from './normaliser/context.js';

export type { NormaliserOptions, NormaliserResult } from './normaliser/context.js';

export function normalizeDocument(
  document: RawDocument,
  options: NormaliserOptions = {}
): NormaliserResult {
  const context = createNormaliserContext(document, options);

  try {
    const ast = buildDocumentAst(context);
    return finalizeNormalisation(context, ast);
  } catch (error) {
    recordUnexpectedFailure(context, error);
    return finalizeNormalisation(context, undefined);
  }
}

function recordUnexpectedFailure(context: NormaliserContext, error: unknown): void {
  context.diagnostics.push({
    code: DiagnosticCodes.normaliser.FAILED,
    message:
      error instanceof Error ? error.message : 'Failed to normalise DTIF document.',
    severity: 'error',
    pointer: JSON_POINTER_ROOT,
    span: getSourceSpan(context, JSON_POINTER_ROOT)
  });
}
