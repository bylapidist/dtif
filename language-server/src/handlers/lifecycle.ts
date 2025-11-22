import {
  type Connection,
  type Disposable,
  type InitializeResult
} from 'vscode-languageserver/node.js';
import type { LanguageServerSession } from '../runtime/session.js';

export function registerLifecycleHandlers(
  connection: Connection,
  session: LanguageServerSession,
  documentListeners: readonly Disposable[]
): void {
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
}
