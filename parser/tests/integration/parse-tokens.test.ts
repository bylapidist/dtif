import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseTokens,
  parseTokensSync,
  type ParseTokensSyncOptions
} from '../../src/tokens/parse-tokens.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import type { TokenCache, TokenCacheSnapshot, TokenCacheKey } from '../../src/tokens/cache.js';
import { computeDocumentHash } from '../../src/tokens/cache.js';
import type { DiagnosticEvent } from '../../src/domain/models.js';
import { DefaultDocumentLoader } from '../../src/io/document-loader.js';
import { assertNullPrototypeDeep, toSerializable } from '../helpers/json-assertions.js';

const INLINE_DOCUMENT = `
$schema: https://dtif.lapidist.net/schema/core.json
aliases:
  brand:
    $type: color
    $ref: "#/colors/primary"
colors:
  primary:
    $type: color
    $value:
      colorSpace: srgb
      components: [0.1, 0.2, 0.3]
    $description: Primary brand color
    $extensions:
      vendor.test:
        note: keep
    $deprecated:
      $replacement: "#/aliases/brand"
`;

const SINGLE_LINE_INLINE_DOCUMENT =
  '$schema: https://dtif.lapidist.net/schema/core.json colors: { primary: { $type: color, $value: { colorSpace: srgb, components: [0.1, 0.2, 0.3] } } }';

void test('parseTokens flattens DTIF tokens with metadata and resolution snapshots', async () => {
  const result = await parseTokens(INLINE_DOCUMENT);

  assert.equal(result.diagnostics.length, 0, 'expected no diagnostics for valid document');
  assert.ok(result.document, 'expected raw document to be returned');
  assert.ok(result.graph, 'expected graph to be returned');
  assert.ok(result.resolver, 'expected resolver to be returned');

  assert.equal(result.flattened.length, 2, 'expected two flattened tokens');

  const primary = result.flattened.find((token) => token.name === 'primary');
  assert.ok(primary, 'expected primary token to be flattened');
  assert.equal(primary.type, 'color', 'expected flattened type to match base type');
  const primaryValue = { colorSpace: 'srgb', components: [0.1, 0.2, 0.3] };
  assert.deepEqual(
    primary.value,
    primaryValue,
    'expected flattened value to reflect resolved token'
  );

  const alias = result.flattened.find((token) => token.name === 'brand');
  assert.ok(alias, 'expected alias token to be flattened');
  assert.deepEqual(alias.value, primaryValue, 'expected alias value to resolve to primary value');

  const primaryMetadata = result.metadataIndex.get('#/colors/primary');
  assert.ok(primaryMetadata, 'expected metadata snapshot for primary token');
  assert.equal(primaryMetadata.description, 'Primary brand color');
  assert.deepEqual(primaryMetadata.extensions['vendor.test'], { note: 'keep' });
  const supersededBy = primaryMetadata.deprecated?.supersededBy;
  assert.ok(supersededBy, 'expected deprecated metadata to resolve replacement pointer');
  assert.equal(
    supersededBy.pointer,
    '#/aliases/brand',
    'expected deprecated metadata to resolve replacement pointer'
  );

  const aliasResolution = result.resolutionIndex.get('#/aliases/brand');
  assert.ok(aliasResolution, 'expected resolution snapshot for alias token');
  assert.ok(aliasResolution.references.some((ref) => ref.pointer === '#/colors/primary'));
  assert.deepEqual(
    aliasResolution.value,
    primaryValue,
    'expected alias resolution value to match flattened alias value'
  );
});

void test('parseTokens accepts in-memory design token objects', async () => {
  const tokens = {
    $schema: 'https://dtif.lapidist.net/schema/core.json',
    colors: {
      brand: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0.4, 0.4, 0.4] }
      }
    }
  } as const;

  const result = await parseTokens(tokens);

  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.flattened.length, 1);
  const [token] = result.flattened;
  assert.equal(token.name, 'brand');
  assert.equal(token.type, 'color');
  const { document } = result;
  assert.ok(document, 'expected document to be returned');
  assert.notEqual(document.data, tokens);
  assert.deepEqual(toSerializable(document.data), tokens);
  assertNullPrototypeDeep(document.data);
});

void test('parseTokens rejects deprecated replacements that resolve to a mismatched token type', async () => {
  const result = await parseTokens({
    $schema: 'https://dtif.lapidist.net/schema/core.json',
    color: {
      base: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] },
        $deprecated: { $replacement: '#/dimension/space' }
      }
    },
    dimension: {
      space: {
        $type: 'dimension',
        $value: { dimensionType: 'length', value: 4, unit: 'px' }
      }
    }
  });

  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === DiagnosticCodes.schemaGuard.INVALID_DOCUMENT &&
        /deprecated replacement .* has type dimension, expected color/i.test(diagnostic.message)
    ),
    'expected schema-guard diagnostic for deprecated replacement type mismatch'
  );
});

void test('parseTokens reuses cached artifacts when TokenCache entries are fresh', async () => {
  const cache = new RecordingTokenCache();

  const first = await parseTokens(INLINE_DOCUMENT, { tokenCache: cache });
  assert.equal(cache.setCalls, 1, 'expected cache to be populated on first parse');
  assert.equal(first.flattened.length, 2, 'expected flattened tokens from first parse');

  const second = await parseTokens(INLINE_DOCUMENT, { tokenCache: cache });
  assert.equal(cache.getCalls >= 2, true, 'expected cache to be consulted on reuse');
  assert.equal(cache.setCalls, 1, 'expected cache entry to be reused without re-writing');
  assert.equal(second.flattened.length, 2, 'expected flattened tokens from cached parse');
});

void test('parseTokens forwards diagnostics to callbacks', async () => {
  const invalidDocument = `
$schema: https://dtif.lapidist.net/schema/core.json
colors:
  primary:
    $type: color
`;

  const seenDiagnostics: DiagnosticEvent[] = [];
  let warnCalled = false;

  const result = await parseTokens(invalidDocument, {
    onDiagnostic: (diagnostic) => {
      seenDiagnostics.push(diagnostic);
    },
    warn: () => {
      warnCalled = true;
    }
  });

  assert.ok(result.diagnostics.length > 0, 'expected diagnostics for invalid document');
  assert.equal(
    seenDiagnostics.length,
    result.diagnostics.length,
    'expected callback to receive each diagnostic'
  );
  assert.equal(warnCalled, false, 'expected warn callback to be skipped for errors');
});

void test('parseTokens invokes warn callbacks for cached non-error diagnostics', async () => {
  const initial = await parseTokens(INLINE_DOCUMENT);
  const { document } = initial;
  assert.ok(document, 'expected document in initial parse');

  const warning: DiagnosticEvent = {
    severity: 'warning',
    code: DiagnosticCodes.core.CACHE_FAILED,
    message: 'cached warning',
    span: {
      uri: document.identity.uri,
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 0, line: 1, column: 1 }
    }
  };

  const cacheEntry: TokenCacheSnapshot = {
    documentHash: computeDocumentHash(document),
    flattened: initial.flattened,
    metadataIndex: initial.metadataIndex,
    resolutionIndex: initial.resolutionIndex,
    diagnostics: [warning],
    timestamp: Date.now()
  };

  const cache: TokenCache = {
    get() {
      return cacheEntry;
    },
    set(key, value) {
      void key;
      void value;
    }
  };

  const warnings: DiagnosticEvent[] = [];
  const diagnostics: DiagnosticEvent[] = [];

  const cached = await parseTokens(INLINE_DOCUMENT, {
    tokenCache: cache,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    warn: (diagnostic) => warnings.push(diagnostic)
  });

  assert.equal(cached.diagnostics.length, 1, 'expected cached diagnostic to be returned');
  assert.equal(diagnostics.length, 1, 'expected onDiagnostic to receive cached diagnostic');
  assert.equal(warnings.length, 1, 'expected warn callback to receive cached warning');
  assert.equal(warnings[0].message, 'cached warning');
});

void test('parseTokensSync supports inline strings and design token objects', () => {
  const syncResult = parseTokensSync(INLINE_DOCUMENT);
  assert.equal(syncResult.flattened.length, 2, 'expected synchronous parsing to flatten tokens');

  const tokens = {
    $schema: 'https://dtif.lapidist.net/schema/core.json',
    colors: {
      brand: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0.4, 0.4, 0.4] }
      }
    }
  } as const;

  const objectResult = parseTokensSync(tokens);
  assert.equal(objectResult.flattened.length, 1, 'expected object input to parse synchronously');
  const { document: objectDocument } = objectResult;
  assert.ok(objectDocument, 'expected synchronous parse to return document');
  assert.notEqual(objectDocument.data, tokens);
  assert.deepEqual(toSerializable(objectDocument.data), tokens);
  assertNullPrototypeDeep(objectDocument.data);
});

void test('parseTokensSync accepts single-line inline YAML content', () => {
  const result = parseTokensSync(SINGLE_LINE_INLINE_DOCUMENT);

  assert.equal(result.diagnostics.length, 0, 'expected no diagnostics for valid single-line YAML');
  assert.equal(result.flattened.length, 1, 'expected single token to be flattened');

  const [token] = result.flattened;
  assert.equal(token.name, 'primary');
  assert.equal(token.type, 'color');
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.1, 0.2, 0.3] });
});

void test('parseTokensSync infers YAML content types for inline records', () => {
  const result = parseTokensSync({ content: 'value: 42' });
  const { document } = result;
  assert.ok(document, 'expected synchronous parse to return document');
  assert.equal(
    document.identity.contentType,
    'application/yaml',
    'expected YAML content type to be inferred from inline content'
  );
});

void test('parseTokensSync does not treat URLs as inline YAML content', () => {
  assert.throws(
    () => parseTokensSync('https://dtif.lapidist.net/schema/core.json'),
    /requires inline content/,
    'expected URL strings to be treated as non-inline inputs'
  );
});

void test('parseTokensSync throws when provided an asynchronous cache implementation', () => {
  const asyncCache = new AsyncTokenCache();
  assert.throws(
    () => parseTokensSync(INLINE_DOCUMENT, { tokenCache: asyncCache }),
    /synchronous get\/set semantics/,
    'expected synchronous parsing to reject asynchronous caches'
  );
});

void test('parseTokensSync rejects document caches in JavaScript callers', () => {
  const options: ParseTokensSyncOptions = {};
  Object.defineProperty(options, 'documentCache', {
    value: {},
    enumerable: true,
    writable: false,
    configurable: false
  });

  assert.throws(
    () => parseTokensSync(INLINE_DOCUMENT, options),
    /does not support document caches/,
    'expected synchronous parsing to reject document cache options'
  );
});

void test('parseTokensSync rejects custom loaders in JavaScript callers', () => {
  const options: ParseTokensSyncOptions = {};
  Object.defineProperty(options, 'loader', {
    value: new DefaultDocumentLoader(),
    enumerable: true,
    writable: false,
    configurable: false
  });

  assert.throws(
    () => parseTokensSync(INLINE_DOCUMENT, options),
    /does not support custom document loaders/,
    'expected synchronous parsing to reject loader options'
  );
});

class RecordingTokenCache implements TokenCache {
  readonly store = new Map<string, TokenCacheSnapshot>();
  getCalls = 0;
  setCalls = 0;

  get(key: TokenCacheKey): TokenCacheSnapshot | undefined {
    this.getCalls += 1;
    return this.store.get(serializeKey(key));
  }

  set(key: TokenCacheKey, value: TokenCacheSnapshot): void {
    this.setCalls += 1;
    this.store.set(serializeKey(key), value);
  }
}

class AsyncTokenCache implements TokenCache {
  get(key: TokenCacheKey): TokenCacheSnapshot | undefined {
    void key;
    return undefined;
  }

  set(key: TokenCacheKey, value: TokenCacheSnapshot): Promise<void> {
    void key;
    void value;
    return Promise.resolve();
  }
}

function serializeKey(key: TokenCacheKey): string {
  return `${key.document.uri.href}::${key.variant ?? ''}`;
}
