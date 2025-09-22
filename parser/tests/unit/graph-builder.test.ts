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
  assert.ok(normalised.ast, 'expected AST to be generated');
  const graphResult = buildDocumentGraph(normalised.ast!);
  return { graphResult, ast: normalised.ast! };
}

test('buildDocumentGraph indexes collections, tokens, aliases, and overrides', async () => {
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
  assert.ok(graphResult.graph, 'expected document graph to be created');

  const graph = graphResult.graph!;
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
  assert.ok(override.fallback);
  assert.equal(override.fallback!.length, 2);
  assert.equal(override.fallback![0].ref?.value.pointer, '#/color/brand/inverted');
  assert.equal(override.fallback![0].ref?.value.external, false);
  assert.equal(override.fallback![1].value?.value, '#101010');
});

test('buildDocumentGraph emits diagnostics for invalid alias references', async () => {
  const json = {
    color: {
      base: { $type: 'color', $value: '#000000' },
      alias: { $type: 'color', $ref: '#/color/base~2invalid' }
    }
  };

  const { graphResult } = await buildGraphFromJson(json);
  const codes = graphResult.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes(DiagnosticCodes.graph.INVALID_REFERENCE));

  assert.ok(graphResult.graph);
  assert.equal(graphResult.graph!.nodes.has('#/color/alias'), false);
});

test('buildDocumentGraph reports missing targets and invalid target kinds', async () => {
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

  const alias = graphResult.graph?.nodes.get('#/color/alias');
  assert.ok(alias && alias.kind === 'alias');
  assert.equal(alias.ref.value.pointer, '#/color/missing');
});
