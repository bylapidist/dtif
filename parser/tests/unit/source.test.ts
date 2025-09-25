import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ZERO_SOURCE_POSITION,
  cloneSourcePosition,
  cloneSourceSpan,
  compareSourcePositions,
  createSourcePosition,
  createSourceSpan,
  isSourcePosition,
  isSourceSpan,
  maxSourcePosition,
  minSourcePosition,
  spanContainsPosition,
  spanLength,
  spansOverlap,
  translateSourceSpan,
  unionSourceSpans
} from '../../src/utils/source.js';

void test('createSourcePosition normalises bounds', () => {
  const position = createSourcePosition(-3.7, 0, 0);
  assert.equal(position.offset, 0);
  assert.equal(position.line, 1);
  assert.equal(position.column, 1);

  const clone = cloneSourcePosition(position);
  assert.deepEqual(clone, position);
  assert.notStrictEqual(clone, position);
  assert.ok(isSourcePosition(position));
  assert.ok(isSourcePosition(ZERO_SOURCE_POSITION));
});

void test('compareSourcePositions orders offsets, lines, and columns', () => {
  const a = createSourcePosition(0, 1, 1);
  const b = createSourcePosition(10, 2, 5);
  const c = createSourcePosition(10, 2, 7);

  assert.equal(compareSourcePositions(a, b) < 0, true);
  assert.equal(compareSourcePositions(b, c) < 0, true);
  assert.equal(compareSourcePositions(c, c), 0);
  assert.deepEqual(minSourcePosition(a, b, c), a);
  assert.deepEqual(maxSourcePosition(a, b, c), c);
});

void test('createSourceSpan orders endpoints and reports length', () => {
  const uri = new URL('file:///tokens.json');
  const start = createSourcePosition(20, 3, 1);
  const end = createSourcePosition(10, 2, 15);
  const span = createSourceSpan(uri, start, end);

  assert.deepEqual(span.start, end);
  assert.deepEqual(span.end, start);
  assert.equal(spanLength(span), 10);

  const cloned = cloneSourceSpan(span);
  assert.deepEqual(cloned, span);
  assert.notStrictEqual(cloned, span);
  assert.ok(isSourceSpan(span));
});

void test('spanContainsPosition and spansOverlap check spatial relationships', () => {
  const uri = new URL('file:///tokens.json');
  const a = createSourceSpan(uri, createSourcePosition(0, 1, 1), createSourcePosition(5, 1, 6));
  const b = createSourceSpan(uri, createSourcePosition(4, 1, 5), createSourcePosition(8, 1, 9));
  const otherUriSpan = createSourceSpan(
    new URL('file:///other.json'),
    createSourcePosition(0, 1, 1),
    createSourcePosition(5, 1, 5)
  );

  assert.equal(spanContainsPosition(a, createSourcePosition(4, 1, 5)), true);
  assert.equal(spanContainsPosition(a, createSourcePosition(6, 1, 7)), false);
  assert.equal(spansOverlap(a, b), true);
  assert.equal(spansOverlap(a, otherUriSpan), false);
});

void test('unionSourceSpans merges spans sharing a URI', () => {
  const uri = new URL('file:///tokens.json');
  const span = unionSourceSpans([
    createSourceSpan(uri, createSourcePosition(0, 1, 1), createSourcePosition(5, 1, 6)),
    createSourceSpan(uri, createSourcePosition(7, 2, 3), createSourcePosition(9, 2, 5))
  ]);

  assert.ok(span);
  assert.equal(span.start.offset, 0);
  assert.equal(span.end.offset, 9);

  assert.throws(() =>
    unionSourceSpans([
      createSourceSpan(uri, createSourcePosition(0, 1, 1), createSourcePosition(1, 1, 2)),
      createSourceSpan(
        new URL('file:///other.json'),
        createSourcePosition(0, 1, 1),
        createSourcePosition(1, 1, 2)
      )
    ])
  );
});

void test('translateSourceSpan shifts offsets while maintaining ordering', () => {
  const uri = new URL('file:///tokens.json');
  const original = createSourceSpan(
    uri,
    createSourcePosition(10, 2, 3),
    createSourcePosition(20, 3, 1)
  );
  const translated = translateSourceSpan(original, { offset: 5, line: 1, column: -2 });

  assert.equal(translated.start.offset, 15);
  assert.equal(translated.end.offset, 25);
  assert.equal(translated.start.line, 3);
  assert.equal(translated.end.line, 4);
  assert.equal(translated.start.column, 1);
  assert.equal(translated.end.column, 1);
});
