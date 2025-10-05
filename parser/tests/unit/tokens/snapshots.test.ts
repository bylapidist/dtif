import assert from 'node:assert/strict';
import test from 'node:test';

import { createSession } from '../../../src/session.js';
import { createMetadataSnapshot, createResolutionSnapshot } from '../../../src/tokens/snapshots.js';
import type { Diagnostic } from '../../../src/types.js';
import type { ParseDocumentResult } from '../../../src/session.js';

const DOCUMENT = `
$schema: https://dtif.lapidist.net/schema/core.json
colors:
  primary:
    $type: color
    $value:
      colorSpace: srgb
      components: [0.1, 0.2, 0.3]
    $description: Primary brand color
    $extensions:
      vendor.test:
        flag: true
    $deprecated:
      $replacement: "#/aliases/brand"
aliases:
  brand:
    $type: color
    $ref: "#/colors/primary"
`;

type ParsedDocumentResult = ParseDocumentResult & {
  readonly document: NonNullable<ParseDocumentResult['document']>;
  readonly graph: NonNullable<ParseDocumentResult['graph']>;
  readonly resolution: NonNullable<ParseDocumentResult['resolution']>;
};

async function parseDocument(): Promise<ParsedDocumentResult> {
  const session = createSession();
  const result = await session.parseDocument(DOCUMENT);
  const { document, graph, resolution } = result;

  if (!document) {
    assert.fail('expected document to be returned');
  }

  if (!graph) {
    assert.fail('expected graph to be returned');
  }

  if (!resolution) {
    assert.fail('expected resolution outcome to be returned');
  }

  return {
    ...result,
    document,
    graph,
    resolution
  };
}

void test('createMetadataSnapshot normalises node metadata', async () => {
  const result = await parseDocument();
  const metadata = createMetadataSnapshot(result.graph.graph);

  const primary = metadata.get('#/colors/primary');
  assert.ok(primary, 'expected metadata snapshot for primary token');
  assert.equal(primary.description, 'Primary brand color');
  assert.deepEqual(primary.extensions['vendor.test'], { flag: true });
  const deprecated = primary.deprecated;
  assert.ok(deprecated, 'expected primary token to record deprecation metadata');
  const supersededBy = deprecated.supersededBy;
  assert.ok(supersededBy, 'expected deprecation metadata to include a superseding token');
  assert.equal(supersededBy.pointer, '#/aliases/brand');
  assert.equal(supersededBy.uri, result.document.identity.uri.href);
  assert.equal(primary.source.uri, result.document.identity.uri.href);
  assert.ok(primary.source.line >= 1, 'expected source line to be recorded');
  assert.ok(primary.source.column >= 1, 'expected source column to be recorded');
});

void test('createResolutionSnapshot captures references and alias traces', async () => {
  const result = await parseDocument();
  const diagnostics: Diagnostic[] = [];
  const snapshot = createResolutionSnapshot(result.graph.graph, result.resolution.result, {
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
  });

  assert.equal(
    diagnostics.length,
    0,
    'expected resolver not to emit diagnostics for valid document'
  );

  const primary = snapshot.get('#/colors/primary');
  assert.ok(primary, 'expected resolution snapshot for primary token');
  assert.equal(primary.type, 'color');
  assert.deepEqual(primary.raw, { colorSpace: 'srgb', components: [0.1, 0.2, 0.3] });
  assert.deepEqual(primary.value, primary.raw);
  assert.equal(primary.references.length, 0, 'expected base token to have no references');

  const alias = snapshot.get('#/aliases/brand');
  assert.ok(alias, 'expected resolution snapshot for alias token');
  assert.equal(alias.type, 'color');
  assert.deepEqual(alias.value, primary.value);
  assert.ok(
    alias.references.some((reference) => reference.pointer === '#/colors/primary'),
    'expected alias to record referenced token pointers'
  );
  assert.ok(
    alias.appliedAliases.some((pointer) => pointer.pointer === '#/aliases/brand'),
    'expected alias to mark applied alias pointers'
  );
  assert.ok(
    alias.resolutionPath.some((pointer) => pointer.pointer === '#/colors/primary'),
    'expected alias resolution path to include resolved token'
  );
});
