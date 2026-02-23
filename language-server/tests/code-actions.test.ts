import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  CodeActionRequest,
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializeRequest,
  InitializedNotification,
  ProposedFeatures,
  ShutdownRequest,
  createConnection,
  type ClientCapabilities,
  type CodeAction,
  type Command,
  type Diagnostic,
  type InitializeParams,
  type PublishDiagnosticsParams,
  type TextEdit
} from 'vscode-languageserver/node.js';
import { TextDocuments } from 'vscode-languageserver/node.js';
import {
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection
} from 'vscode-jsonrpc/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createServer } from '../src/index.js';

function applyEdits(uri: string, text: string, edits: readonly TextEdit[]): string {
  const document = TextDocument.create(uri, 'json', 0, text);
  const sorted = [...edits].sort((a, b) => {
    const aOffset = document.offsetAt(a.range.start);
    const bOffset = document.offsetAt(b.range.start);
    if (aOffset === bOffset) {
      return document.offsetAt(b.range.end) - document.offsetAt(a.range.end);
    }
    return bOffset - aOffset;
  });

  let result = text;
  for (const edit of sorted) {
    const start = document.offsetAt(edit.range.start);
    const end = document.offsetAt(edit.range.end);
    result = `${result.slice(0, start)}${edit.newText}${result.slice(end)}`;
  }

  return result;
}

function isCodeActionWithEdit(entry: CodeAction | Command): entry is CodeAction {
  return typeof entry === 'object' && 'edit' in entry;
}

void test('quick fix inserts missing $type property', async () => {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();

  const serverConnection = createConnection(
    new StreamMessageReader(clientToServer),
    new StreamMessageWriter(serverToClient),
    undefined,
    ProposedFeatures.all
  );

  const documents = new TextDocuments(TextDocument);
  const server = createServer({ connection: serverConnection, documents });

  const clientConnection = createMessageConnection(
    new StreamMessageReader(serverToClient),
    new StreamMessageWriter(clientToServer)
  );
  clientConnection.listen();

  const capabilities: ClientCapabilities = {};
  const initializeParams: InitializeParams = {
    processId: null,
    clientInfo: undefined,
    locale: undefined,
    rootPath: null,
    rootUri: null,
    capabilities,
    initializationOptions: undefined,
    trace: 'off',
    workspaceFolders: null
  };

  const initializePromise = clientConnection.sendRequest(
    InitializeRequest.type.method,
    initializeParams
  );

  server.listen();

  await initializePromise;

  void clientConnection.sendNotification(InitializedNotification.type.method, {});
  await new Promise((resolve) => setImmediate(resolve));

  const uri = 'file:///memory/quick-fix.json';
  const documentText = `{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "alias": {
    "$ref": "#/base"
  },
  "base": {
    "$type": "color",
    "$value": {
      "colorSpace": "srgb",
      "components": [1, 1, 1, 1]
    }
  }
}`;

  const diagnosticsPromise = new Promise<readonly Diagnostic[]>((resolve) => {
    clientConnection.onNotification(
      'textDocument/publishDiagnostics',
      (params: PublishDiagnosticsParams) => {
        if (params.uri === uri && params.diagnostics.length > 0) {
          resolve(params.diagnostics);
        }
      }
    );
  });

  void clientConnection.sendNotification(DidOpenTextDocumentNotification.type.method, {
    textDocument: {
      uri,
      languageId: 'json',
      version: 1,
      text: documentText
    }
  });

  const diagnostics = await diagnosticsPromise;
  const diagnostic = diagnostics.find((entry) => entry.message.includes('$type'));
  assert.ok(diagnostic, 'expected missing $type diagnostic');

  const codeActionParams = {
    textDocument: { uri },
    range: diagnostic.range,
    context: { diagnostics: [diagnostic] }
  };

  const codeActionResult = await clientConnection.sendRequest(
    CodeActionRequest.type.method,
    codeActionParams
  );
  const actions = Array.isArray(codeActionResult) ? codeActionResult : [];
  const quickFixes = actions.filter(isCodeActionWithEdit);
  assert.ok(quickFixes.length > 0, 'expected at least one code action');

  const quickFix = quickFixes.find((action) => action.title.includes('$type'));
  assert.ok(quickFix, 'expected $type quick fix');
  const edits = quickFix.edit?.changes?.[uri] ?? [];
  assert.ok(edits.length > 0, 'expected edits for quick fix');

  const updatedText = applyEdits(uri, documentText, edits);
  assert.ok(updatedText.includes('"$type": ""'), 'expected $type property to be inserted');

  await clientConnection.sendRequest(ShutdownRequest.type.method);
  void clientConnection.sendNotification(ExitNotification.type.method);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});
