import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocumentGraph } from '../../src/graph/builder.js';
import { normalizeDocument } from '../../src/ast/normaliser.js';
import { decodeDocument } from '../../src/io/decoder.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import type { DocumentHandle } from '../../src/types.js';

const encoder = new TextEncoder();

function createHandle(content: string): DocumentHandle {
  return {
    uri: new URL('memory://graph-builder-test'),
    contentType: 'application/json',
    bytes: encoder.encode(content)
  };
}

async function buildGraphFromJson(json: unknown) {
  const handle = createHandle(JSON.stringify(json));
  const raw = await decodeDocument(handle);
  const normalised = normalizeDocument(raw);
  const { ast } = normalised;
  assert.ok(ast, 'expected AST to be generated');
  const graphResult = buildDocumentGraph(ast);
  return { graphResult, ast };
}

void test('buildDocumentGraph indexes collections, tokens, aliases, and overrides', async () => {
  const json = {
    color: {
      brand: {
        primary: { $type: 'color', $value: '#000000' },
        inverted: { $type: 'color', $value: '#ffffff' },
        accent: { $type: 'color', $ref: '#/color/brand/primary' }
      }
    },
    $overrides: [
      {
        $token: '#/color/brand/primary',
        $when: { mode: 'dark' },
        $fallback: [{ $ref: '#/color/brand/inverted' }, { $value: '#101010' }]
      }
    ]
  };

  const { graphResult } = await buildGraphFromJson(json);
  assert.equal(graphResult.diagnostics.length, 0);
  const { graph } = graphResult;
  assert.ok(graph, 'expected document graph to be created');

  assert.equal(graph.kind, 'document-graph');
  assert.deepEqual(graph.rootPointers, ['#/color']);
  assert.equal(graph.nodes.size, 5);

  const collection = graph.nodes.get('#/color/brand');
  assert.ok(collection);
  assert.equal(collection.kind, 'collection');
  assert.deepEqual(collection.children, [
    '#/color/brand/primary',
    '#/color/brand/inverted',
    '#/color/brand/accent'
  ]);

  const alias = graph.nodes.get('#/color/brand/accent');
  assert.ok(alias && alias.kind === 'alias');
  assert.equal(alias.ref.value.pointer, '#/color/brand/primary');
  assert.equal(alias.ref.value.external, false);

  const override = graph.overrides[0];
  assert.equal(override.token.value.pointer, '#/color/brand/primary');
  assert.equal(override.token.value.external, false);
  const { fallback } = override;
  assert.ok(fallback);
  assert.equal(fallback.length, 2);
  const [firstFallback, secondFallback] = fallback;
  const { ref } = firstFallback;
  assert.ok(ref);
  assert.equal(ref.value.pointer, '#/color/brand/inverted');
  assert.equal(ref.value.external, false);
  const { value } = secondFallback;
  assert.ok(value);
  assert.equal(value.value, '#101010');
});

void test('buildDocumentGraph emits diagnostics for invalid alias references', async () => {
  const json = {
    color: {
      base: { $type: 'color', $value: '#000000' },
      alias: { $type: 'color', $ref: '#/color/base~2invalid' }
    }
  };

  const { graphResult } = await buildGraphFromJson(json);
  const codes = graphResult.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes(DiagnosticCodes.graph.INVALID_REFERENCE));

  const { graph: invalidGraph } = graphResult;
  assert.ok(invalidGraph);
  assert.equal(invalidGraph.nodes.has('#/color/alias'), false);
});

void test('buildDocumentGraph reports missing targets and invalid target kinds', async () => {
  const json = {
    color: {
      base: { $type: 'color', $value: '#000000' },
      alias: { $type: 'color', $ref: '#/color/missing' }
    },
    $overrides: [
      {
        $token: '#/color',
        $when: { mode: 'dark' },
        $ref: '#/color/base'
      }
    ]
  };

  const { graphResult } = await buildGraphFromJson(json);
  const codes = graphResult.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes(DiagnosticCodes.graph.MISSING_TARGET));
  assert.ok(codes.includes(DiagnosticCodes.graph.INVALID_TARGET_KIND));

  const { graph: missingGraph } = graphResult;
  assert.ok(missingGraph);
  const alias = missingGraph.nodes.get('#/color/alias');
  assert.ok(alias && alias.kind === 'alias');
  assert.equal(alias.ref.value.pointer, '#/color/missing');
});
