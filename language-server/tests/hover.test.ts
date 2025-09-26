import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  DidOpenTextDocumentNotification,
  ExitNotification,
  HoverRequest,
  InitializeRequest,
  InitializedNotification,
  ProposedFeatures,
  ShutdownRequest,
  createConnection,
  type ClientCapabilities,
  type Hover,
  type InitializeParams
} from 'vscode-languageserver/node.js';
import { TextDocuments } from 'vscode-languageserver/node.js';
import {
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection
} from 'vscode-jsonrpc/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createServer } from '../src/index.js';

function assertHover(value: Hover | null | undefined): asserts value is Hover {
  assert.ok(value, 'expected hover response to be returned');
  assert.ok(value.contents, 'expected hover contents to be returned');
}

void test('language server returns pointer hover content', async () => {
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
  const refLineIndex = lines.findIndex((line) => line.includes('"$ref"'));
  assert.ok(refLineIndex >= 0, 'expected $ref line to exist');
  const pointerIndex = lines[refLineIndex].indexOf('#/base');
  assert.ok(pointerIndex >= 0, 'expected pointer value to exist');

  const hoverParams = {
    textDocument: { uri },
    position: { line: refLineIndex, character: pointerIndex + 1 }
  };

  const hoverResult = await clientConnection.sendRequest(HoverRequest.type, hoverParams);
  assertHover(hoverResult);

  assert.equal(hoverResult.range?.start.line, refLineIndex);
  assert.ok(hoverResult.contents);

  const contents = Array.isArray(hoverResult.contents)
    ? hoverResult.contents
    : [hoverResult.contents];

  const [content] = contents;
  assert.ok(
    content && typeof content === 'object' && 'value' in content,
    'expected markdown content'
  );
  assert.equal(content.kind, 'markdown');

  const markdown = content.value;
  assert.ok(markdown.includes('**DTIF Pointer** `#/base`'));
  assert.ok(markdown.includes('**$type:** `color`'));
  assert.ok(markdown.includes('```json'));
  assert.ok(markdown.includes('"colorSpace": "srgb"'));

  await clientConnection.sendRequest(ShutdownRequest.type);
  void clientConnection.sendNotification(ExitNotification.type);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});
