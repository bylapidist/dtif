import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  DidChangeTextDocumentNotification,
  ConfigurationRequest,
  DidChangeConfigurationNotification,
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializeRequest,
  InitializedNotification,
  PublishDiagnosticsNotification,
  ProposedFeatures,
  ShutdownRequest,
  TextDocumentSyncKind,
  createConnection,
  type ClientCapabilities,
  type InitializeParams,
  type InitializeResult,
  type ConfigurationParams,
  type PublishDiagnosticsParams
} from 'vscode-languageserver/node.js';
import { TextDocuments } from 'vscode-languageserver/node.js';
import {
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection
} from 'vscode-jsonrpc/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { buildInitializeResult, createServer } from '../src/index.js';
import { packageVersion } from '../src/package-metadata.js';
import { DEFAULT_SETTINGS, type DtifLanguageServerSettings } from '../src/settings.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInitializeResult(value: unknown): value is InitializeResult {
  return isObject(value) && isObject(value.capabilities);
}

function isPublishDiagnosticsParams(value: unknown): value is PublishDiagnosticsParams {
  return isObject(value) && typeof value.uri === 'string' && Array.isArray(value.diagnostics);
}

function queueConfigurationResponses(
  connection: ReturnType<typeof createMessageConnection>,
  responses: readonly DtifLanguageServerSettings[]
): void {
  let index = 0;

  connection.onRequest(ConfigurationRequest.type, (params: ConfigurationParams) => {
    const response =
      index < responses.length
        ? responses[index++]
        : responses.length > 0
          ? responses[responses.length - 1]
          : DEFAULT_SETTINGS;

    return params.items.map(() => response);
  });
}

void test('buildInitializeResult advertises incremental sync', () => {
  const result = buildInitializeResult();
  assert.equal(result.capabilities.textDocumentSync, TextDocumentSyncKind.Incremental);
  assert.equal(result.capabilities.hoverProvider, true);
  assert.ok(result.capabilities.completionProvider);
  assert.deepEqual(result.capabilities.completionProvider.triggerCharacters, ['"', ':', '.', '$']);
  assert.equal(result.capabilities.completionProvider.resolveProvider, false);
  assert.equal(result.capabilities.workspace?.configuration, true);
  assert.ok(result.serverInfo);
  assert.equal(result.serverInfo.name, 'DTIF Language Server');
  assert.equal(result.serverInfo.version, packageVersion);
});

void test('createServer handles the initialize handshake', async () => {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();

  const serverConnection = createConnection(
    new StreamMessageReader(clientToServer),
    new StreamMessageWriter(serverToClient),
    undefined,
    ProposedFeatures.all
  );

  const logs: string[] = [];
  serverConnection.console.info = (...entries: unknown[]) => {
    const [message] = entries;
    logs.push(typeof message === 'string' ? message : String(message));
  };

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

  const initializeResult: unknown = await initializePromise;
  assert.ok(isInitializeResult(initializeResult), 'expected initialize result payload');
  assert.equal(initializeResult.capabilities.textDocumentSync, TextDocumentSyncKind.Incremental);
  assert.equal(initializeResult.capabilities.hoverProvider, true);
  assert.ok(initializeResult.capabilities.completionProvider);
  assert.equal(initializeResult.capabilities.completionProvider.resolveProvider, false);
  assert.equal(initializeResult.capabilities.workspace?.configuration, true);

  void clientConnection.sendNotification(InitializedNotification.type.method, {});
  await new Promise((resolve) => setImmediate(resolve));

  await clientConnection.sendRequest(ShutdownRequest.type.method);
  void clientConnection.sendNotification(ExitNotification.type.method);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();

  assert.deepEqual(logs, [
    'DTIF Language Server initialised.',
    'DTIF Language Server shutting down.'
  ]);
});

void test('language server publishes schema diagnostics and clears them after fixes', async () => {
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

  const uri = 'file:///memory/dtif.json';

  const invalidDocument = JSON.stringify(
    {
      $schema: 'https://dtif.lapidist.net/schema/core.json',
      color: {
        brand: {
          primary: {
            $type: 'color',
            $value: {
              colorSpace: 'srgb',
              components: []
            }
          }
        }
      }
    },
    null,
    2
  );

  const waitForDiagnostics = (predicate: (params: PublishDiagnosticsParams) => boolean) =>
    new Promise<PublishDiagnosticsParams>((resolve) => {
      const disposable = clientConnection.onNotification(
        PublishDiagnosticsNotification.type,
        (params: unknown) => {
          if (!isPublishDiagnosticsParams(params)) {
            return;
          }

          const diagnosticsParams = params;
          if (predicate(diagnosticsParams)) {
            disposable.dispose();
            resolve(diagnosticsParams);
          }
        }
      );
    });

  void clientConnection.sendNotification(DidOpenTextDocumentNotification.type.method, {
    textDocument: {
      uri,
      languageId: 'json',
      version: 1,
      text: invalidDocument
    }
  });

  const diagnosticsParams = await waitForDiagnostics((params) => params.uri === uri);
  assert.ok(diagnosticsParams.diagnostics.length > 0);

  const [diagnostic] = diagnosticsParams.diagnostics;
  assert.match(diagnostic.message, /Schema violation/i);
  assert.match(diagnostic.message, /Expected at least 1 item\./i);

  const lines = invalidDocument.split('\n');
  const componentsLineIndex = lines.findIndex((line) => line.includes('"components"'));
  assert.ok(componentsLineIndex >= 0, 'expected components line to be found');
  const bracketIndex = lines[componentsLineIndex].indexOf('[');
  assert.equal(diagnostic.range.start.line, componentsLineIndex);
  assert.equal(diagnostic.range.start.character, bracketIndex);

  const validDocument = JSON.stringify(
    {
      $schema: 'https://dtif.lapidist.net/schema/core.json',
      color: {
        brand: {
          primary: {
            $type: 'color',
            $value: {
              colorSpace: 'srgb',
              components: [0, 0, 0]
            }
          }
        }
      }
    },
    null,
    2
  );

  void clientConnection.sendNotification(DidChangeTextDocumentNotification.type.method, {
    textDocument: {
      uri,
      version: 2
    },
    contentChanges: [
      {
        text: validDocument
      }
    ]
  });

  const clearedDiagnostics = await waitForDiagnostics(
    (params) => params.uri === uri && params.diagnostics.length === 0
  );

  assert.equal(clearedDiagnostics.diagnostics.length, 0);

  await clientConnection.sendRequest(ShutdownRequest.type.method);
  void clientConnection.sendNotification(ExitNotification.type.method);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});

void test('language server honours validation configuration', async () => {
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

  const configurationResponses: DtifLanguageServerSettings[] = [
    { validation: { mode: 'on' } },
    { validation: { mode: 'off' } },
    { validation: { mode: 'on' } }
  ];

  queueConfigurationResponses(clientConnection, configurationResponses);

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

  const uri = 'file:///memory/config.json';

  const invalidDocument = JSON.stringify(
    {
      $schema: 'https://dtif.lapidist.net/schema/core.json',
      color: {
        brand: {
          primary: {
            $type: 'color',
            $value: {
              colorSpace: 'srgb',
              components: []
            }
          }
        }
      }
    },
    null,
    2
  );

  const waitForDiagnostics = (predicate: (params: PublishDiagnosticsParams) => boolean) =>
    new Promise<PublishDiagnosticsParams>((resolve) => {
      const disposable = clientConnection.onNotification(
        PublishDiagnosticsNotification.type,
        (params: unknown) => {
          if (!isPublishDiagnosticsParams(params)) {
            return;
          }

          const diagnosticsParams = params;
          if (predicate(diagnosticsParams)) {
            disposable.dispose();
            resolve(diagnosticsParams);
          }
        }
      );
    });

  void clientConnection.sendNotification(DidOpenTextDocumentNotification.type.method, {
    textDocument: {
      uri,
      languageId: 'json',
      version: 1,
      text: invalidDocument
    }
  });

  const initialDiagnostics = await waitForDiagnostics((params) => params.uri === uri);
  assert.ok(initialDiagnostics.diagnostics.length > 0);

  void clientConnection.sendNotification(DidChangeConfigurationNotification.type.method, {
    settings: { validation: { mode: 'off' } }
  });

  const clearedDiagnostics = await waitForDiagnostics(
    (params) => params.uri === uri && params.diagnostics.length === 0
  );
  assert.equal(clearedDiagnostics.diagnostics.length, 0);

  void clientConnection.sendNotification(DidChangeConfigurationNotification.type.method, {
    settings: { validation: { mode: 'on' } }
  });

  const restoredDiagnostics = await waitForDiagnostics(
    (params) => params.uri === uri && params.diagnostics.length > 0
  );
  assert.ok(restoredDiagnostics.diagnostics.length > 0);

  await clientConnection.sendRequest(ShutdownRequest.type.method);
  void clientConnection.sendNotification(ExitNotification.type.method);
  await new Promise((resolve) => setImmediate(resolve));

  clientConnection.dispose();
});
