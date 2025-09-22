import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryDocumentCache } from '../../src/io/document-cache.js';
import { decodeDocument } from '../../src/io/decoder.js';
import type { RawDocument } from '../../src/types.js';

const encoder = new TextEncoder();

test('stores and retrieves documents', async () => {
  const cache = new InMemoryDocumentCache();
  const document = await createDocument('memory://cache/basic', 1);

  cache.set(document);

  assert.equal(cache.get(document.uri), document);
});

test('evicts the least recently used document when capacity is exceeded', async () => {
  const cache = new InMemoryDocumentCache({ maxEntries: 2 });
  const first = await createDocument('memory://cache/lru-1', 1);
  const second = await createDocument('memory://cache/lru-2', 2);
  const third = await createDocument('memory://cache/lru-3', 3);

  cache.set(first);
  cache.set(second);

  // Touch the first entry so the second becomes the oldest.
  assert.equal(cache.get(first.uri), first);

  cache.set(third);

  assert.equal(cache.get(first.uri), first, 'expected recently accessed entry to remain');
  assert.equal(cache.get(second.uri), undefined, 'expected least recently used entry to be evicted');
  assert.equal(cache.get(third.uri), third);
});

test('supports unbounded capacity when maxEntries is non-finite', async () => {
  const cache = new InMemoryDocumentCache({ maxEntries: Number.POSITIVE_INFINITY });
  const first = await createDocument('memory://cache/unbounded-1', 1);
  const second = await createDocument('memory://cache/unbounded-2', 2);
  const third = await createDocument('memory://cache/unbounded-3', 3);

  cache.set(first);
  cache.set(second);
  cache.set(third);

  assert.equal(cache.get(first.uri), first);
  assert.equal(cache.get(second.uri), second);
  assert.equal(cache.get(third.uri), third);
});

test('expires documents after the configured max age', async () => {
  let now = 0;
  const cache = new InMemoryDocumentCache({ maxAgeMs: 1000, clock: () => now });
  const document = await createDocument('memory://cache/ttl', 1);

  cache.set(document);

  assert.equal(cache.get(document.uri), document, 'expected fresh entry to be returned');

  now = 1001;

  assert.equal(cache.get(document.uri), undefined, 'expected expired entry to be evicted');
  assert.equal(cache.get(document.uri), undefined, 'expected expired entry to be removed on access');
});

test('applies a default expiration when maxAgeMs is omitted', async () => {
  let now = 0;
  const cache = new InMemoryDocumentCache({ clock: () => now });
  const document = await createDocument('memory://cache/default-ttl', 1);

  cache.set(document);

  assert.equal(cache.get(document.uri), document);

  now = 5 * 60 * 1000 + 1;

  assert.equal(
    cache.get(document.uri),
    undefined,
    'expected default max age to expire entries after five minutes'
  );
});

test('treats non-finite maxAgeMs as unbounded', async () => {
  let now = 0;
  const cache = new InMemoryDocumentCache({ maxAgeMs: Number.POSITIVE_INFINITY, clock: () => now });
  const document = await createDocument('memory://cache/unbounded', 1);

  cache.set(document);

  now = Number.MAX_SAFE_INTEGER;

  assert.equal(cache.get(document.uri), document);
});

test('delete removes cached documents', async () => {
  const cache = new InMemoryDocumentCache();
  const document = await createDocument('memory://cache/delete', 1);

  cache.set(document);
  cache.delete(document.uri);

  assert.equal(cache.get(document.uri), undefined);
});

test('clear removes all cached documents', async () => {
  const cache = new InMemoryDocumentCache();
  const first = await createDocument('memory://cache/clear-1', 1);
  const second = await createDocument('memory://cache/clear-2', 2);

  cache.set(first);
  cache.set(second);
  cache.clear();

  assert.equal(cache.get(first.uri), undefined);
  assert.equal(cache.get(second.uri), undefined);
});

test('maxEntries equal to zero disables caching entirely', async () => {
  const cache = new InMemoryDocumentCache({ maxEntries: 0 });
  const document = await createDocument('memory://cache/disabled', 1);

  cache.set(document);

  assert.equal(cache.get(document.uri), undefined);
});

async function createDocument(uri: string, value: unknown): Promise<RawDocument> {
  const text = JSON.stringify({ value });
  const bytes = encoder.encode(text);
  const handle = Object.freeze({
    uri: new URL(uri),
    contentType: 'application/json',
    bytes
  });
  return decodeDocument(handle);
}
