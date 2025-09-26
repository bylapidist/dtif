import {
  createConnection,
  ProposedFeatures,
  type CodeActionParams,
  type Connection,
  type Disposable,
  type InitializeResult,
  type TextDocumentChangeEvent
} from 'vscode-languageserver/node.js';
import { pathToFileURL } from 'node:url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { buildQuickFixes } from './code-actions.js';
import { buildCompletions } from './features/completions/index.js';
import { buildHover } from './features/hover.js';
import { findDefinition } from './features/definition.js';
import { buildRenameEdit } from './features/rename.js';
import { DocumentValidator } from './diagnostics/index.js';
import { DocumentAnalysisStore } from './core/documents/analysis-store.js';
import { createManagedDocuments, type ManagedDocuments } from './runtime/documents.js';
import { LanguageServerSession } from './runtime/session.js';
export type { DtifInitializeResult } from './runtime/initialize.js';

export interface CreateServerOptions {
  readonly connection?: Connection;
  readonly documents?: ManagedDocuments;
  readonly validator?: DocumentValidator;
  readonly store?: DocumentAnalysisStore;
}

export interface LanguageServer {
  readonly connection: Connection;
  readonly documents: ManagedDocuments;
  listen(): void;
}

export { type ManagedDocuments } from './runtime/documents.js';

export function createServer(options: CreateServerOptions = {}): LanguageServer {
  const connection = options.connection ?? createConnection(ProposedFeatures.all);
  const documents = options.documents ?? createManagedDocuments();
  const validator = options.validator ?? new DocumentValidator();
  const store = options.store ?? new DocumentAnalysisStore();
  const session = new LanguageServerSession({ connection, documents, validator, store });

  const documentListeners: Disposable[] = [];

  connection.onInitialize((): InitializeResult => session.handleInitialize());

  connection.onInitialized(() => {
    void session.handleInitialized();
  });

  connection.onShutdown(() => {
    session.handleShutdown();
    for (const disposable of documentListeners) {
      disposable.dispose();
    }
  });

  connection.onDidChangeConfiguration(() => {
    void session.handleDidChangeConfiguration();
  });

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

  documents.listen(connection);

  documentListeners.push(
    documents.onDidOpen((event: TextDocumentChangeEvent<TextDocument>) => {
      session.handleDocumentOpen(event);
    })
  );
  documentListeners.push(
    documents.onDidChangeContent((event: TextDocumentChangeEvent<TextDocument>) => {
      session.handleDocumentChange(event);
    })
  );
  documentListeners.push(
    documents.onDidClose((event: TextDocumentChangeEvent<TextDocument>) => {
      session.handleDocumentClose(event);
    })
  );

  return {
    connection,
    documents,
    listen() {
      connection.listen();
    }
  } satisfies LanguageServer;
}

export function start(): LanguageServer {
  const server = createServer();
  server.listen();
  return server;
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) {
  start();
}
