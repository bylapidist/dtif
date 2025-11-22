import { createConnection, ProposedFeatures, type Connection } from 'vscode-languageserver/node.js';
import { pathToFileURL } from 'node:url';
import { DocumentValidator } from './diagnostics/index.js';
import { DocumentAnalysisStore } from './core/documents/analysis-store.js';
import { createManagedDocuments, type ManagedDocuments } from './runtime/documents.js';
import { LanguageServerSession } from './runtime/session.js';
import { registerLanguageFeatureHandlers } from './handlers/features.js';
import { registerDocumentEventHandlers } from './handlers/documents.js';
import { registerLifecycleHandlers } from './handlers/lifecycle.js';
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

  documents.listen(connection);

  const documentListeners = registerDocumentEventHandlers(documents, session);

  registerLifecycleHandlers(connection, session, documentListeners);
  registerLanguageFeatureHandlers(connection, documents, session);

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
