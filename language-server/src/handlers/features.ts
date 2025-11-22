import type { CodeActionParams, Connection } from 'vscode-languageserver/node.js';
import type { ManagedDocuments } from '../runtime/documents.js';
import type { LanguageServerSession } from '../runtime/session.js';
import { buildQuickFixes } from '../code-actions.js';
import { buildCompletions } from '../features/completions/index.js';
import { buildHover } from '../features/hover.js';
import { findDefinition } from '../features/definition.js';
import { buildRenameEdit } from '../features/rename.js';

export function registerLanguageFeatureHandlers(
  connection: Connection,
  documents: ManagedDocuments,
  session: LanguageServerSession
): void {
  connection.onDefinition((params) =>
    findDefinition(session.store, params.textDocument.uri, params.position)
  );

  connection.onHover((params) =>
    buildHover(session.store, params.textDocument.uri, params.position)
  );

  connection.onCompletion((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return buildCompletions({ document, position: params.position, store: session.store });
  });

  connection.onRenameRequest((params) =>
    buildRenameEdit(session.store, params.textDocument.uri, params.position, params.newName)
  );

  connection.onCodeAction((params: CodeActionParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return buildQuickFixes({ document, params, store: session.store });
  });
}
