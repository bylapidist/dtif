import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDesignTokenDocument,
  isParseDataInputRecord,
  isParseInputRecord,
  isRecord
} from '../../src/input/contracts.js';

void test('input contracts: detects plain object design token documents', () => {
  assert.equal(isDesignTokenDocument({ $schema: 'https://example.com/schema' }), true);
  assert.equal(isDesignTokenDocument(Object.create(null)), true);
  assert.equal(isDesignTokenDocument(new URL('https://example.com')), false);
  assert.equal(isDesignTokenDocument(new Uint8Array([1, 2, 3])), false);
  assert.equal(isDesignTokenDocument('text'), false);
});

void test('input contracts: validates parse input records', () => {
  assert.equal(isParseInputRecord({ content: '{"ok":true}' }), true);
  assert.equal(
    isParseInputRecord({
      uri: 'file:///tokens.json',
      content: new Uint8Array([123, 125]),
      contentType: 'application/json'
    }),
    true
  );
  assert.equal(isParseInputRecord({ content: 42 }), false);
  assert.equal(isParseInputRecord({ uri: 42, content: '{}' }), false);
});

void test('input contracts: validates parse data records', () => {
  assert.equal(
    isParseDataInputRecord({
      data: {
        $schema: 'https://dtif.lapidist.net/schema/core.json'
      }
    }),
    true
  );
  assert.equal(isParseDataInputRecord({ data: new URL('https://example.com') }), false);
  assert.equal(isParseDataInputRecord({ content: '{}' }), false);
});

void test('input contracts: detects object-like records', () => {
  assert.equal(isRecord({ ok: true }), true);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord('value'), false);
});
