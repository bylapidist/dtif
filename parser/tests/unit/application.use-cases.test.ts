import test from 'node:test';
import assert from 'node:assert/strict';

import { application, domain } from '../../src/index.js';
import {
  createTokenCacheVariant,
  computeDocumentHash,
  type TokenCache,
  type TokenCacheSnapshot
} from '../../src/tokens/cache.js';
import { resolveOptions } from '../../src/session/internal/options.js';

const EMPTY_DIAGNOSTICS: domain.PipelineDiagnostics = Object.freeze({ events: Object.freeze([]) });

function pipelineResult<T>(
  outcome: T,
  diagnostics: domain.PipelineDiagnostics = EMPTY_DIAGNOSTICS
): domain.PipelineResult<T> {
  return { outcome, diagnostics };
}

function createEvent(code: string, severity: 'error' | 'warning' | 'info'): domain.DiagnosticEvent {
  return { code, message: code, severity };
}

void test('application use cases: runs document pipeline with aggregated diagnostics', async () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://doc'),
    contentType: 'application/json'
  };

  const rawDocument: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([123]),
    text: '{"ok":true}',
    data: { ok: true }
  };

  const decoded: domain.DecodedDocument = {
    identity,
    text: rawDocument.text ?? '',
    data: rawDocument.data ?? {},
    bytes: rawDocument.bytes
  };

  const normalized: domain.NormalizedDocument = {
    identity,
    ast: {}
  };

  const graph: domain.GraphSnapshot<string> = {
    identity,
    graph: 'graph'
  };

  const resolutionOutcome: domain.ResolutionOutcome<string> = {
    identity,
    result: 'resolved',
    diagnostics: [createEvent('resolve/outcome', 'warning')]
  };

  const ingestionService: domain.DocumentIngestionService = {
    source: { load: () => rawDocument },
    ingest: () => pipelineResult(rawDocument)
  };

  const decodingService: domain.DocumentDecodingService = {
    decode: () => pipelineResult(decoded, { events: [createEvent('decode/info', 'info')] })
  };

  const schemaService: domain.SchemaValidationService = {
    validator: { validate: () => EMPTY_DIAGNOSTICS },
    validate: () => pipelineResult(true)
  };

  const normalizationService: domain.DocumentNormalizationService = {
    normalizer: {
      normalize: () =>
        pipelineResult(normalized, { events: [createEvent('normalize/warning', 'warning')] })
    } satisfies domain.NormalizationPort,
    normalize: () =>
      pipelineResult(normalized, { events: [createEvent('normalize/warning', 'warning')] })
  };

  const graphService: domain.GraphConstructionService<string> = {
    builder: { build: () => pipelineResult(graph) } satisfies domain.GraphBuilderPort<string>,
    build: () => pipelineResult(graph)
  };

  const resolutionService: domain.ResolutionService<string, string> = {
    resolver: { resolve: () => pipelineResult(resolutionOutcome) } satisfies domain.ResolutionPort<
      string,
      string
    >,
    resolve: () =>
      pipelineResult(resolutionOutcome, { events: [createEvent('resolve/pipeline', 'info')] })
  };

  const reported: domain.PipelineDiagnostics[] = [];
  const diagnosticsPort: domain.DiagnosticPort = {
    report(diagnostics) {
      reported.push(diagnostics);
    }
  };

  const useCase = new application.ParseDocumentUseCase({
    ingestion: ingestionService,
    decoding: decodingService,
    schema: schemaService,
    normalization: normalizationService,
    graph: graphService,
    resolution: resolutionService,
    diagnostics: diagnosticsPort
  });

  const result = await useCase.execute({ request: { uri: identity.uri } });

  assert.equal(result.fromCache, false);
  assert.equal(result.document, rawDocument);
  assert.equal(result.normalized, normalized);
  assert.equal(result.graph, graph);
  assert.equal(result.resolution, resolutionOutcome);
  assert.equal(result.diagnostics.length, 4);
  assert.equal(reported.length, 1);
  assert.equal(reported[0]?.events, result.diagnostics);
});

void test('application use cases: executeSync mirrors asynchronous pipeline', () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://sync'),
    contentType: 'application/json'
  };

  const rawDocument: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([123]),
    text: '{"ok":true}',
    data: { ok: true }
  };

  const decoded: domain.DecodedDocument = {
    identity,
    text: rawDocument.text ?? '',
    data: rawDocument.data ?? {},
    bytes: rawDocument.bytes
  };

  const normalized: domain.NormalizedDocument = {
    identity,
    ast: {}
  };

  const graph: domain.GraphSnapshot<string> = {
    identity,
    graph: 'graph'
  };

  const resolutionOutcome: domain.ResolutionOutcome<string> = {
    identity,
    result: 'resolved',
    diagnostics: [createEvent('resolve/outcome', 'warning')]
  };

  const ingestionService: domain.DocumentIngestionService = {
    source: { load: () => rawDocument },
    ingest: () => pipelineResult(rawDocument)
  };

  const decodingService: domain.DocumentDecodingService = {
    decode: () => pipelineResult(decoded)
  };

  const schemaService: domain.SchemaValidationService = {
    validator: { validate: () => EMPTY_DIAGNOSTICS },
    validate: () => pipelineResult(true)
  };

  const normalizationPort: domain.NormalizationPort = {
    normalize: () => pipelineResult(normalized)
  };
  const normalizationService: domain.DocumentNormalizationService = {
    normalizer: normalizationPort,
    normalize: (document) => normalizationPort.normalize(document)
  };

  const graphBuilder: domain.GraphBuilderPort<string> = {
    build: () => pipelineResult(graph)
  };
  const graphService: domain.GraphConstructionService<string> = {
    builder: graphBuilder,
    build: (document) => graphBuilder.build(document)
  };

  const resolutionPort: domain.ResolutionPort<string, string> = {
    resolve: () => pipelineResult(resolutionOutcome)
  };
  const resolutionService: domain.ResolutionService<string, string> = {
    resolver: resolutionPort,
    resolve: (graphSnapshot, context) => resolutionPort.resolve(graphSnapshot, context)
  };

  const diagnostics: domain.PipelineDiagnostics[] = [];
  const diagnosticsPort: domain.DiagnosticPort = {
    report(report) {
      diagnostics.push(report);
    }
  };

  const useCase = new application.ParseDocumentUseCase({
    ingestion: ingestionService,
    decoding: decodingService,
    schema: schemaService,
    normalization: normalizationService,
    graph: graphService,
    resolution: resolutionService,
    diagnostics: diagnosticsPort
  });

  const result = useCase.executeSync({ request: { uri: identity.uri } });

  assert.equal(result.fromCache, false);
  assert.equal(result.document, rawDocument);
  assert.equal(result.normalized, normalized);
  assert.equal(result.graph, graph);
  assert.equal(result.resolution, resolutionOutcome);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.events, result.diagnostics);
});

void test('application use cases: respects document cache hits', async () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://cached'),
    contentType: 'application/json'
  };

  const rawDocument: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([1])
  };

  const cachedDocument: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([1]),
    text: '{"cached":true}',
    data: { cached: true }
  };

  const decoded: domain.DecodedDocument = {
    identity,
    text: cachedDocument.text ?? '',
    data: cachedDocument.data ?? {},
    bytes: cachedDocument.bytes
  };

  const ingestionService: domain.DocumentIngestionService = {
    source: { load: () => rawDocument },
    ingest: () => pipelineResult(rawDocument)
  };

  const decodingService: domain.DocumentDecodingService = {
    decode: () => pipelineResult(decoded)
  };

  const schemaService: domain.SchemaValidationService = {
    validator: { validate: () => EMPTY_DIAGNOSTICS },
    validate: () => pipelineResult(true)
  };

  const normalizationService: domain.DocumentNormalizationService = {
    normalizer: {
      normalize: () => pipelineResult({ identity, ast: {} })
    } satisfies domain.NormalizationPort,
    normalize: () => pipelineResult({ identity, ast: {} })
  };

  const graphService: domain.GraphConstructionService<string> = {
    builder: {
      build: () => pipelineResult({ identity, graph: 'graph' })
    } satisfies domain.GraphBuilderPort<string>,
    build: () => pipelineResult({ identity, graph: 'graph' })
  };

  const resolutionOutcome: domain.ResolutionOutcome<string> = {
    identity,
    result: 'resolved',
    diagnostics: EMPTY_DIAGNOSTICS.events
  };

  const resolutionService: domain.ResolutionService<string, string> = {
    resolver: { resolve: () => pipelineResult(resolutionOutcome) } satisfies domain.ResolutionPort<
      string,
      string
    >,
    resolve: () => pipelineResult(resolutionOutcome)
  };

  let stored = false;
  const documentCache: domain.DocumentCachePort = {
    get: () => cachedDocument,
    set: () => {
      stored = true;
    }
  };

  const useCase = new application.ParseDocumentUseCase({
    ingestion: ingestionService,
    decoding: decodingService,
    schema: schemaService,
    normalization: normalizationService,
    graph: graphService,
    resolution: resolutionService,
    documentCache
  });

  const result = await useCase.execute({ request: { uri: identity.uri } });

  assert.equal(result.fromCache, true);
  assert.equal(result.document, cachedDocument);
  assert.equal(stored, false);
});

void test('application use cases: parse tokens shares document pipeline and token cache', async () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://tokens'),
    contentType: 'application/json'
  };

  const rawDocument: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([1]),
    text: '{"tokens":true}',
    data: { tokens: true }
  };

  const decoded: domain.DecodedDocument = {
    identity,
    text: rawDocument.text ?? '',
    data: rawDocument.data ?? {},
    bytes: rawDocument.bytes
  };

  const normalized: domain.NormalizedDocument = {
    identity,
    ast: {}
  };

  const graph: domain.GraphSnapshot<string> = {
    identity,
    graph: 'graph'
  };

  const resolutionOutcome: domain.ResolutionOutcome<string> = {
    identity,
    result: 'resolved',
    diagnostics: [createEvent('resolution/outcome', 'info')]
  };

  const ingestionService: domain.DocumentIngestionService = {
    source: { load: () => rawDocument },
    ingest: () => pipelineResult(rawDocument)
  };

  const decodingService: domain.DocumentDecodingService = {
    decode: () => pipelineResult(decoded)
  };

  const schemaService: domain.SchemaValidationService = {
    validator: { validate: () => EMPTY_DIAGNOSTICS },
    validate: () => pipelineResult(true)
  };

  const normalizationService: domain.DocumentNormalizationService = {
    normalizer: { normalize: () => pipelineResult(normalized) } satisfies domain.NormalizationPort,
    normalize: () => pipelineResult(normalized)
  };

  const graphService: domain.GraphConstructionService<string> = {
    builder: { build: () => pipelineResult(graph) } satisfies domain.GraphBuilderPort<string>,
    build: () => pipelineResult(graph)
  };

  const resolutionService: domain.ResolutionService<string, string> = {
    resolver: { resolve: () => pipelineResult(resolutionOutcome) } satisfies domain.ResolutionPort<
      string,
      string
    >,
    resolve: () => pipelineResult(resolutionOutcome)
  };

  const flattenSnapshot: domain.TokenSnapshot<TokenCacheSnapshot> = {
    token: {
      documentHash: 'hash',
      flattened: [],
      metadataIndex: new Map(),
      resolutionIndex: undefined,
      diagnostics: undefined,
      timestamp: Date.now()
    },
    diagnostics: [createEvent('flatten/snapshot', 'warning')]
  } satisfies domain.TokenSnapshot<TokenCacheSnapshot>;

  let flattenCalls = 0;
  const flatteningService: domain.TokenFlatteningService<string, string, TokenCacheSnapshot> = {
    flattener: {
      flatten: () => pipelineResult(flattenSnapshot)
    } satisfies domain.TokenFlatteningPort<string, string, TokenCacheSnapshot>,
    flatten: () => {
      flattenCalls++;
      return pipelineResult(flattenSnapshot, { events: [createEvent('flatten/pipeline', 'info')] });
    }
  };

  const cache = new Map<string, TokenCacheSnapshot>();
  const tokenCache: domain.TokenCachePort<TokenCacheSnapshot> = {
    get: (key) => cache.get(`${key.document.uri.href}::${key.variant ?? ''}`),
    set: (key, snapshot) => {
      cache.set(`${key.document.uri.href}::${key.variant ?? ''}`, snapshot);
    }
  };

  const documentDiagnostics: domain.DiagnosticPort = {
    report() {
      throw new Error('document diagnostics should not be reported directly');
    }
  };

  const documentUseCase = new application.ParseDocumentUseCase({
    ingestion: ingestionService,
    decoding: decodingService,
    schema: schemaService,
    normalization: normalizationService,
    graph: graphService,
    resolution: resolutionService,
    diagnostics: documentDiagnostics
  });

  const reportedDiagnostics: domain.PipelineDiagnostics[] = [];
  const tokensDiagnosticsPort: domain.DiagnosticPort = {
    report(diagnostics) {
      reportedDiagnostics.push(diagnostics);
    }
  };

  const tokensUseCase = new application.ParseTokensUseCase({
    documents: documentUseCase,
    flattening: flatteningService,
    tokenCache,
    diagnostics: tokensDiagnosticsPort,
    hashDocument: () => 'hash',
    resolveVariant: () => 'default'
  });

  const first = await tokensUseCase.execute({
    request: { uri: identity.uri },
    flatten: true,
    includeGraphs: true
  });

  assert.ok(first.tokens);
  assert.equal(first.tokens.token.documentHash, 'hash');
  assert.equal(first.tokensFromCache, false);
  assert.equal(flattenCalls, 1);
  assert.equal(first.diagnostics.length, 2);
  assert.equal(first.tokens.diagnostics.length, 1);
  assert.equal(reportedDiagnostics.length, 1);
  assert.equal(reportedDiagnostics[0].events, first.diagnostics);

  const second = await tokensUseCase.execute({
    request: { uri: identity.uri },
    flatten: true,
    includeGraphs: true
  });

  assert.equal(second.tokensFromCache, true);
  assert.equal(flattenCalls, 1);
  assert.ok(second.tokens);
  assert.equal(second.tokens.token.documentHash, 'hash');
  assert.equal(second.tokens.diagnostics.length, 1);
  assert.equal(second.diagnostics.length, 2);
});

void test('application use cases: parse tokens synchronously shares cache behaviour', () => {
  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://sync-tokens'),
    contentType: 'application/json'
  };

  const rawDocument: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([1]),
    text: '{"token":true}',
    data: { token: true }
  };

  const decoded: domain.DecodedDocument = {
    identity,
    text: rawDocument.text ?? '',
    data: rawDocument.data ?? {},
    bytes: rawDocument.bytes
  };

  const normalized: domain.NormalizedDocument = { identity, ast: {} };
  const graph: domain.GraphSnapshot<string> = { identity, graph: 'graph' };
  const resolutionOutcome: domain.ResolutionOutcome<string> = {
    identity,
    result: 'resolved',
    diagnostics: []
  };

  const ingestionService: domain.DocumentIngestionService = {
    source: { load: () => rawDocument },
    ingest: () => pipelineResult(rawDocument)
  };
  const decodingService: domain.DocumentDecodingService = { decode: () => pipelineResult(decoded) };
  const schemaService: domain.SchemaValidationService = {
    validator: { validate: () => EMPTY_DIAGNOSTICS },
    validate: () => pipelineResult(true)
  };
  const normalizationPort: domain.NormalizationPort = {
    normalize: () => pipelineResult(normalized)
  };
  const normalizationService: domain.DocumentNormalizationService = {
    normalizer: normalizationPort,
    normalize: (document) => normalizationPort.normalize(document)
  };
  const graphBuilder: domain.GraphBuilderPort<string> = {
    build: () => pipelineResult(graph)
  };
  const graphService: domain.GraphConstructionService<string> = {
    builder: graphBuilder,
    build: (document) => graphBuilder.build(document)
  };
  const resolutionPort: domain.ResolutionPort<string, string> = {
    resolve: () => pipelineResult(resolutionOutcome)
  };
  const resolutionService: domain.ResolutionService<string, string> = {
    resolver: resolutionPort,
    resolve: (graphSnapshot, context) => resolutionPort.resolve(graphSnapshot, context)
  };

  const flatteningPort: domain.TokenFlatteningPort<string, string, TokenCacheSnapshot> = {
    flatten: () => pipelineResult(undefined)
  };
  const flatteningService: domain.TokenFlatteningService<string, string, TokenCacheSnapshot> = {
    flattener: flatteningPort,
    flatten: (request) =>
      pipelineResult({
        token: {
          documentHash: request.documentHash ?? 'hash',
          flattened: request.flatten ? [{ id: 'a', pointer: '', name: 'A', path: [] }] : undefined,
          metadataIndex: new Map(),
          resolutionIndex: new Map(),
          diagnostics: [],
          timestamp: Date.now()
        },
        diagnostics: EMPTY_DIAGNOSTICS.events
      } satisfies domain.TokenSnapshot<TokenCacheSnapshot>)
  };

  const documentUseCase = new application.ParseDocumentUseCase({
    ingestion: ingestionService,
    decoding: decodingService,
    schema: schemaService,
    normalization: normalizationService,
    graph: graphService,
    resolution: resolutionService
  });

  let cacheWrites = 0;
  const cache = new Map<string, TokenCacheSnapshot>();
  const tokenCache: domain.TokenCachePort<TokenCacheSnapshot> = {
    get: (key) => cache.get(`${key.document.uri.href}::${key.variant ?? ''}`),
    set: (key, entry) => {
      cacheWrites += 1;
      cache.set(`${key.document.uri.href}::${key.variant ?? ''}`, entry);
    }
  };

  const tokensUseCase = new application.ParseTokensUseCase({
    documents: documentUseCase,
    flattening: flatteningService,
    tokenCache,
    hashDocument: () => 'hash',
    resolveVariant: () => 'default'
  });

  const first = tokensUseCase.executeSync({
    request: { uri: identity.uri },
    flatten: true,
    includeGraphs: true
  });

  assert.equal(first.tokensFromCache, false);
  assert.equal(cacheWrites, 1);
  assert.ok(first.tokens);
  assert.equal(first.tokens.token.documentHash, 'hash');

  const second = tokensUseCase.executeSync({
    request: { uri: identity.uri },
    flatten: true,
    includeGraphs: true
  });

  assert.equal(second.tokensFromCache, true);
  assert.equal(cacheWrites, 1);
});

void test('application factory: createParseTokensUseCase computes cache variants from session options', async () => {
  const resolvedOptions = resolveOptions({
    allowHttp: true,
    maxDepth: 12,
    overrideContext: { brand: 'acme' }
  });

  const identity: domain.RawDocumentIdentity = {
    uri: new URL('memory://variant'),
    contentType: 'application/json'
  };

  const rawDocument: domain.RawDocument = {
    identity,
    bytes: new Uint8Array([123]),
    text: '{"name":"example"}',
    data: { name: 'example' }
  };

  const resolutionOutcome: domain.ResolutionOutcome = {
    identity,
    result: {},
    diagnostics: []
  };

  const documentExecution: application.ParseDocumentExecution<unknown, unknown, unknown> = {
    document: rawDocument,
    diagnostics: [],
    resolution: resolutionOutcome,
    fromCache: false
  };

  const documents = {
    execute: () => Promise.resolve(documentExecution),
    executeSync: () => documentExecution
  } satisfies application.ParseDocumentOrchestrator<unknown, unknown, unknown>;

  const variants: string[] = [];
  const documentHash = computeDocumentHash(rawDocument);
  const parseCache: TokenCache = {
    get: (key) => {
      variants.push(key.variant);
      const entry: TokenCacheSnapshot = {
        documentHash,
        flattened: [],
        metadataIndex: new Map(),
        resolutionIndex: new Map(),
        diagnostics: [],
        timestamp: Date.now()
      };
      return entry;
    },
    set: () => undefined
  };

  const useCase = application.createParseTokensUseCase(documents, resolvedOptions, parseCache);

  await useCase.execute({
    request: { uri: identity.uri },
    flatten: false,
    includeGraphs: false
  });

  assert.equal(variants.length, 1);

  const configuration = application.createTokenCacheConfiguration(resolvedOptions);
  const expectedVariant = createTokenCacheVariant(configuration, {
    flatten: false,
    includeGraphs: false
  });

  assert.equal(variants[0], expectedVariant);
});
