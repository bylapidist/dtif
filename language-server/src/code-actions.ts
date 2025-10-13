import {
  CodeActionKind,
  type CodeAction,
  type CodeActionParams,
  type Diagnostic,
  type TextEdit
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Node as JsonNode } from 'jsonc-parser';
import { DocumentAnalysisStore } from './core/documents/analysis-store.js';
import { isRecord } from './core/utils/object.js';
import type { DtifDiagnosticData } from './diagnostics/index.js';

const INDENT_UNIT = '  ';
const LEADING_WHITESPACE = /^\s*/u;

interface QuickFixContext {
  readonly document: TextDocument;
  readonly params: CodeActionParams;
  readonly store: DocumentAnalysisStore;
}

interface InsertPropertyOptions {
  readonly document: TextDocument;
  readonly uri: string;
  readonly pointer: string;
  readonly property: string;
  readonly value: string;
  readonly title: string;
  readonly diagnostic: Diagnostic;
  readonly store: DocumentAnalysisStore;
}

export function buildQuickFixes(context: QuickFixContext): CodeAction[] {
  const { document, params, store } = context;
  const actions: CodeAction[] = [];
  const uri = params.textDocument.uri;

  for (const diagnostic of params.context.diagnostics) {
    const data = toDiagnosticData(diagnostic.data);
    if (!data?.pointer) {
      continue;
    }

    if (data.keyword === 'required' && isRecord(data.params)) {
      const missingProperty = data.params.missingProperty;
      if (missingProperty === '$type') {
        const action = buildInsertPropertyAction({
          document,
          uri,
          pointer: data.pointer,
          property: '$type',
          value: '',
          title: 'Add "$type" property',
          diagnostic,
          store
        });
        if (action) {
          action.isPreferred = true;
          actions.push(action);
        }
        continue;
      }

      if (missingProperty === '$ref') {
        const action = buildInsertPropertyAction({
          document,
          uri,
          pointer: data.pointer,
          property: '$ref',
          value: '',
          title: 'Add "$ref" property',
          diagnostic,
          store
        });
        if (action) {
          actions.push(action);
        }
      }
    }
  }

  return actions;
}

function buildInsertPropertyAction(options: InsertPropertyOptions): CodeAction | undefined {
  const node = options.store.getPointerNode(options.uri, options.pointer);
  if (node?.type !== 'object') {
    return undefined;
  }

  const edit = buildInsertPropertyEdit(options.document, node, options.property, options.value);
  if (!edit) {
    return undefined;
  }

  const workspaceEdit = { changes: { [options.uri]: [edit] } };

  return {
    title: options.title,
    kind: CodeActionKind.QuickFix,
    diagnostics: [options.diagnostic],
    edit: workspaceEdit
  } satisfies CodeAction;
}

function buildInsertPropertyEdit(
  document: TextDocument,
  node: JsonNode,
  property: string,
  value: string
): TextEdit | undefined {
  const insertOffset = node.offset + 1;
  const position = document.positionAt(insertOffset);
  const indent = getIndentation(document, node.offset);
  const propertyIndent = `${indent}${INDENT_UNIT}`;
  const propertyText = `${propertyIndent}${JSON.stringify(property)}: ${JSON.stringify(value)}`;
  const hasProperties = Array.isArray(node.children) && node.children.length > 0;

  const newText = hasProperties ? `\n${propertyText},\n` : `\n${propertyText}\n${indent}`;

  return {
    range: { start: position, end: position },
    newText
  } satisfies TextEdit;
}

function getIndentation(document: TextDocument, offset: number): string {
  const position = document.positionAt(offset);
  const lineStart = { line: position.line, character: 0 };
  const lineEnd = { line: position.line, character: position.character };
  const prefix = document.getText({ start: lineStart, end: lineEnd });
  const match = LEADING_WHITESPACE.exec(prefix);
  return match?.[0] ?? '';
}

function toDiagnosticData(value: unknown): DtifDiagnosticData | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const pointerValue = value.pointer;
  if (typeof pointerValue !== 'string') {
    return undefined;
  }

  const keywordValue = typeof value.keyword === 'string' ? value.keyword : undefined;
  const paramsValue = 'params' in value ? value.params : undefined;

  return {
    pointer: pointerValue,
    keyword: keywordValue,
    params: paramsValue
  } satisfies DtifDiagnosticData;
}
