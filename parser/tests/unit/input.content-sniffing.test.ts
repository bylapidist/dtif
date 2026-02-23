import assert from 'node:assert/strict';
import test from 'node:test';

import { inferContentTypeFromContent, isInlineDocumentText } from '../../src/input/content-sniffing.js';

void test('content sniffing: infers json and yaml content types', () => {
  assert.equal(inferContentTypeFromContent('{"color":"#fff"}'), 'application/json');
  assert.equal(inferContentTypeFromContent('---\ncolor: "#fff"\n'), 'application/yaml');
  assert.equal(inferContentTypeFromContent('color: "#fff"'), 'application/yaml');
  assert.equal(inferContentTypeFromContent('   '), undefined);
});

void test('content sniffing: identifies inline documents', () => {
  assert.equal(isInlineDocumentText('{"value":1}'), true);
  assert.equal(isInlineDocumentText('---\nvalue: 1\n'), true);
  assert.equal(isInlineDocumentText('value: 1'), true);
  assert.equal(isInlineDocumentText('https://example.com/tokens.json'), false);
});
