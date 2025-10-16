import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDocument } from '../../src/ast/normaliser.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import { decodeDocument } from '../../src/io/decoder.js';
import { JSON_POINTER_ROOT } from '../../src/utils/json-pointer.js';
import type { DocumentHandle } from '../../src/types.js';
import type { DocumentAst, TokenNode } from '../../src/ast/nodes.js';

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

const BASE_TOKEN = {
  $type: 'color',
  $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
} as const;

function getToken(ast: DocumentAst, name: string): TokenNode {
  const node = ast.children.find(
    (child): child is TokenNode => child.kind === 'token' && child.name === name
  );
  assert.ok(node, `expected token ${name} to be normalised`);
  return node;
}

void test('normalises collections, tokens, aliases, and metadata', async () => {
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
  const { ast } = result;
  assert.ok(ast, 'expected document AST to be created');

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

void test('metadata rejects invalid lifecycle timestamps', async () => {
  const json = JSON.stringify(
    {
      invalidModified: {
        ...BASE_TOKEN,
        $lastModified: 'yesterday'
      },
      invalidUsed: {
        ...BASE_TOKEN,
        $lastUsed: 'not-a-date',
        $usageCount: 0
      }
    },
    null,
    2
  );

  const result = await normalise(json);
  const { ast, diagnostics } = result;
  assert.ok(ast);
  assert.equal(diagnostics.length, 2);
  assert.ok(
    diagnostics.some(
      (diagnostic) => diagnostic.message === '$lastModified must be an RFC 3339 date-time string.'
    )
  );
  assert.ok(
    diagnostics.some(
      (diagnostic) => diagnostic.message === '$lastUsed must be an RFC 3339 date-time string.'
    )
  );

  const invalidModified = getToken(ast, 'invalidModified');
  assert.equal(invalidModified.metadata.lastModified, undefined);

  const invalidUsed = getToken(ast, 'invalidUsed');
  assert.equal(invalidUsed.metadata.lastUsed, undefined);
  assert.equal(invalidUsed.metadata.usageCount?.value, 0);
});

void test('$lastUsed timestamps must not precede $lastModified', async () => {
  const json = JSON.stringify(
    {
      token: {
        ...BASE_TOKEN,
        $lastModified: '2024-05-01T10:00:00Z',
        $lastUsed: '2024-04-30T12:00:00Z',
        $usageCount: 3
      }
    },
    null,
    2
  );

  const result = await normalise(json);
  const { ast, diagnostics } = result;
  assert.ok(ast);
  assert.equal(diagnostics.length, 2);
  assert.ok(
    diagnostics.some(
      (diagnostic) => diagnostic.message === '$lastUsed must not precede $lastModified.'
    )
  );
  assert.ok(
    diagnostics.some(
      (diagnostic) =>
        diagnostic.message === '$usageCount greater than zero must be accompanied by $lastUsed.'
    )
  );

  const token = getToken(ast, 'token');
  assert.ok(token.metadata.lastModified);
  assert.equal(token.metadata.lastUsed, undefined);
  assert.equal(token.metadata.usageCount, undefined);
});

void test('metadata enforces $lastUsed and $usageCount pairing rules', async () => {
  const json = JSON.stringify(
    {
      missingCount: {
        ...BASE_TOKEN,
        $lastUsed: '2024-03-01T00:00:00Z'
      },
      zeroCount: {
        ...BASE_TOKEN,
        $lastUsed: '2024-03-01T00:00:00Z',
        $usageCount: 0
      },
      positiveWithoutUsed: {
        ...BASE_TOKEN,
        $usageCount: 5
      }
    },
    null,
    2
  );

  const result = await normalise(json);
  const { ast, diagnostics } = result;
  assert.ok(ast);
  assert.equal(diagnostics.length, 3);
  assert.ok(
    diagnostics.some(
      (diagnostic) => diagnostic.message === '$lastUsed must be accompanied by $usageCount.'
    )
  );
  assert.ok(
    diagnostics.some(
      (diagnostic) => diagnostic.message === '$lastUsed requires a positive $usageCount.'
    )
  );
  assert.ok(
    diagnostics.some(
      (diagnostic) =>
        diagnostic.message === '$usageCount greater than zero must be accompanied by $lastUsed.'
    )
  );

  const missingCount = getToken(ast, 'missingCount');
  assert.equal(missingCount.metadata.lastUsed, undefined);
  assert.equal(missingCount.metadata.usageCount, undefined);

  const zeroCount = getToken(ast, 'zeroCount');
  assert.equal(zeroCount.metadata.lastUsed, undefined);
  assert.equal(zeroCount.metadata.usageCount?.value, 0);

  const positiveWithoutUsed = getToken(ast, 'positiveWithoutUsed');
  assert.equal(positiveWithoutUsed.metadata.lastUsed, undefined);
  assert.equal(positiveWithoutUsed.metadata.usageCount, undefined);
});

void test('normalises overrides with fallback chains', async () => {
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
  const { ast } = result;
  assert.ok(ast);
  assert.equal(result.diagnostics.length, 0);

  const override = ast.overrides[0];
  assert.equal(override.token.value, '#/token');
  assert.deepEqual(override.when.value, { mode: 'dark' });
  const { fallback } = override;
  assert.ok(fallback);
  assert.equal(fallback.length, 2);
  const [firstFallback, secondFallback] = fallback;
  const { ref } = firstFallback;
  assert.ok(ref);
  assert.equal(ref.value, '#/alternate');
  const { value } = secondFallback;
  assert.ok(value);
  assert.deepEqual(value.value, {
    colorSpace: 'srgb',
    components: [0.5, 0.5, 0.5, 1]
  });
});

void test('emits diagnostics when alias tokens omit $type', async () => {
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
