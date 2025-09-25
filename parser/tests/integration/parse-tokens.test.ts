import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTokens, parseTokensSync } from '../../src/tokens/parse-tokens.js';
import type { ParseCache, ParseCacheEntry, ParseCacheKey } from '../../src/tokens/cache.js';
import { computeDocumentHash } from '../../src/tokens/cache.js';
import type { TokenDiagnostic } from '../../src/tokens/types.js';

const INLINE_DOCUMENT = `
$schema: https://dtif.lapidist.net/schema/core.json
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
aliases:
  brand:
    $type: color
    $ref: "#/colors/primary"
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
  assert.deepEqual(document.data, tokens);
});

void test('parseTokens reuses cached artifacts when ParseCache entries are fresh', async () => {
  const cache = new RecordingParseCache();

  const first = await parseTokens(INLINE_DOCUMENT, { cache });
  assert.equal(cache.setCalls, 1, 'expected cache to be populated on first parse');
  assert.equal(first.flattened.length, 2, 'expected flattened tokens from first parse');

  const second = await parseTokens(INLINE_DOCUMENT, { cache });
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

  const seenDiagnostics: TokenDiagnostic[] = [];
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

  const warning: TokenDiagnostic = {
    severity: 'warning',
    code: 'cache.warning',
    message: 'cached warning',
    source: 'dtif-parser',
    target: {
      uri: document.uri.href,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 }
      }
    }
  };

  const cacheEntry: ParseCacheEntry = {
    documentHash: computeDocumentHash(document),
    flattened: initial.flattened,
    metadataIndex: initial.metadataIndex,
    resolutionIndex: initial.resolutionIndex,
    diagnostics: [warning],
    timestamp: Date.now()
  };

  const cache: ParseCache = {
    get() {
      return cacheEntry;
    },
    set(key, value) {
      void key;
      void value;
    }
  };

  const warnings: TokenDiagnostic[] = [];
  const diagnostics: TokenDiagnostic[] = [];

  const cached = await parseTokens(INLINE_DOCUMENT, {
    cache,
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
  assert.deepEqual(objectDocument.data, tokens);
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
    document.contentType,
    'application/yaml',
    'expected YAML content type to be inferred from inline content'
  );
});

void test('parseTokensSync throws when provided an asynchronous cache implementation', () => {
  const asyncCache = new AsyncParseCache();
  assert.throws(
    () => parseTokensSync(INLINE_DOCUMENT, { cache: asyncCache }),
    /synchronous get\/set semantics/,
    'expected synchronous parsing to reject asynchronous caches'
  );
});

class RecordingParseCache implements ParseCache {
  readonly store = new Map<string, ParseCacheEntry>();
  getCalls = 0;
  setCalls = 0;

  get(key: ParseCacheKey): ParseCacheEntry | undefined {
    this.getCalls += 1;
    return this.store.get(serializeKey(key));
  }

  set(key: ParseCacheKey, value: ParseCacheEntry): void {
    this.setCalls += 1;
    this.store.set(serializeKey(key), value);
  }
}

class AsyncParseCache implements ParseCache {
  get(): ParseCacheEntry | undefined {
    return undefined;
  }

  set(): Promise<void> {
    return Promise.resolve();
  }
}

function serializeKey(key: ParseCacheKey): string {
  return `${key.uri}::${key.variant}`;
}
