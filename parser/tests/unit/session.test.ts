import assert from 'node:assert/strict';
import test from 'node:test';

import { createSession, ParseSession } from '../../src/session.js';
import { SchemaGuard } from '../../src/validation/schema-guard.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import { DefaultDocumentLoader } from '../../src/io/document-loader.js';
import { decodeDocument } from '../../src/io/decoder.js';
import type { ParserPlugin } from '../../src/plugins/index.js';
import type { DocumentCache, DocumentHandle, RawDocument } from '../../src/types.js';
import type { DocumentLoader } from '../../src/io/document-loader.js';
import type { DiagnosticEvent } from '../../src/domain/models.js';
import { areByteArraysEqual } from '../../src/utils/bytes.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const VALID_DOCUMENT = JSON.stringify(
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

const INVALID_DOCUMENT = JSON.stringify(
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

void test('parseDocument surfaces schema guard diagnostics alongside decoded documents', async () => {
  const session = createSession();
  const result = await session.parseDocument(INVALID_DOCUMENT);

  assert.ok(result.document, 'expected decoded document to be returned even when invalid');
  assert.equal(
    result.normalized,
    undefined,
    'expected AST to be omitted when schema validation fails'
  );
  assert.equal(
    result.graph,
    undefined,
    'expected graph to be omitted when schema validation fails'
  );
  assert.equal(
    result.resolution,
    undefined,
    'expected resolver to be omitted when schema validation fails'
  );

  const schemaDiagnostic = findDiagnostic(
    result.diagnostics,
    DiagnosticCodes.schemaGuard.INVALID_DOCUMENT
  );
  assert.ok(schemaDiagnostic, 'expected schema guard diagnostic for invalid input');
  assert.equal(hasErrors(result.diagnostics), true);
});

class RecordingSchemaGuard extends SchemaGuard {
  lastDocument?: RawDocument;

  override validate(document: RawDocument) {
    this.lastDocument = document;
    return super.validate(document);
  }
}

void test('ParseSession honours a provided SchemaGuard instance', async () => {
  const guard = new RecordingSchemaGuard();
  const session = new ParseSession({ schemaGuard: guard });

  const result = await session.parseDocument(VALID_DOCUMENT);

  const document = result.document;
  assert.ok(document);
  assert.ok(result.normalized?.ast);
  assert.equal(hasErrors(result.diagnostics), false);
  const lastDocument = guard.lastDocument;
  assert.ok(lastDocument);
  assert.equal(lastDocument.identity.uri.href, document.identity.uri.href);
  assert.ok(areByteArraysEqual(lastDocument.bytes, document.bytes));
});

void test('parseDocument returns a normalised AST when schema validation succeeds', async () => {
  const session = createSession();
  const result = await session.parseDocument(VALID_DOCUMENT);

  const { normalized, graph, resolution: outcome } = result;
  assert.ok(normalized?.ast, 'expected AST to be returned for valid documents');
  assert.ok(graph?.graph, 'expected document graph to be returned for valid documents');
  assert.ok(outcome?.result, 'expected document resolver to be returned for valid documents');
  assert.ok(normalized);
  assert.ok(graph);
  assert.ok(outcome);
  const { ast } = normalized;
  const resolver = outcome.result;
  const collections = ast.children;
  assert.ok(collections.length > 0);
  assert.equal(collections[0].kind, 'collection');

  const resolution = resolver.resolve('#/color/brand/primary');
  assert.ok(resolution.token, 'expected resolver to produce a token');
  assert.equal(resolution.diagnostics.length, 0);
  const { token } = resolution;
  assert.ok(token);
  if (!isRecord(token) || !('value' in token)) {
    assert.fail('expected resolved token to expose a value');
  }
  assert.deepEqual(token.value, {
    colorSpace: 'srgb',
    components: [0, 0, 0]
  });
});

void test('ParseSession reuses cached documents when bytes match', async () => {
  const uri = new URL('memory://cache/reuse');
  const cachedDocument = await decodeDocument(createMemoryHandle(uri, VALID_DOCUMENT));
  const loader = new StaticLoader(uri, VALID_DOCUMENT);
  const cache = new RecordingCache(cachedDocument);
  const session = new ParseSession({ loader, documentCache: cache });

  const result = await session.parseDocument('ignored');

  assert.equal(cache.getCalls, 1);
  assert.equal(cache.setCalls, 0);
  const document = result.document;
  assert.ok(document);
  assert.ok(
    areByteArraysEqual(document.bytes, cachedDocument.bytes),
    'expected cached document bytes to be reused'
  );
  assert.equal(document.text, cachedDocument.text);
  assert.ok(result.normalized?.ast, 'expected AST to be returned for cached documents');
  assert.equal(hasErrors(result.diagnostics), false);
});

void test('parseDocument surfaces loader diagnostics when documents exceed the byte limit', async () => {
  const loader = new DefaultDocumentLoader({ maxBytes: 32 });
  const session = new ParseSession({ loader });
  const oversized = JSON.stringify({ value: 'x'.repeat(64) });

  const result = await session.parseDocument(oversized);

  assert.equal(result.document, undefined);
  assert.equal(result.normalized, undefined);
  assert.equal(result.graph, undefined);
  assert.equal(result.resolution, undefined);

  const loaderDiagnostic = findDiagnostic(result.diagnostics, DiagnosticCodes.loader.TOO_LARGE);

  assert.ok(loaderDiagnostic, 'expected loader diagnostic when document exceeds byte limit');
  assert.equal(hasErrors(result.diagnostics), true);
});

void test('ParseSession refreshes the cache when document bytes change', async () => {
  const uri = new URL('memory://cache/refresh');
  const staleDocument = await decodeDocument(
    createMemoryHandle(
      uri,
      JSON.stringify(
        {
          $schema: 'https://dtif.lapidist.net/schema/core.json',
          color: {
            brand: {
              primary: {
                $type: 'color',
                $value: { colorSpace: 'srgb', components: [0, 0, 0] }
              }
            }
          }
        },
        null,
        2
      )
    )
  );

  const updatedText = JSON.stringify(
    {
      $schema: 'https://dtif.lapidist.net/schema/core.json',
      color: {
        brand: {
          primary: {
            $type: 'color',
            $value: { colorSpace: 'srgb', components: [1, 0, 0] }
          }
        }
      }
    },
    null,
    2
  );

  const loader = new StaticLoader(uri, updatedText);
  const cache = new RecordingCache(staleDocument);
  const session = new ParseSession({ loader, documentCache: cache });

  const result = await session.parseDocument('ignored');

  assert.equal(cache.getCalls, 1);
  assert.equal(cache.setCalls, 1, 'expected cache to store updated document');
  const document = result.document;
  assert.ok(document);
  assert.ok(
    !areByteArraysEqual(document.bytes, staleDocument.bytes),
    'expected updated document bytes when cache content changes'
  );
  assert.equal(document.text, updatedText);
  const updatedCacheEntry = cache.lastSet;
  assert.ok(updatedCacheEntry);
  assert.equal(updatedCacheEntry.text, updatedText);
  assert.ok(
    areByteArraysEqual(updatedCacheEntry.bytes, document.bytes),
    'expected cache to store the updated document bytes'
  );
  assert.ok(result.normalized?.ast);
  assert.equal(hasErrors(result.diagnostics), false);
});

void test('ParseSession surfaces diagnostics when cache writes fail', async () => {
  const uri = new URL('memory://cache/failure');
  const loader = new StaticLoader(uri, VALID_DOCUMENT);
  const cache = new FailingCache();
  const session = new ParseSession({ loader, documentCache: cache });

  const result = await session.parseDocument('ignored');

  const cacheDiagnostic = findDiagnostic(result.diagnostics, DiagnosticCodes.core.CACHE_FAILED);

  assert.ok(cacheDiagnostic, 'expected cache failure diagnostic');
  assert.equal(cacheDiagnostic.severity, 'warning');
  assert.equal(cache.setCalls, 1, 'expected cache set to be attempted');
  assert.ok(result.document);
  assert.equal(hasErrors(result.diagnostics), false);
});

void test('ParseSession invokes extension plugins and records results', async () => {
  const plugin: ParserPlugin = {
    name: 'extension-plugin',
    extensions: {
      'com.example': ({ value, pointer }) => ({
        normalized: { ...(isRecord(value) ? value : {}), role: 'PRIMARY' },
        diagnostics: [
          {
            code: DiagnosticCodes.core.NOT_IMPLEMENTED,
            message: 'extension processed',
            severity: 'info',
            pointer
          }
        ]
      })
    }
  };

  const session = new ParseSession({ plugins: [plugin] });
  const result = await session.parseDocument(
    JSON.stringify(
      {
        $schema: 'https://dtif.lapidist.net/schema/core.json',
        color: {
          brand: {
            $type: 'color',
            $value: { colorSpace: 'srgb', components: [0, 0, 0] },
            $extensions: { 'com.example': { role: 'primary' } }
          }
        }
      },
      null,
      2
    )
  );

  const { normalized } = result;
  assert.ok(normalized?.ast);
  assert.ok(normalized);
  const extensionResults = normalized.extensions ?? [];
  assert.equal(extensionResults.length, 1);
  const [evaluation] = extensionResults;
  assert.ok(evaluation);
  assert.equal(evaluation.plugin, 'extension-plugin');
  assert.equal(evaluation.namespace, 'com.example');
  assert.equal(evaluation.pointer, '#/color/brand/$extensions/com.example');
  assert.deepEqual(evaluation.value, { role: 'primary' });
  assert.deepEqual(evaluation.normalized, { role: 'PRIMARY' });
  assert.equal(evaluation.diagnostics.length, 1);

  const pluginDiagnostic = findDiagnostic(result.diagnostics, DiagnosticCodes.core.NOT_IMPLEMENTED);
  assert.ok(pluginDiagnostic, 'expected plugin diagnostic from extension handler');
});

void test('ParseSession surfaces diagnostics when extension plugins throw', async () => {
  const plugin: ParserPlugin = {
    name: 'broken-extension',
    extensions: {
      'com.example': () => {
        throw new Error('extension failure');
      }
    }
  };

  const session = new ParseSession({ plugins: [plugin] });
  const result = await session.parseDocument(
    JSON.stringify(
      {
        $schema: 'https://dtif.lapidist.net/schema/core.json',
        color: {
          brand: {
            $type: 'color',
            $value: { colorSpace: 'srgb', components: [0, 0, 0] },
            $extensions: { 'com.example': { role: 'primary' } }
          }
        }
      },
      null,
      2
    )
  );

  const diagnostic = findDiagnostic(result.diagnostics, DiagnosticCodes.plugins.EXTENSION_FAILED);

  assert.ok(diagnostic, 'expected extension failure diagnostic');
  assert.equal(diagnostic.pointer, '#/color/brand/$extensions/com.example');
  assert.equal(diagnostic.severity, 'error');
  const extensions = result.normalized?.extensions ?? [];
  assert.equal(extensions.length, 0);
});

function hasErrors(events: readonly DiagnosticEvent[]): boolean {
  return events.some((event) => event.severity === 'error');
}

function findDiagnostic(
  events: readonly DiagnosticEvent[],
  code: string
): DiagnosticEvent | undefined {
  return events.find((event) => event.code === code);
}

class StaticLoader implements DocumentLoader {
  constructor(
    private readonly uri: URL,
    private readonly text: string
  ) {}

  load(): Promise<DocumentHandle> {
    return Promise.resolve(createMemoryHandle(this.uri, this.text));
  }
}

class RecordingCache implements DocumentCache {
  document?: RawDocument;
  getCalls = 0;
  setCalls = 0;
  lastSet?: RawDocument;

  constructor(document?: RawDocument) {
    this.document = document;
  }

  get(identity: RawDocument['identity']): Promise<RawDocument | undefined> {
    this.getCalls++;
    if (this.document && this.document.identity.uri.href !== identity.uri.href) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.document);
  }

  set(document: RawDocument): Promise<void> {
    this.setCalls++;
    this.lastSet = document;
    this.document = document;
    return Promise.resolve();
  }
}

class FailingCache implements DocumentCache {
  getCalls = 0;
  setCalls = 0;

  get(identity: RawDocument['identity']): Promise<RawDocument | undefined> {
    this.getCalls++;
    void identity;
    return Promise.resolve(undefined);
  }

  set(document: RawDocument): Promise<void> {
    this.setCalls++;
    void document;
    return Promise.reject(new Error('cache write failed'));
  }
}

function createMemoryHandle(uri: URL, text: string): DocumentHandle {
  const bytes = new TextEncoder().encode(text);
  return Object.freeze({ uri, contentType: 'application/json', bytes });
}
