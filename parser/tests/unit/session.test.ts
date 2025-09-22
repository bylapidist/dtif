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

test('parseDocument surfaces schema guard diagnostics alongside decoded documents', async () => {
  const session = createSession();
  const result = await session.parseDocument(INVALID_DOCUMENT);

  assert.ok(result.document, 'expected decoded document to be returned even when invalid');
  assert.equal(result.ast, undefined, 'expected AST to be omitted when schema validation fails');
  assert.equal(result.graph, undefined, 'expected graph to be omitted when schema validation fails');
  assert.equal(result.resolver, undefined, 'expected resolver to be omitted when schema validation fails');

  const diagnostics = Array.from(result.diagnostics);
  const schemaDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.code === DiagnosticCodes.schemaGuard.INVALID_DOCUMENT
  );

  assert.ok(schemaDiagnostic, 'expected schema guard diagnostic for invalid input');
  assert.equal(result.diagnostics.hasErrors(), true);
});

class RecordingSchemaGuard extends SchemaGuard {
  lastDocument?: RawDocument;

  override validate(document: RawDocument) {
    this.lastDocument = document;
    return super.validate(document);
  }
}

test('ParseSession honours a provided SchemaGuard instance', async () => {
  const guard = new RecordingSchemaGuard();
  const session = new ParseSession({ schemaGuard: guard });

  const result = await session.parseDocument(VALID_DOCUMENT);

  assert.ok(result.document);
  assert.ok(result.ast);
  assert.equal(result.diagnostics.hasErrors(), false);
  assert.equal(guard.lastDocument, result.document);
});

test('parseDocument returns a normalised AST when schema validation succeeds', async () => {
  const session = createSession();
  const result = await session.parseDocument(VALID_DOCUMENT);

  assert.ok(result.ast, 'expected AST to be returned for valid documents');
  assert.ok(result.graph, 'expected document graph to be returned for valid documents');
  assert.ok(result.resolver, 'expected document resolver to be returned for valid documents');
  const collections = result.ast!.children;
  assert.ok(collections.length > 0);
  assert.equal(collections[0].kind, 'collection');

  const resolution = result.resolver!.resolve('#/color/brand/primary');
  assert.ok(resolution.token, 'expected resolver to produce a token');
  assert.equal(resolution.diagnostics.length, 0);
  assert.deepEqual(resolution.token?.value, {
    colorSpace: 'srgb',
    components: [0, 0, 0]
  });
});

test('ParseSession reuses cached documents when bytes match', async () => {
  const uri = new URL('memory://cache/reuse');
  const cachedDocument = await decodeDocument(createMemoryHandle(uri, VALID_DOCUMENT));
  const loader = new StaticLoader(uri, VALID_DOCUMENT);
  const cache = new RecordingCache(cachedDocument);
  const session = new ParseSession({ loader, cache });

  const result = await session.parseDocument('ignored');

  assert.equal(cache.getCalls, 1);
  assert.equal(cache.setCalls, 0);
  assert.equal(result.document, cachedDocument);
  assert.ok(result.ast, 'expected AST to be returned for cached documents');
  assert.equal(result.diagnostics.hasErrors(), false);
});

test('parseDocument surfaces loader diagnostics when documents exceed the byte limit', async () => {
  const loader = new DefaultDocumentLoader({ maxBytes: 32 });
  const session = new ParseSession({ loader });
  const oversized = JSON.stringify({ value: 'x'.repeat(64) });

  const result = await session.parseDocument(oversized);

  assert.equal(result.document, undefined);
  assert.equal(result.ast, undefined);
  assert.equal(result.graph, undefined);
  assert.equal(result.resolver, undefined);

  const diagnostics = result.diagnostics.toArray();
  const loaderDiagnostic = diagnostics.find((entry) => entry.code === DiagnosticCodes.loader.TOO_LARGE);

  assert.ok(loaderDiagnostic, 'expected loader diagnostic when document exceeds byte limit');
  assert.equal(result.diagnostics.hasErrors(), true);
});

test('ParseSession refreshes the cache when document bytes change', async () => {
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
  const session = new ParseSession({ loader, cache });

  const result = await session.parseDocument('ignored');

  assert.equal(cache.getCalls, 1);
  assert.equal(cache.setCalls, 1, 'expected cache to store updated document');
  assert.notEqual(result.document, staleDocument, 'expected new document when bytes change');
  assert.equal(cache.lastSet, result.document);
  assert.ok(result.ast);
  assert.equal(result.diagnostics.hasErrors(), false);
});

test('ParseSession surfaces diagnostics when cache writes fail', async () => {
  const uri = new URL('memory://cache/failure');
  const loader = new StaticLoader(uri, VALID_DOCUMENT);
  const cache = new FailingCache();
  const session = new ParseSession({ loader, cache });

  const result = await session.parseDocument('ignored');

  const diagnostics = result.diagnostics.toArray();
  const cacheDiagnostic = diagnostics.find((entry) => entry.code === DiagnosticCodes.core.CACHE_FAILED);

  assert.ok(cacheDiagnostic, 'expected cache failure diagnostic');
  assert.equal(cacheDiagnostic?.severity, 'warning');
  assert.equal(cache.setCalls, 1, 'expected cache set to be attempted');
  assert.ok(result.document);
  assert.equal(result.diagnostics.hasErrors(), false);
});

test('ParseSession invokes extension plugins and records results', async () => {
  const plugin: ParserPlugin = {
    name: 'extension-plugin',
    extensions: {
      'com.example': ({ value, pointer }) => ({
        normalized: { ...(value as Record<string, unknown>), role: 'PRIMARY' },
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

  assert.ok(result.ast);
  const extensionResults = result.extensions ?? [];
  assert.equal(extensionResults.length, 1);
  const evaluation = extensionResults[0];
  assert.equal(evaluation.plugin, 'extension-plugin');
  assert.equal(evaluation.namespace, 'com.example');
  assert.equal(evaluation.pointer, '#/color/brand/$extensions/com.example');
  assert.deepEqual(evaluation.value, { role: 'primary' });
  assert.deepEqual(evaluation.normalized, { role: 'PRIMARY' });
  assert.equal(evaluation.diagnostics.length, 1);

  const pluginDiagnostic = result.diagnostics
    .toArray()
    .find((entry) => entry.code === DiagnosticCodes.core.NOT_IMPLEMENTED);
  assert.ok(pluginDiagnostic, 'expected plugin diagnostic from extension handler');
});

test('ParseSession surfaces diagnostics when extension plugins throw', async () => {
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

  const diagnostic = result.diagnostics
    .toArray()
    .find((entry) => entry.code === DiagnosticCodes.plugins.EXTENSION_FAILED);

  assert.ok(diagnostic, 'expected extension failure diagnostic');
  assert.equal(diagnostic?.pointer, '#/color/brand/$extensions/com.example');
  assert.equal(diagnostic?.severity, 'error');
  assert.equal(result.extensions?.length ?? 0, 0);
});

class StaticLoader implements DocumentLoader {
  constructor(private readonly uri: URL, private readonly text: string) {}

  async load(): Promise<DocumentHandle> {
    return createMemoryHandle(this.uri, this.text);
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

  async get(uri: URL): Promise<RawDocument | undefined> {
    this.getCalls++;
    if (this.document && this.document.uri.href !== uri.href) {
      return undefined;
    }
    return this.document;
  }

  async set(document: RawDocument): Promise<void> {
    this.setCalls++;
    this.lastSet = document;
    this.document = document;
  }
}

class FailingCache implements DocumentCache {
  getCalls = 0;
  setCalls = 0;

  async get(): Promise<RawDocument | undefined> {
    this.getCalls++;
    return undefined;
  }

  async set(): Promise<void> {
    this.setCalls++;
    throw new Error('cache write failed');
  }
}

function createMemoryHandle(uri: URL, text: string): DocumentHandle {
  const bytes = new TextEncoder().encode(text);
  return Object.freeze({ uri, contentType: 'application/json', bytes });
}
