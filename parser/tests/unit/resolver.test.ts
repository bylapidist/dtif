import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocumentGraph } from '../../src/graph/builder.js';
import { normalizeDocument } from '../../src/ast/normaliser.js';
import { createDocumentResolver, type DocumentResolverOptions } from '../../src/resolver/index.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import type { RawDocument } from '../../src/types.js';
import type { ResolvedTokenTransformEntry } from '../../src/plugins/index.js';

test('DocumentResolver resolves inline token values', () => {
  const { resolver } = buildResolver({
    color: {
      primary: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
      }
    }
  });

  const result = resolver.resolve('#/color/primary');

  assert.ok(result.token, 'expected token to resolve');
  assert.deepEqual(result.token?.value, { colorSpace: 'srgb', components: [0, 0, 0, 1] });
  assert.equal(result.diagnostics.length, 0);
});

test('DocumentResolver resolves alias chains', () => {
  const { resolver } = buildResolver({
    color: {
      base: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [1, 1, 1, 1] }
      },
      brand: {
        $type: 'color',
        $ref: '#/color/base'
      }
    }
  });

  const result = resolver.resolve('#/color/brand');

  assert.ok(result.token, 'expected alias to resolve');
  assert.deepEqual(result.token?.value, { colorSpace: 'srgb', components: [1, 1, 1, 1] });
  assert.equal(result.diagnostics.length, 0);
});

test('DocumentResolver applies overrides when context matches', () => {
  const { resolver } = buildResolver(
    {
      $overrides: [
        {
          $token: '#/button/bg',
          $when: { theme: 'dark' },
          $ref: '#/color/dark'
        }
      ],
      button: {
        bg: { $type: 'color', $ref: '#/color/light' }
      },
      color: {
        light: { $type: 'color', $value: 'light' },
        dark: { $type: 'color', $value: 'dark' }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');

  assert.ok(result.token, 'expected override to produce a token');
  assert.equal(result.token?.value, 'dark');
  assert.equal(result.diagnostics.length, 0);
});

test('DocumentResolver ignores overrides when context does not match', () => {
  const { resolver } = buildResolver({
    $overrides: [
      {
        $token: '#/button/bg',
        $when: { theme: 'dark' },
        $ref: '#/color/dark'
      }
    ],
    button: {
      bg: { $type: 'color', $ref: '#/color/light' }
    },
    color: {
      light: { $type: 'color', $value: 'light' },
      dark: { $type: 'color', $value: 'dark' }
    }
  });

  const result = resolver.resolve('#/button/bg');

  assert.ok(result.token);
  assert.equal(result.token?.value, 'light');
  assert.equal(result.diagnostics.length, 0);
});

test('DocumentResolver prefers the last matching override', () => {
  const { resolver } = buildResolver(
    {
      $overrides: [
        {
          $token: '#/button/bg',
          $when: { theme: 'dark' },
          $ref: '#/color/dark'
        },
        {
          $token: '#/button/bg',
          $when: { theme: 'dark' },
          $value: 'custom'
        }
      ],
      button: {
        bg: { $type: 'color', $ref: '#/color/light' }
      },
      color: {
        light: { $type: 'color', $value: 'light' },
        dark: { $type: 'color', $value: 'dark' }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');

  assert.ok(result.token);
  assert.equal(result.token?.value, 'custom');
  assert.equal(result.diagnostics.length, 0);
});

test('DocumentResolver uses fallback chains to resolve values', () => {
  const { resolver } = buildResolver(
    {
      $overrides: [
        {
          $token: '#/button/bg',
          $when: { theme: 'dark' },
          $fallback: [
            { $ref: '#/color/dark' },
            { $value: 'inline' }
          ]
        }
      ],
      button: {
        bg: { $type: 'color', $ref: '#/color/light' }
      },
      color: {
        light: { $type: 'color', $value: 'light' },
        dark: { $type: 'color', $value: 'dark' }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');

  assert.ok(result.token);
  assert.equal(result.token?.value, 'dark');
  assert.equal(result.diagnostics.length, 0);
});

test('DocumentResolver reports cycles for recursive aliases', () => {
  const { resolver } = buildResolver({
    color: {
      cyclic: { $type: 'color', $ref: '#/color/cyclic' }
    }
  });

  const result = resolver.resolve('#/color/cyclic');

  assert.ok(result.token);
  assert.equal(result.token?.value, undefined);
  const diagnostic = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.resolver.CYCLE_DETECTED
  );
  assert.ok(diagnostic, 'expected cycle diagnostic');
});

test('DocumentResolver reports unsupported external references', () => {
  const { resolver } = buildResolver({
    color: {
      external: { $type: 'color', $ref: 'https://example.com/tokens.json#/color/primary' }
    }
  });

  const result = resolver.resolve('#/color/external');

  assert.ok(result.token);
  assert.equal(result.token?.value, undefined);
  const diagnostic = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.resolver.EXTERNAL_REFERENCE
  );
  assert.ok(diagnostic, 'expected external reference diagnostic');
});

test('DocumentResolver enforces the configured max depth', () => {
  const { resolver } = buildResolver(
    {
      color: {
        level1: { $type: 'color', $ref: '#/color/level2' },
        level2: { $type: 'color', $ref: '#/color/level3' },
        level3: { $type: 'color', $ref: '#/color/level4' },
        level4: { $type: 'color', $value: 'deep' }
      }
    },
    { maxDepth: 2 }
  );

  const result = resolver.resolve('#/color/level1');

  assert.ok(result.token);
  assert.equal(result.token?.value, undefined, 'expected unresolved token when depth exceeded');
  const diagnostic = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED
  );
  assert.ok(diagnostic, 'expected max depth diagnostic');
  assert.equal(diagnostic?.severity, 'error');
});

test('DocumentResolver applies transform plugins to resolved tokens', () => {
  const transforms: ResolvedTokenTransformEntry[] = [
    {
      plugin: 'transform-plugin',
      transform: (token) => ({
        data: { pointer: token.pointer },
        diagnostics: [
          {
            code: DiagnosticCodes.core.NOT_IMPLEMENTED,
            message: 'transform executed',
            severity: 'info',
            pointer: token.pointer
          }
        ]
      })
    }
  ];

  const { resolver } = buildResolver(
    {
      token: { $type: 'color', $value: 'value' }
    },
    { transforms }
  );

  const result = resolver.resolve('#/token');

  assert.ok(result.token);
  assert.equal(result.transforms.length, 1);
  const evaluation = result.transforms[0];
  assert.equal(evaluation.plugin, 'transform-plugin');
  assert.equal(evaluation.pointer, '#/token');
  assert.deepEqual(evaluation.data, { pointer: '#/token' });
  assert.equal(evaluation.diagnostics.length, 1);

  const diagnostic = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.core.NOT_IMPLEMENTED
  );
  assert.ok(diagnostic, 'expected transform diagnostic to propagate');
});

function buildResolver(
  data: unknown,
  options?: Readonly<Record<string, unknown>> | DocumentResolverOptions
): { resolver: ReturnType<typeof createDocumentResolver> } {
  const document = createRawDocument(data);
  const normalised = normalizeDocument(document);
  assert.ok(normalised.ast, 'expected document to normalise successfully');
  assert.equal(normalised.diagnostics.length, 0, 'expected normaliser diagnostics to be empty');
  const graphResult = buildDocumentGraph(normalised.ast);
  assert.ok(graphResult.graph, 'expected document graph to be created');
  assert.equal(graphResult.diagnostics.length, 0, 'expected graph diagnostics to be empty');
  const resolverOptions = normalizeResolverOptions(options);
  const resolver = createDocumentResolver(graphResult.graph!, {
    ...resolverOptions,
    document
  });
  return { resolver };
}

function normalizeResolverOptions(
  options?: Readonly<Record<string, unknown>> | DocumentResolverOptions
): DocumentResolverOptions {
  if (!options) {
    return {};
  }

  if (
    'context' in options ||
    'maxDepth' in options ||
    'document' in options ||
    'transforms' in options
  ) {
    return options as DocumentResolverOptions;
  }

  return { context: options } as DocumentResolverOptions;
}

function createRawDocument(data: unknown): RawDocument {
  const text = JSON.stringify(data, null, 2);
  const uri = new URL('file:///document.json');
  return {
    uri,
    contentType: 'application/json',
    bytes: new TextEncoder().encode(text),
    text,
    data,
    sourceMap: { uri, pointers: new Map() }
  };
}
