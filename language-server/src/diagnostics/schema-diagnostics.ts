import type { ErrorObject } from 'ajv';
import {
  DiagnosticSeverity,
  type Diagnostic as LspDiagnostic
} from 'vscode-languageserver/node.js';
import { rangeFromOffset } from '../core/documents/ranges.js';
import { formatSchemaViolationDetail, formatSchemaViolationMessage } from './messages.js';
import { DTIF_DIAGNOSTIC_SOURCE } from './constants.js';
import type { DocumentValidationContext, DtifDiagnosticData } from './types.js';
import { resolveRangeFromPointer } from './parsing.js';

export interface SchemaDiagnosticBuilderOptions {
  readonly errors: readonly ErrorObject[];
  readonly context: DocumentValidationContext;
}

export function buildSchemaDiagnostics(options: SchemaDiagnosticBuilderOptions): LspDiagnostic[] {
  const { errors, context } = options;
  return errors.map((error) => buildSchemaDiagnostic(error, context));
}

function buildSchemaDiagnostic(
  error: ErrorObject,
  context: DocumentValidationContext
): LspDiagnostic {
  const pointer = normalizePointer(error.instancePath);
  const range = resolveRangeFromPointer(pointer, context);
  const baseMessage = formatSchemaViolationMessage(error);
  const detail = formatSchemaViolationDetail(error.keyword, error.params);
  const message = detail ? `${baseMessage} ${detail}` : baseMessage;
  return {
    range,
    message,
    severity: DiagnosticSeverity.Error,
    source: DTIF_DIAGNOSTIC_SOURCE,
    code: error.keyword,
    data: {
      pointer,
      keyword: error.keyword,
      params: error.params
    } satisfies DtifDiagnosticData
  } satisfies LspDiagnostic;
}

export function buildValidatorFailureDiagnostic(
  error: unknown,
  document: DocumentValidationContext['document']
): LspDiagnostic {
  const range = rangeFromOffset(document, 0, document.getText().length);
  const message =
    error instanceof Error
      ? `Failed to validate DTIF document: ${error.message}`
      : 'Failed to validate DTIF document.';

  return {
    range,
    message,
    severity: DiagnosticSeverity.Error,
    source: DTIF_DIAGNOSTIC_SOURCE
  } satisfies LspDiagnostic;
}

function normalizePointer(instancePath: string): string {
  return instancePath && instancePath.length > 0 ? `#${instancePath}` : '#';
}
