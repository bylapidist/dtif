import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDocument } from '../../src/ast/normaliser.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import { decodeDocument } from '../../src/io/decoder.js';
import { JSON_POINTER_ROOT } from '../../src/utils/json-pointer.js';
import type { DocumentHandle } from '../../src/types.js';

const encoder = new TextEncoder();

function createHandle(content: string): DocumentHandle {
  return {
    uri: new URL('memory://normaliser-test'),
    contentType: 'application/json',
    bytes: encoder.encode(content)
  };
}

async function normalise(content: string) {
  const raw = await decodeDocument(createHandle(content));
  return normalizeDocument(raw);
}

test('normalises collections, tokens, aliases, and metadata', async () => {
  const json = JSON.stringify(
    {
      $schema: 'https://dtif.lapidist.net/schema/core.json',
      $version: '1.2.3',
      $description: 'Root description',
      color: {
        $description: 'Color tokens',
        brand: {
          $type: 'color',
          $value: { colorSpace: 'srgb', components: [1, 0, 0, 1] },
          $tags: ['brand', 'primary'],
          $extensions: { 'com.example': { role: 'primary' } }
        },
        accent: {
          $type: 'color',
          $ref: '#/color/brand'
        }
      }
    },
    null,
    2
  );

  const result = await normalise(json);

  assert.equal(result.diagnostics.length, 0);
  assert.ok(result.ast, 'expected document AST to be created');

  const ast = result.ast!;
  assert.equal(ast.kind, 'document');
  assert.equal(ast.pointer, JSON_POINTER_ROOT);
  assert.equal(ast.schema?.value, 'https://dtif.lapidist.net/schema/core.json');
  assert.equal(ast.version?.value, '1.2.3');
  assert.equal(ast.metadata.description?.value, 'Root description');
  assert.equal(ast.children.length, 1);

  const colorCollection = ast.children[0];
  assert.equal(colorCollection.kind, 'collection');
  assert.equal(colorCollection.name, 'color');
  assert.equal(colorCollection.metadata.description?.value, 'Color tokens');
  assert.equal(colorCollection.children.length, 2);

  const [brandToken, accentAlias] = colorCollection.children;
  assert.equal(brandToken.kind, 'token');
  assert.equal(brandToken.name, 'brand');
  assert.deepEqual(brandToken.metadata.tags?.value, ['brand', 'primary']);
  assert.equal(brandToken.metadata.extensions?.value['com.example'].role, 'primary');
  assert.equal(accentAlias.kind, 'alias');
  assert.equal(accentAlias.name, 'accent');
  assert.equal(accentAlias.type.value, 'color');
  assert.equal(accentAlias.ref.value, '#/color/brand');
});

test('normalises overrides with fallback chains', async () => {
  const json = JSON.stringify(
    {
      token: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
      },
      alternate: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [1, 1, 1, 1] }
      },
      $overrides: [
        {
          $token: '#/token',
          $when: { mode: 'dark' },
          $fallback: [
            { $ref: '#/alternate' },
            { $value: { colorSpace: 'srgb', components: [0.5, 0.5, 0.5, 1] } }
          ]
        }
      ]
    },
    null,
    2
  );

  const result = await normalise(json);
  assert.ok(result.ast);
  assert.equal(result.diagnostics.length, 0);

  const override = result.ast!.overrides[0];
  assert.equal(override.token.value, '#/token');
  assert.deepEqual(override.when.value, { mode: 'dark' });
  assert.ok(override.fallback);
  assert.equal(override.fallback!.length, 2);
  assert.equal(override.fallback![0].ref?.value, '#/alternate');
  assert.deepEqual(override.fallback![1].value?.value, {
    colorSpace: 'srgb',
    components: [0.5, 0.5, 0.5, 1]
  });
});

test('emits diagnostics when alias tokens omit $type', async () => {
  const json = JSON.stringify(
    {
      color: {
        base: { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] } },
        alias: { $ref: '#/color/base' }
      }
    },
    null,
    2
  );

  const result = await normalise(json);
  const codes = result.diagnostics.map((diagnostic) => diagnostic.code);
  assert.ok(codes.includes(DiagnosticCodes.normaliser.ALIAS_MISSING_TYPE));

  const colorCollection = result.ast?.children[0];
  assert.ok(colorCollection);
  assert.equal(colorCollection.kind, 'collection');
  const names = colorCollection.children.map((child) => child.name);
  assert.deepEqual(names, ['base']);
});
