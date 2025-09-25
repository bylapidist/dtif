import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeDocument, DecoderError } from '../../src/io/decoder.js';
import { JSON_POINTER_ROOT } from '../../src/utils/json-pointer.js';
import type { DocumentHandle } from '../../src/types.js';

const encoder = new TextEncoder();

function createHandle(
  content: Uint8Array,
  contentType: DocumentHandle['contentType']
): DocumentHandle {
  return {
    uri: new URL('memory://decoder-test'),
    contentType,
    bytes: content
  };
}

void test('decodes JSON with a UTF-8 BOM and builds source mappings', async () => {
  const json = '{\n  "color": {\n    "brand": "blue"\n  }\n}';
  const base = encoder.encode(json);
  const bytes = new Uint8Array(base.length + 3);
  bytes.set([0xef, 0xbb, 0xbf]);
  bytes.set(base, 3);

  const raw = await decodeDocument(createHandle(bytes, 'application/json'));

  assert.equal(raw.text, json);
  assert.deepEqual(raw.data, { color: { brand: 'blue' } });

  const root = raw.sourceMap.pointers.get(JSON_POINTER_ROOT);
  assert.ok(root);
  assert.equal(root.start.line, 1);
  assert.equal(root.end.line >= root.start.line, true);

  const span = raw.sourceMap.pointers.get('#/color/brand');
  assert.ok(span);
  assert.equal(span.start.line, 3);
  assert.equal(span.start.column, 14);
});

void test('rejects invalid UTF-8 sequences', async () => {
  const bytes = Uint8Array.of(0xff, 0xff, 0xff);
  const handle = createHandle(bytes, 'application/json');

  await assert.rejects(() => decodeDocument(handle), DecoderError);
});

void test('parses YAML anchors and merges alias content', async () => {
  const yaml = ['base: &base', '  value: 1', 'alias:', '  <<: *base', '  extra: 2', ''].join('\n');
  const handle = createHandle(encoder.encode(yaml), 'application/yaml');

  const raw = await decodeDocument(handle);

  assert.deepEqual(raw.data, {
    base: { value: 1 },
    alias: { value: 1, extra: 2 }
  });

  const aliasMerge = raw.sourceMap.pointers.get('#/alias/extra');
  assert.ok(aliasMerge);
});

void test('tracks mixed newline styles when computing pointer spans', async () => {
  const yaml = 'collection:\r\n  first:\n    value: 1\r\n  second:\n    value: 2\n';
  const handle = createHandle(encoder.encode(yaml), 'application/yaml');

  const raw = await decodeDocument(handle);

  const firstSpan = raw.sourceMap.pointers.get('#/collection/first/value');
  assert.ok(firstSpan);
  assert.equal(firstSpan.start.line, 3);
  assert.equal(firstSpan.start.column, 12);

  const secondSpan = raw.sourceMap.pointers.get('#/collection/second/value');
  assert.ok(secondSpan);
  assert.equal(secondSpan.start.line, 5);
  assert.equal(secondSpan.start.column, 12);
});
