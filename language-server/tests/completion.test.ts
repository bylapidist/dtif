import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  CompletionRequest,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializeRequest,
  InitializedNotification,
  ProposedFeatures,
  ShutdownRequest,
  createConnection,
  type ClientCapabilities,
  type CompletionItem,
  type CompletionList,
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

function ensureArray(
  result: CompletionItem[] | CompletionList | null | undefined
): CompletionItem[] {
  if (!result) {
    return [];
  }
  if (Array.isArray(result)) {
    return result;
  }
  return result.items;
}

void test('language server returns completions for $type values, units, and $extensions keys', async () => {
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

  const uri = 'file:///memory/completions.json';
  const documentText = `{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "collections": [
    {
      "$extensions": {
        "org.example.analytics": {
          "source": "web"
        },
        "": {}
      },
      "tokens": {
        "primary": {
          "$type": "",
          "$value": {
            "colorSpace": "srgb",
            "components": [0.2, 0.3, 0.4, 1]
          }
        },
        "motion": {
          "$type": "com.example.motion",
          "$value": {
            "durationType": "css.transition-duration",
            "value": 120,
            "unit": "ms"
          }
        },
        "spacing": {
          "$type": "dimension",
          "$value": {
            "dimensionType": "length",
            "value": 16,
            "unit": ""
          }
        }
      }
    }
  ]
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

  const typeLineIndex = lines.findIndex((line) => line.includes('"$type": ""'));
  assert.ok(typeLineIndex >= 0, 'expected placeholder $type to exist');
  const typeCharIndex = lines[typeLineIndex].indexOf('""');
  assert.ok(typeCharIndex >= 0, 'expected empty $type quotes');

  const typeCompletionsResult = await clientConnection.sendRequest(CompletionRequest.type.method, {
    textDocument: { uri },
    position: { line: typeLineIndex, character: typeCharIndex + 1 }
  });

  const typeCompletions = ensureArray(typeCompletionsResult);
  assert.ok(
    typeCompletions.some((item) => item.label === 'color'),
    'expected registry $type completion'
  );
  assert.ok(
    typeCompletions.some((item) => item.label === 'com.example.motion'),
    'expected observed $type completion'
  );

  const unitLineIndex = lines.findIndex((line) => line.includes('"unit": ""'));
  assert.ok(unitLineIndex >= 0, 'expected placeholder unit to exist');
  const unitCharIndex = lines[unitLineIndex].indexOf('""');
  assert.ok(unitCharIndex >= 0, 'expected empty unit quotes');

  const unitCompletionsResult = await clientConnection.sendRequest(CompletionRequest.type.method, {
    textDocument: { uri },
    position: { line: unitLineIndex, character: unitCharIndex + 1 }
  });

  const unitCompletions = ensureArray(unitCompletionsResult);
  assert.ok(
    unitCompletions.some((item) => item.label === 'px'),
    'expected length unit suggestion'
  );

  const extensionLineIndex = lines.findIndex((line) => line.trim().startsWith('"": {}'));
  assert.ok(extensionLineIndex >= 0, 'expected placeholder $extensions key');
  const extensionCharIndex = lines[extensionLineIndex].indexOf('""');
  assert.ok(extensionCharIndex >= 0, 'expected empty extension key quotes');

  const extensionCompletionsResult = await clientConnection.sendRequest(
    CompletionRequest.type.method,
    {
      textDocument: { uri },
      position: { line: extensionLineIndex, character: extensionCharIndex + 1 }
    }
  );

  const extensionCompletions = ensureArray(extensionCompletionsResult);
  assert.ok(
    extensionCompletions.some((item) => item.label === 'org.example.design.tokens'),
    'expected namespace snippet completion'
  );
  assert.ok(
    extensionCompletions.some((item) => item.label === 'org.example.analytics'),
    'expected observed extension key completion'
  );

  await clientConnection.sendRequest(ShutdownRequest.type.method);
  void clientConnection.sendNotification(ExitNotification.type.method);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});

void test('unit completions retain context when document parsing fails', async () => {
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

  const uri = 'file:///memory/unit-completions.json';
  const documentText = `{
  "tokens": {
    "spacing": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 16,
        "unit": ""
      }
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
  const unitLineIndex = lines.findIndex((line) => line.includes('"unit": ""'));
  assert.ok(unitLineIndex >= 0, 'expected placeholder unit to exist');
  const unitCharIndex = lines[unitLineIndex].indexOf('""');
  assert.ok(unitCharIndex >= 0, 'expected empty unit quotes');

  const initialCompletionsResult = await clientConnection.sendRequest(
    CompletionRequest.type.method,
    {
      textDocument: { uri },
      position: { line: unitLineIndex, character: unitCharIndex + 1 }
    }
  );

  const initialCompletions = ensureArray(initialCompletionsResult);
  const initialUnitCompletion = initialCompletions.find((item) => item.label === 'px');
  assert.ok(initialUnitCompletion, 'expected length unit suggestion');
  assert.equal(initialUnitCompletion.detail, 'Dimension unit');

  const invalidDocumentText = documentText.replace('"unit": ""', '"unit": "');

  void clientConnection.sendNotification(DidChangeTextDocumentNotification.type.method, {
    textDocument: {
      uri,
      version: 2
    },
    contentChanges: [
      {
        text: invalidDocumentText
      }
    ]
  });

  await new Promise((resolve) => setImmediate(resolve));

  const invalidLines = invalidDocumentText.split('\n');
  const invalidUnitLineIndex = invalidLines.findIndex((line) => line.includes('"unit": "'));
  assert.ok(invalidUnitLineIndex >= 0, 'expected incomplete unit line to exist');
  const invalidUnitCharIndex = invalidLines[invalidUnitLineIndex].lastIndexOf('"');
  assert.ok(invalidUnitCharIndex >= 0, 'expected dangling unit quote');

  const invalidCompletionsResult = await clientConnection.sendRequest(
    CompletionRequest.type.method,
    {
      textDocument: { uri },
      position: { line: invalidUnitLineIndex, character: invalidUnitCharIndex + 1 }
    }
  );

  const invalidCompletions = ensureArray(invalidCompletionsResult);
  const invalidUnitCompletion = invalidCompletions.find((item) => item.label === 'px');
  assert.ok(invalidUnitCompletion, 'expected length unit suggestion after parse failure');
  assert.equal(invalidUnitCompletion.detail, 'Dimension unit');

  await clientConnection.sendRequest(ShutdownRequest.type.method);
  void clientConnection.sendNotification(ExitNotification.type.method);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});
