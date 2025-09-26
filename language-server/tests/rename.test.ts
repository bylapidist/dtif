import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializeRequest,
  InitializedNotification,
  ProposedFeatures,
  ShutdownRequest,
  RenameRequest,
  createConnection,
  type ClientCapabilities,
  type InitializeParams,
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

void test('rename updates pointer definitions and references', async () => {
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

  const initializePromise = clientConnection.sendRequest(InitializeRequest.type, initializeParams);

  server.listen();

  await initializePromise;

  void clientConnection.sendNotification(InitializedNotification.type, {});
  await new Promise((resolve) => setImmediate(resolve));

  const uri = 'file:///memory/pointers.json';
  const documentText = `{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "alias": {
    "$type": "color",
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

  void clientConnection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri,
      languageId: 'json',
      version: 1,
      text: documentText
    }
  });

  await new Promise((resolve) => setImmediate(resolve));

  const lines = documentText.split('\n');
  const baseLineIndex = lines.findIndex((line) => line.includes('"base"'));
  assert.ok(baseLineIndex >= 0, 'expected base property to exist');
  const baseCharIndex = lines[baseLineIndex].indexOf('"base"');
  assert.ok(baseCharIndex >= 0, 'expected base token to exist');

  const renameParams = {
    textDocument: { uri },
    position: { line: baseLineIndex, character: baseCharIndex + 2 },
    newName: 'primary'
  };

  const renameResult = await clientConnection.sendRequest(RenameRequest.type, renameParams);
  assert.ok(renameResult, 'expected rename result to be returned');

  const edits = renameResult.changes?.[uri] ?? [];
  assert.ok(edits.length > 0, 'expected edits to be returned');

  const updatedText = applyEdits(uri, documentText, edits);
  assert.ok(updatedText.includes('"primary"'), 'expected primary property to exist');
  assert.ok(updatedText.includes('#/primary'), 'expected pointer references to update');
  assert.ok(!updatedText.includes('"base"'), 'expected base property to be renamed');

  await clientConnection.sendRequest(ShutdownRequest.type);
  void clientConnection.sendNotification(ExitNotification.type);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});
