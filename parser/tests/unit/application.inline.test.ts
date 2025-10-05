import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import { createInlineDocumentHandle, decodeInlineDocument } from '../../src/application/inline.js';
import type { InlineDocumentRequestInput } from '../../src/application/requests.js';

void test('createInlineDocumentHandle encodes inline text content', () => {
  const input: InlineDocumentRequestInput = {
    uri: 'memory://inline/document',
    contentType: 'application/json',
    text: '{"value":1}'
  };

  const text = input.text ?? '';
  const handle = createInlineDocumentHandle(input);

  assert.strictEqual(handle.uri.href, 'memory://inline/document');
  assert.strictEqual(handle.contentType, 'application/json');
  assert.deepStrictEqual([...handle.bytes], [...Buffer.from(text, 'utf8')]);
  assert.strictEqual(handle.text, text);
});

void test('decodeInlineDocument returns structured content for inline text', () => {
  const input: InlineDocumentRequestInput = {
    uri: 'memory://inline/document',
    contentType: 'application/json',
    text: '{"value":1}'
  };

  const handle = createInlineDocumentHandle(input);
  const document = decodeInlineDocument(handle);

  assert.strictEqual(document.identity.uri.href, 'memory://inline/document');
  assert.strictEqual(document.identity.contentType, 'application/json');
  assert.deepStrictEqual(document.data, { value: 1 });
  assert.strictEqual(document.text, '{"value":1}');
});

void test('decodeInlineDocument reuses provided design token data', () => {
  const input: InlineDocumentRequestInput = {
    uri: 'memory://inline/document',
    contentType: 'application/json',
    data: { value: { color: { $type: 'color', $value: '#fff' } } }
  };

  const handle = createInlineDocumentHandle(input);
  const document = decodeInlineDocument(handle);

  assert.strictEqual(document.identity.uri.href, 'memory://inline/document');
  assert.strictEqual(document.identity.contentType, 'application/json');
  assert.deepStrictEqual(document.data, input.data);
  assert.strictEqual(typeof document.text, 'string');
});
