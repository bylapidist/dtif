import assert from 'node:assert/strict';
import test from 'node:test';

import {
  JSON_POINTER_ROOT,
  appendJsonPointer,
  decodeJsonPointerSegment,
  encodeJsonPointerSegment,
  isJsonPointer,
  joinJsonPointer,
  jsonPointerStartsWith,
  normalizeJsonPointer,
  parentJsonPointer,
  splitJsonPointer,
  tailJsonPointer
} from '../../src/utils/json-pointer.js';

test('normalizeJsonPointer canonicalises pointer prefixes', () => {
  assert.equal(normalizeJsonPointer('#'), '#');
  assert.equal(normalizeJsonPointer('#/color'), '#/color');
  assert.equal(normalizeJsonPointer('color'), '#/color');
  assert.equal(normalizeJsonPointer('/color'), '#/color');
  assert.equal(normalizeJsonPointer('#color'), '#/color');
});

test('splitJsonPointer decodes segments', () => {
  assert.deepEqual(splitJsonPointer(JSON_POINTER_ROOT), []);
  assert.deepEqual(splitJsonPointer('#/color/brand'), ['color', 'brand']);
  assert.deepEqual(splitJsonPointer('#/'), ['']);

  const pointer = '#/foo~1bar/~0tilde';
  assert.deepEqual(splitJsonPointer(pointer), ['foo/bar', '~tilde']);
});

test('joinJsonPointer and appendJsonPointer encode segments correctly', () => {
  const pointer = joinJsonPointer(['layer', 'tokens']);
  assert.equal(pointer, '#/layer/tokens');

  const nested = appendJsonPointer(pointer, 'accent/primary', '~value');
  assert.equal(nested, '#/layer/tokens/accent~1primary/~0value');
  assert.deepEqual(splitJsonPointer(nested), ['layer', 'tokens', 'accent/primary', '~value']);
});

test('jsonPointerStartsWith and parentJsonPointer inspect hierarchy', () => {
  const pointer = appendJsonPointer(JSON_POINTER_ROOT, 'a', 'b', 'c');
  assert.ok(jsonPointerStartsWith(pointer, JSON_POINTER_ROOT));
  assert.ok(jsonPointerStartsWith(pointer, appendJsonPointer(JSON_POINTER_ROOT, 'a')));
  assert.equal(
    jsonPointerStartsWith(pointer, appendJsonPointer(JSON_POINTER_ROOT, 'a', 'd')),
    false
  );

  assert.equal(parentJsonPointer(pointer), '#/a/b');
  assert.equal(parentJsonPointer(JSON_POINTER_ROOT), undefined);
  assert.equal(tailJsonPointer(pointer), 'c');
});

test('encodeJsonPointerSegment and decodeJsonPointerSegment round-trip values', () => {
  const original = 'value/with~specials';
  const encoded = encodeJsonPointerSegment(original);
  assert.equal(encoded, 'value~1with~0specials');
  assert.equal(decodeJsonPointerSegment(encoded), original);
});

test('isJsonPointer validates pointer syntax', () => {
  assert.equal(isJsonPointer('#/foo/bar'), true);
  assert.equal(isJsonPointer('/foo/bar'), true);
  assert.equal(isJsonPointer('foo/bar'), true);
  assert.equal(isJsonPointer('#foo/bar~2'), false);
  assert.equal(isJsonPointer(null), false);
});
