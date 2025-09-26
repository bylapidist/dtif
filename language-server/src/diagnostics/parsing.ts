import {
  findNodeAtLocation,
  getNodeValue,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError
} from 'jsonc-parser';
import {
  DiagnosticSeverity,
  type Diagnostic as LspDiagnostic,
  type Range
} from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { pointerToPath } from '../pointer-utils.js';
import { rangeFromNode, rangeFromOffset } from '../core/documents/ranges.js';
import { DTIF_DIAGNOSTIC_SOURCE } from './constants.js';
import type { DocumentValidationContext } from './types.js';

export type DocumentParseResult =
  | { ok: true; tree: JsonNode; value: unknown }
  | { ok: false; diagnostics: LspDiagnostic[] };

export function parseDocument(document: TextDocument): DocumentParseResult {
  const text = document.getText();
  const parseErrors: ParseError[] = [];
  const tree = parseTree(text, parseErrors, {
    allowTrailingComma: false,
    disallowComments: true
  });

  if (!tree || parseErrors.length > 0) {
    return {
      ok: false,
      diagnostics: parseErrors.map((error) => buildParseDiagnostic(error, document))
    };
  }

  return { ok: true, tree, value: getNodeValue(tree) };
}

export function resolveRangeFromPointer(
  pointer: string,
  context: DocumentValidationContext
): Range {
  const { document, tree } = context;
  if (!tree) {
    return rangeFromOffset(document, 0, document.getText().length);
  }

  const path = pointerToPath(pointer);
  let node = findNodeAtLocation(tree, path);

  if (!node && path.length > 0) {
    const parentPath = path.slice(0, -1);
    node = findNodeAtLocation(tree, parentPath) ?? undefined;
  }

  if (!node) {
    return rangeFromOffset(document, 0, document.getText().length);
  }

  return rangeFromNode(node, document);
}

function buildParseDiagnostic(error: ParseError, document: TextDocument): LspDiagnostic {
  const range = rangeFromOffset(document, error.offset, error.length);
  const message = `JSON parsing error: ${printParseErrorCode(error.error)}.`;
  return {
    range,
    message,
    severity: DiagnosticSeverity.Error,
    source: DTIF_DIAGNOSTIC_SOURCE
  } satisfies LspDiagnostic;
}
