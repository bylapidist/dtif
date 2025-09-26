import type { Node as JsonNode } from 'jsonc-parser';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export interface DtifDiagnosticData {
  readonly pointer?: string;
  readonly keyword?: string;
  readonly params?: unknown;
}

export interface DocumentValidationContext {
  readonly document: TextDocument;
  readonly tree?: JsonNode;
}
