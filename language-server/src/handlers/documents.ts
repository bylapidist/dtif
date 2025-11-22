import { type Disposable, type TextDocumentChangeEvent } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { ManagedDocuments } from '../runtime/documents.js';
import type { LanguageServerSession } from '../runtime/session.js';

export function registerDocumentEventHandlers(
  documents: ManagedDocuments,
  session: LanguageServerSession
): Disposable[] {
  return [
    documents.onDidOpen((event: TextDocumentChangeEvent<TextDocument>) => {
      session.handleDocumentOpen(event);
    }),
    documents.onDidChangeContent((event: TextDocumentChangeEvent<TextDocument>) => {
      session.handleDocumentChange(event);
    }),
    documents.onDidClose((event: TextDocumentChangeEvent<TextDocument>) => {
      session.handleDocumentClose(event);
    })
  ];
}
