import assert from 'node:assert/strict';
import test from 'node:test';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAnalysisStore } from '../src/core/documents/analysis-store.js';

void test('DocumentAnalysisStore keeps previous analysis when parsing fails', () => {
  const store = new DocumentAnalysisStore();
  const uri = 'file:///memory/store.json';

  const validDocument = TextDocument.create(
    uri,
    'json',
    1,
    '{ "tokens": { "color": { "$type": "color", "$value": { "colorSpace": "srgb" } } } }'
  );

  const validResult = store.update(validDocument);
  assert.equal(validResult.ok, true);
  assert.equal(validResult.status, 'updated');
  assert.equal(validResult.analysis, store.get(uri));

  const initialAnalysis = store.get(uri);
  assert.ok(initialAnalysis, 'expected analysis for valid document');

  const invalidDocument = TextDocument.create(
    uri,
    'json',
    2,
    '{ "tokens": { "color": { "$type": "color", } } }'
  );

  const invalidResult = store.update(invalidDocument);
  assert.equal(invalidResult.ok, true);
  assert.equal(invalidResult.status, 'retained');
  assert.equal(invalidResult.analysis, initialAnalysis);
  assert.equal(
    store.get(uri),
    initialAnalysis,
    'expected previous analysis to remain after parse failure'
  );
});

void test('DocumentAnalysisStore clears analysis when parsing fails with no previous state', () => {
  const store = new DocumentAnalysisStore();
  const uri = 'file:///memory/store.json';

  const invalidDocument = TextDocument.create(uri, 'json', 1, '{ "tokens": { "color": { "');

  const result = store.update(invalidDocument);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'cleared');
  assert.equal(result.analysis, undefined);
  assert.equal(store.get(uri), undefined, 'expected no analysis to be stored');
});

void test('DocumentAnalysisStore updates analysis again after a parse failure recovers', () => {
  const store = new DocumentAnalysisStore();
  const uri = 'file:///memory/store.json';

  const firstValid = TextDocument.create(
    uri,
    'json',
    1,
    '{ "tokens": { "size": { "$type": "dimension", "$value": { "dimensionType": "length" } } } }'
  );

  const firstResult = store.update(firstValid);
  assert.equal(firstResult.status, 'updated');
  const firstAnalysis = store.get(uri);
  assert.ok(firstAnalysis, 'expected initial analysis to exist');

  const invalidDocument = TextDocument.create(
    uri,
    'json',
    2,
    '{ "tokens": { "size": { "$type": "dimension", "$value": { "dimensionType": "length" }, } } }'
  );

  const invalidResult = store.update(invalidDocument);
  assert.equal(invalidResult.status, 'retained');
  assert.equal(store.get(uri), firstAnalysis);

  const recoveredDocument = TextDocument.create(
    uri,
    'json',
    3,
    '{ "tokens": { "size": { "$type": "dimension", "$value": { "dimensionType": "angle" } } } }'
  );

  const recoveredResult = store.update(recoveredDocument);
  assert.equal(recoveredResult.status, 'updated');
  const recoveredAnalysis = store.get(uri);
  assert.ok(recoveredAnalysis, 'expected analysis after recovery');
  assert.notEqual(recoveredAnalysis, firstAnalysis, 'expected analysis to refresh after recovery');
});

void test('DocumentAnalysisStore clears stale analysis when document becomes empty', () => {
  const store = new DocumentAnalysisStore();
  const uri = 'file:///memory/store.json';

  const validDocument = TextDocument.create(
    uri,
    'json',
    1,
    '{ "tokens": { "size": { "$type": "dimension", "$value": { "dimensionType": "angle" } } } }'
  );

  const firstResult = store.update(validDocument);
  assert.equal(firstResult.status, 'updated');
  assert.ok(store.get(uri));

  const emptyDocument = TextDocument.create(uri, 'json', 2, '   \n\n   ');

  const clearedResult = store.update(emptyDocument);
  assert.equal(clearedResult.status, 'cleared');
  assert.equal(clearedResult.analysis, undefined);
  assert.equal(store.get(uri), undefined, 'expected analysis to be removed for empty document');
});
