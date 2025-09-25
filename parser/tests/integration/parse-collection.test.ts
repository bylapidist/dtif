import assert from 'node:assert/strict';
import test from 'node:test';

import { createSession } from '../../src/session.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';

const VALID_DOCUMENT = JSON.stringify(
  {
    $schema: 'https://dtif.lapidist.net/schema/core.json',
    color: {
      brand: {
        primary: {
          $type: 'color',
          $value: {
            colorSpace: 'srgb',
            components: [0, 0, 0]
          }
        }
      }
    }
  },
  null,
  2
);

const INVALID_DOCUMENT = JSON.stringify(
  {
    $schema: 'https://dtif.lapidist.net/schema/core.json',
    color: {
      brand: {
        primary: {
          $type: 'color',
          $value: {
            colorSpace: 'srgb',
            components: []
          }
        }
      }
    }
  },
  null,
  2
);

void test('parseCollection returns per-document results with aggregated diagnostics', async () => {
  const session = createSession();
  const inputs = [
    { uri: 'memory://collection/valid.json', content: VALID_DOCUMENT },
    { uri: 'memory://collection/invalid.json', content: INVALID_DOCUMENT }
  ];

  const result = await session.parseCollection(inputs);

  assert.equal(result.results.length, 2, 'expected both documents to be parsed');

  const [valid, invalid] = result.results;

  assert.ok(valid.document, 'expected valid document to be decoded');
  assert.ok(valid.ast, 'expected valid document to produce an AST');
  assert.ok(valid.graph, 'expected valid document to produce a graph');
  assert.ok(valid.resolver, 'expected valid document to produce a resolver');
  assert.equal(valid.diagnostics.hasErrors(), false, 'expected no errors for valid document');

  assert.ok(invalid.document, 'expected invalid document bytes to be returned');
  assert.equal(invalid.ast, undefined, 'expected AST to be omitted when validation fails');
  assert.equal(invalid.graph, undefined, 'expected graph to be omitted when validation fails');
  assert.equal(
    invalid.resolver,
    undefined,
    'expected resolver to be omitted when validation fails'
  );
  const invalidDiagnostic = invalid.diagnostics
    .toArray()
    .find((entry) => entry.code === DiagnosticCodes.schemaGuard.INVALID_DOCUMENT);
  assert.ok(invalidDiagnostic, 'expected schema guard diagnostic for invalid document');

  assert.equal(
    result.diagnostics.errorCount,
    invalid.diagnostics.errorCount,
    'expected aggregated diagnostics to include per-document errors'
  );
  assert.ok(
    result.diagnostics
      .toArray()
      .some((entry) => entry.code === DiagnosticCodes.schemaGuard.INVALID_DOCUMENT),
    'expected aggregated diagnostics to expose schema failures'
  );
});
