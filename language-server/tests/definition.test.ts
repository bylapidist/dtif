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
  DefinitionRequest,
  createConnection,
  type ClientCapabilities,
  type DefinitionLink,
  type InitializeParams,
  type Location
} from 'vscode-languageserver/node.js';
import { TextDocuments } from 'vscode-languageserver/node.js';
import {
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection
} from 'vscode-jsonrpc/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createServer } from '../src/index.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDefinitionEntry(value: unknown): value is Location | DefinitionLink {
  if (!isObject(value)) {
    return false;
  }

  const hasLocationShape = typeof value.uri === 'string' && isObject(value.range);
  const hasDefinitionLinkShape = typeof value.targetUri === 'string' && isObject(value.targetRange);

  return hasLocationShape || hasDefinitionLinkShape;
}

function isDefinitionEntries(value: unknown): value is (Location | DefinitionLink)[] {
  return Array.isArray(value) && value.every((entry) => isDefinitionEntry(entry));
}

function assertLocation(value: Location | DefinitionLink): asserts value is Location {
  assert.ok('uri' in value, 'expected definition entry to include a uri');
  assert.ok('range' in value, 'expected definition entry to include a range');
}

void test('language server resolves local pointer definitions', async () => {
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

  void clientConnection.sendNotification(DidOpenTextDocumentNotification.type.method, {
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
  const refCharIndex = lines[refLineIndex].indexOf('#/base');
  assert.ok(refCharIndex >= 0, 'expected pointer value to exist');

  const definitionParams = {
    textDocument: { uri },
    position: { line: refLineIndex, character: refCharIndex + 1 }
  };

  const definitionResult: unknown = await clientConnection.sendRequest(
    DefinitionRequest.type.method,
    definitionParams
  );
  assert.ok(definitionResult, 'expected definition result to be returned');

  let entries: (Location | DefinitionLink)[];
  if (isDefinitionEntries(definitionResult)) {
    entries = definitionResult;
  } else if (isDefinitionEntry(definitionResult)) {
    entries = [definitionResult];
  } else {
    assert.fail('expected definition response to contain location entries');
  }

  const locations = entries.map((entry) => {
    assertLocation(entry);
    return entry;
  });

  assert.equal(locations.length, 1);

  const [location] = locations;
  assert.equal(location.uri, uri);

  const baseLineIndex = lines.findIndex((line) => line.includes('"base"'));
  assert.ok(baseLineIndex >= 0, 'expected base token to exist');
  const objectStartIndex = lines[baseLineIndex].indexOf('{');
  assert.ok(objectStartIndex >= 0, 'expected base object opening brace to exist');

  assert.equal(location.range.start.line, baseLineIndex);
  assert.equal(location.range.start.character, objectStartIndex);

  await clientConnection.sendRequest(ShutdownRequest.type.method);
  void clientConnection.sendNotification(ExitNotification.type.method);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});
