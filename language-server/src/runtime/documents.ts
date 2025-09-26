import type {
  Connection,
  Disposable,
  TextDocumentChangeEvent
} from 'vscode-languageserver/node.js';
import { TextDocuments } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface ManagedDocuments {
  listen(connection: Connection): void;
  onDidOpen(handler: (event: TextDocumentChangeEvent<TextDocument>) => void): Disposable;
  onDidChangeContent(handler: (event: TextDocumentChangeEvent<TextDocument>) => void): Disposable;
  onDidClose(handler: (event: TextDocumentChangeEvent<TextDocument>) => void): Disposable;
  get(uri: string): TextDocument | undefined;
  all(): Iterable<TextDocument>;
}

export function createManagedDocuments(): ManagedDocuments {
  const documents = new TextDocuments(TextDocument);
  return documents;
}
