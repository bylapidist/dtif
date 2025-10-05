import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDocumentRequest,
  createInlineDocumentRequest
} from '../../src/application/requests.js';
import type { InlineDocumentRequestInput } from '../../src/application/requests.js';
import type { ParseInputRecord, ParseDataInputRecord } from '../../src/types.js';

function createParseInputRecord(): ParseInputRecord {
  return {
    uri: 'file:///tokens.json',
    content: '{"value":1}',
    contentType: 'application/json'
  } satisfies ParseInputRecord;
}

function createParseDataRecord(): ParseDataInputRecord {
  return {
    uri: 'memory://token',
    data: { $schema: 'https://example.com' },
    contentType: 'application/json'
  } satisfies ParseDataInputRecord;
}

void test('createDocumentRequest returns a URI request for string input', () => {
  const request = createDocumentRequest('file:///tokens.json');
  assert.deepStrictEqual(request, { uri: 'file:///tokens.json' });
});

void test('createDocumentRequest returns a URI request for URL input', () => {
  const uri = new URL('file:///tokens.json');
  const request = createDocumentRequest(uri);
  assert.deepStrictEqual(request, { uri });
});

void test('createDocumentRequest returns inline content for byte inputs', () => {
  const bytes = Buffer.from('{"value":1}', 'utf8');
  const request = createDocumentRequest(bytes);
  assert.deepStrictEqual(request, { inlineContent: bytes });
});

void test('createDocumentRequest returns inline content for parse input records', () => {
  const record = createParseInputRecord();
  const request = createDocumentRequest(record);
  assert.deepStrictEqual(request, {
    uri: record.uri,
    inlineContent: record.content,
    contentTypeHint: record.contentType
  });
});

void test('createDocumentRequest returns inline data for parse data records', () => {
  const record = createParseDataRecord();
  const request = createDocumentRequest(record);
  assert.deepStrictEqual(request, {
    uri: record.uri,
    inlineData: record.data,
    contentTypeHint: record.contentType
  });
});

void test('createDocumentRequest returns inline data for token documents', () => {
  const request = createDocumentRequest({ $schema: 'https://example.com' });
  assert.deepStrictEqual(request, {
    inlineData: { $schema: 'https://example.com' },
    contentTypeHint: 'application/json'
  });
});

function createInlineRequestInput(): InlineDocumentRequestInput {
  return {
    uri: 'memory://inline',
    contentType: 'application/json',
    text: '{"value":1}'
  } satisfies InlineDocumentRequestInput;
}

void test('createInlineDocumentRequest preserves inline text content', () => {
  const input = createInlineRequestInput();
  const request = createInlineDocumentRequest(input);
  assert.deepStrictEqual(request, {
    uri: input.uri,
    inlineContent: input.text,
    contentTypeHint: input.contentType
  });
});

void test('createInlineDocumentRequest prefers inline data when provided', () => {
  const input: InlineDocumentRequestInput = {
    uri: 'memory://inline',
    contentType: 'application/json',
    data: { value: { foo: { $type: 'color', $value: '#fff' } } }
  };
  const request = createInlineDocumentRequest(input);
  assert.deepStrictEqual(request, {
    uri: input.uri,
    inlineData: input.data,
    contentTypeHint: input.contentType
  });
});
