import test from 'node:test';
import assert from 'node:assert/strict';

import { domain, domainAdapters } from '../../src/index.js';
import { DiagnosticCodes, formatDiagnosticCode } from '../../src/diagnostics/codes.js';
import type { DocumentLoader, DocumentLoaderContext } from '../../src/io/document-loader.js';
import type { DocumentHandle, SourceMap, Diagnostic } from '../../src/types.js';
import { PluginRegistry } from '../../src/plugins/index.js';
import type { ParserPlugin } from '../../src/plugins/index.js';
import type { ResolvedToken } from '../../src/resolver/types.js';
import type { TokenMetadataSnapshot, ResolvedTokenView } from '../../src/tokens/types.js';
import { TokenFlatteningAdapter } from '../../src/tokens/token-flattening-adapter.js';

const EMPTY_PIPELINE: domain.PipelineDiagnostics = Object.freeze({ events: Object.freeze([]) });

function pipelineResult<T>(
  outcome: T,
  diagnostics: domain.PipelineDiagnostics = EMPTY_PIPELINE
): domain.PipelineResult<T> {
  return { outcome, diagnostics };
}

class StubDocumentLoader implements DocumentLoader {
  #handle: DocumentHandle;
  lastInput: unknown;
  lastContext: DocumentLoaderContext | undefined;

  constructor(handle: DocumentHandle) {
    this.#handle = handle;
  }

  load(input: unknown, context?: DocumentLoaderContext): Promise<DocumentHandle> {
    this.lastInput = input;
    this.lastContext = context;
    return Promise.resolve(this.#handle);
  }
}

void test('domain adapters: wraps document loaders as domain sources', async () => {
  const handle: DocumentHandle = {
    uri: new URL('memory://example'),
    contentType: 'application/json',
    bytes: new Uint8Array([123]),
    text: '{"example":true}',
    data: { example: true }
  };
  const loader = new StubDocumentLoader(handle);
  const baseContext: DocumentLoaderContext = { baseUri: new URL('file:///base') };
  const adapter = new domainAdapters.DocumentLoaderSource(loader, { context: baseContext });

  const controller = new AbortController();
  const result = await adapter.load({
    inlineContent: '{"example":true}',
    contentTypeHint: 'application/json',
    description: 'inline document',
    baseUri: new URL('file:///override'),
    signal: controller.signal
  });

  assert.equal(result.identity.uri.href, handle.uri.href);
  assert.equal(result.identity.description, 'inline document');
  assert.equal(result.text, handle.text);
  assert.deepEqual(loader.lastContext, {
    baseUri: new URL('file:///override'),
    signal: controller.signal
  });
  assert.ok(loader.lastInput && typeof loader.lastInput === 'object');
});

void test('domain adapters: inline ingestion constructs domain documents', () => {
  const adapter = new domainAdapters.InlineDocumentIngestionAdapter({
    uri: 'memory://inline',
    contentType: 'application/json',
    text: '{"inline":true}'
  });

  const result = adapter.ingest({ uri: 'memory://inline', description: 'inline document' });

  assert.equal(result.diagnostics.events.length, 0);
  const document = result.outcome;
  assert.ok(document);
  assert.equal(document.identity.uri.href, 'memory://inline');
  assert.equal(document.identity.description, 'inline document');
  assert.equal(document.text, '{"inline":true}');
  assert.deepEqual(document.data, { inline: true });
});

void test('domain adapters: token flattening adapter assembles cache entries', () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://flatten'),
    contentType: 'application/json'
  };
  const document: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([1]),
    text: '{}',
    data: {},
    sourceMap: { uri: identity.uri, pointers: new Map() }
  };

  const metadataEntry: TokenMetadataSnapshot = {
    description: 'example',
    extensions: {},
    source: { uri: identity.uri.href, line: 1, column: 1 }
  } satisfies TokenMetadataSnapshot;
  const metadata = new Map<string, TokenMetadataSnapshot>([['token', metadataEntry]]);
  const resolutionView: ResolvedTokenView = {
    id: 'token',
    raw: null,
    value: null,
    references: [],
    resolutionPath: [],
    appliedAliases: []
  } satisfies ResolvedTokenView;
  const resolutionMap = new Map<string, ResolvedTokenView>([['token', resolutionView]]);

  const resolutionDiagnostic: Diagnostic = {
    code: DiagnosticCodes.resolver.UNKNOWN_POINTER,
    message: 'resolution diagnostic',
    severity: 'warning'
  } satisfies Diagnostic;

  const adapter = new TokenFlatteningAdapter({
    metadataSnapshot: () => metadata,
    resolutionSnapshot: (_graph, _resolver, options) => {
      options?.onDiagnostic?.(resolutionDiagnostic);
      return resolutionMap;
    },
    flattenTokens: () => [
      {
        id: 'token',
        pointer: '#',
        name: 'token',
        path: [],
        raw: null
      }
    ],
    clock: () => 42
  });

  const graph: domain.GraphSnapshot = { identity, graph: {} };
  const resolution: domain.ResolutionOutcome = {
    identity,
    result: {},
    diagnostics: []
  };

  const result = adapter.flatten({
    document,
    graph,
    resolution,
    documentHash: 'hash',
    flatten: true
  });

  assert.ok(result.outcome);
  const outcome = result.outcome;
  assert.equal(outcome.token.documentHash, 'hash');
  assert.equal(outcome.token.flattened?.length, 1);
  assert.equal(outcome.token.metadataIndex?.size, metadata.size);
  assert.equal(outcome.token.resolutionIndex?.size, resolutionMap.size);
  assert.equal(outcome.token.timestamp, 42);
  assert.equal(result.diagnostics.events.length, 1);
});

void test('domain adapters: bridges plugin extension collection diagnostics', () => {
  const plugin: ParserPlugin = {
    name: 'extensions',
    extensions: {
      example: () => ({
        normalized: { ok: true },
        diagnostics: [
          {
            code: DiagnosticCodes.plugins.EXTENSION_FAILED,
            message: 'extension warning',
            severity: 'warning'
          }
        ]
      })
    }
  };

  const registry = new PluginRegistry([plugin]);
  const adapter = new domainAdapters.PluginExtensionCollectorAdapter(registry);
  const identity = {
    uri: new URL('memory://plugin'),
    contentType: 'application/json' as const,
    description: 'plugin document'
  };
  const sourceMap: SourceMap = { uri: identity.uri, pointers: new Map() };
  const document = {
    identity,
    bytes: new Uint8Array(),
    text: '{}',
    data: {},
    sourceMap
  } satisfies domainAdapters.PluginExtensionCollectorContext['document'];

  const result = adapter.collect({
    document,
    invocations: [
      {
        namespace: 'example',
        pointer: '#/extensions/0',
        value: { ok: true }
      }
    ]
  });

  assert.equal(result.outcome.length, 1);
  const evaluation = result.outcome[0];
  assert.equal(evaluation.plugin, 'extensions');
  assert.deepEqual(evaluation.normalized, { ok: true });
  assert.equal(evaluation.diagnostics[0]?.message, 'extension warning');
  assert.equal(result.diagnostics.events[0]?.code, DiagnosticCodes.plugins.EXTENSION_FAILED);
});

void test('domain adapters: executes plugin transforms through the adapter', () => {
  const plugin: ParserPlugin = {
    name: 'transformer',
    transformResolvedToken: () => ({
      data: { plugin: true },
      diagnostics: [
        {
          code: DiagnosticCodes.plugins.RESOLUTION_FAILED,
          message: 'transform info',
          severity: 'info'
        }
      ]
    })
  };

  const registry = new PluginRegistry([plugin]);
  const adapter = new domainAdapters.PluginTransformExecutorAdapter(registry.transforms);
  const identity = {
    uri: new URL('memory://transform'),
    contentType: 'application/json' as const
  };
  const sourceMap: SourceMap = { uri: identity.uri, pointers: new Map() };
  const document = {
    identity,
    bytes: new Uint8Array(),
    text: '{}',
    data: {},
    sourceMap
  } satisfies domainAdapters.PluginTransformExecutionContext['document'];

  const token: ResolvedToken = {
    pointer: '#/token',
    uri: identity.uri,
    type: 'color',
    value: '#ffffff',
    overridesApplied: [],
    warnings: [],
    trace: [],
    toJSON() {
      return { pointer: this.pointer };
    }
  };

  const result = adapter.execute({ document, token });

  assert.equal(result.outcome.length, 1);
  assert.deepEqual(result.outcome[0]?.data, { plugin: true });
  assert.equal(result.diagnostics.events[0]?.severity, 'info');
});

void test('domain adapters: document decoding adapter returns cached payloads without decoding', async () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://decoded'),
    contentType: 'application/json'
  };

  const document: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([1]),
    text: '{"value":true}',
    data: { value: true },
    sourceMap: { uri: identity.uri, pointers: new Map() }
  };

  const adapter = new domainAdapters.DocumentDecodingAdapter();
  const result = await adapter.decode(document);

  assert.ok(result.outcome);
  assert.equal(result.outcome.text, '{"value":true}');
  assert.equal(result.diagnostics.events.length, 0);
});

void test('domain adapters: document decoding adapter reports decode failures', async () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://decode-error'),
    contentType: 'application/json'
  };

  const document: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([1])
  };

  const adapter = new domainAdapters.DocumentDecodingAdapter({
    decode: () => Promise.reject(new Error('decode failed'))
  });

  const result = await adapter.decode(document);

  assert.equal(result.outcome, undefined);
  assert.equal(result.diagnostics.events[0]?.code, DiagnosticCodes.decoder.FAILED);
});

void test('domain adapters: inline decoder returns decoded snapshot synchronously', () => {
  const adapter = new domainAdapters.InlineDocumentDecodingAdapter();
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://inline-decoder'),
    contentType: 'application/json'
  };

  const result = adapter.decode({
    identity,
    bytes: new Uint8Array([1]),
    text: '{"decoded":true}',
    data: { decoded: true },
    sourceMap: { uri: identity.uri, pointers: new Map() }
  });

  const decoded = result.outcome;
  assert.ok(decoded);
  assert.equal(result.diagnostics.events.length, 0);
  assert.equal(decoded.text, '{"decoded":true}');
});

void test('domain adapters: document normalization adapter delegates to provided normalizer', async () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://normalize'),
    contentType: 'application/json'
  };

  const decoded: domain.DecodedDocument = {
    identity,
    text: '{"tokens":[]}',
    data: { tokens: [] },
    bytes: new Uint8Array(),
    sourceMap: { uri: identity.uri, pointers: new Map() }
  };

  const normalized: domain.NormalizedDocument = { identity, ast: {}, extensions: [] };

  const adapter = new domainAdapters.DocumentNormalizationAdapter({
    normalizer: {
      normalize: () =>
        pipelineResult(normalized, {
          events: [
            {
              code: formatDiagnosticCode('Normaliser', 9, 0),
              message: 'ok',
              severity: 'info'
            }
          ]
        })
    }
  });

  const result = await adapter.normalize(decoded);

  assert.equal(result.outcome, normalized);
  assert.equal(result.diagnostics.events[0]?.code, formatDiagnosticCode('Normaliser', 9, 0));
});

void test('domain adapters: graph construction adapter delegates to provided builder', async () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://graph'),
    contentType: 'application/json'
  };

  const normalized: domain.NormalizedDocument = { identity, ast: {} };
  const snapshot: domain.GraphSnapshot<string> = { identity, graph: 'graph' };

  const adapter = new domainAdapters.GraphConstructionAdapter({
    build: () =>
      pipelineResult(snapshot, {
        events: [
          {
            code: formatDiagnosticCode('Graph', 9, 0),
            message: 'ok',
            severity: 'info'
          }
        ]
      })
  });

  const result = await adapter.build(normalized);

  assert.equal(result.outcome, snapshot);
  assert.equal(result.diagnostics.events[0]?.code, formatDiagnosticCode('Graph', 9, 0));
});
