import {
  CodeActionKind,
  TextDocumentSyncKind,
  type InitializeResult
} from 'vscode-languageserver/node.js';
import { packageVersion } from '../package-metadata.js';

const SERVER_NAME = 'DTIF Language Server';

export interface DtifInitializeResult extends InitializeResult {
  capabilities: InitializeResult['capabilities'] & {
    workspace?: InitializeResult['capabilities']['workspace'] & {
      configuration?: boolean;
    };
  };
}

export function buildInitializeResult(): DtifInitializeResult {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        triggerCharacters: ['"', ':', '.', '$'],
        resolveProvider: false
      },
      renameProvider: true,
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix]
      },
      workspace: {
        configuration: true,
        workspaceFolders: {
          supported: true,
          changeNotifications: true
        }
      }
    },
    serverInfo: {
      name: SERVER_NAME,
      version: packageVersion
    }
  } satisfies DtifInitializeResult;
}

export function getServerName(): string {
  return SERVER_NAME;
}
