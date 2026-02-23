import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocumentGraph } from '../../src/graph/builder.js';
import { normalizeDocument } from '../../src/ast/normaliser.js';
import { createDocumentResolver, type DocumentResolverOptions } from '../../src/resolver/index.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import type { DecodedDocument } from '../../src/types.js';
import type { ResolvedTokenTransformEntry } from '../../src/plugins/index.js';

void test('DocumentResolver resolves inline token values', () => {
  const { resolver } = buildResolver({
    color: {
      primary: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
      }
    }
  });

  const result = resolver.resolve('#/color/primary');

  const { token } = result;
  assert.ok(token, 'expected token to resolve');
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0, 0, 0, 1] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver resolves alias chains', () => {
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

  const { token } = result;
  assert.ok(token, 'expected alias to resolve');
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [1, 1, 1, 1] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver applies overrides when context matches', () => {
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
        dark: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.1, 0.1, 0.1] } },
        light: {
          $type: 'color',
          $value: { colorSpace: 'srgb', components: [0.95, 0.95, 0.95] }
        }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');

  const { token } = result;
  assert.ok(token, 'expected override to produce a token');
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.1, 0.1, 0.1] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver ignores overrides when context does not match', () => {
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
      dark: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.2, 0.2, 0.2] } },
      light: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.9, 0.9, 0.9] } }
    }
  });

  const result = resolver.resolve('#/button/bg');

  const { token } = result;
  assert.ok(token);
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.9, 0.9, 0.9] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver ignores unrecognised override $when keys', () => {
  const { resolver } = buildResolver(
    {
      $overrides: [
        {
          $token: '#/button/bg',
          $when: { theme: 'dark', 'unknown-context': 'ignored' },
          $ref: '#/color/dark'
        }
      ],
      button: {
        bg: { $type: 'color', $ref: '#/color/light' }
      },
      color: {
        dark: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.2, 0.2, 0.2] } },
        light: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.9, 0.9, 0.9] } }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');

  const { token } = result;
  assert.ok(token);
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.2, 0.2, 0.2] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver prefers the last matching override', () => {
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
          $value: { colorSpace: 'srgb', components: [0.4, 0.4, 0.4] }
        }
      ],
      button: {
        bg: { $type: 'color', $ref: '#/color/light' }
      },
      color: {
        dark: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.2, 0.2, 0.2] } },
        light: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.9, 0.9, 0.9] } }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');

  const { token } = result;
  assert.ok(token);
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.4, 0.4, 0.4] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver uses fallback chains to resolve values', () => {
  const { resolver } = buildResolver(
    {
      $overrides: [
        {
          $token: '#/button/bg',
          $when: { theme: 'dark' },
          $fallback: [
            { $ref: '#/color/dark' },
            { $value: { colorSpace: 'srgb', components: [0.5, 0.5, 0.5] } }
          ]
        }
      ],
      button: {
        bg: { $type: 'color', $ref: '#/color/light' }
      },
      color: {
        dark: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.2, 0.2, 0.2] } },
        light: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.9, 0.9, 0.9] } }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');

  const { token } = result;
  assert.ok(token);
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.2, 0.2, 0.2] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver rejects inline override values that violate the target type', () => {
  const { resolver } = buildResolver(
    {
      $overrides: [
        {
          $token: '#/button/bg',
          $when: { theme: 'dark' },
          $value: { dimensionType: 'length', value: 8, unit: 'px' }
        }
      ],
      button: {
        bg: { $type: 'color', $ref: '#/color/light' }
      },
      color: {
        light: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.9, 0.9, 0.9] } }
      }
    },
    { theme: 'dark' }
  );

  const result = resolver.resolve('#/button/bg');
  const mismatch = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH
  );

  assert.ok(mismatch, 'expected type mismatch diagnostic');
  assert.equal(mismatch.pointer, '#/$overrides/0/$value');
  assert.deepEqual(result.token?.value, { colorSpace: 'srgb', components: [0.9, 0.9, 0.9] });
});

void test('DocumentResolver reports cycles for recursive aliases', () => {
  const { resolver } = buildResolver({
    color: {
      cyclic: { $type: 'color', $ref: '#/color/cyclic' }
    }
  });

  const result = resolver.resolve('#/color/cyclic');

  const { token } = result;
  assert.ok(token);
  assert.equal(token.value, undefined);
  const diagnostic = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.resolver.CYCLE_DETECTED
  );
  assert.ok(diagnostic, 'expected cycle diagnostic');
});

void test('DocumentResolver resolves external references when graph is provided', () => {
  const external = buildGraph(
    {
      color: {
        primary: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.2, 0.4, 0.6, 1] } }
      }
    },
    'https://example.com/tokens.json'
  );
  const { resolver } = buildResolver(
    {
      color: {
        external: { $type: 'color', $ref: 'https://example.com/tokens.json#/color/primary' }
      }
    },
    {
      allowNetworkReferences: true,
      externalGraphs: new Map([[external.uri.href, external]])
    }
  );

  const result = resolver.resolve('#/color/external');

  const { token } = result;
  assert.ok(token);
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.2, 0.4, 0.6, 1] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver applies overrides targeting external tokens', () => {
  const external = buildGraph(
    {
      color: {
        primary: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.2, 0.4, 0.6, 1] } }
      }
    },
    'https://example.com/tokens.json'
  );
  const { resolver } = buildResolver(
    {
      $overrides: [
        {
          $token: 'https://example.com/tokens.json#/color/primary',
          $when: { theme: 'dark' },
          $value: { colorSpace: 'srgb', components: [0.05, 0.05, 0.05, 1] }
        }
      ],
      color: {
        external: { $type: 'color', $ref: 'https://example.com/tokens.json#/color/primary' }
      }
    },
    {
      context: { theme: 'dark' },
      allowNetworkReferences: true,
      externalGraphs: new Map([[external.uri.href, external]])
    }
  );

  const result = resolver.resolve('#/color/external');

  const { token } = result;
  assert.ok(token);
  assert.deepEqual(token.value, { colorSpace: 'srgb', components: [0.05, 0.05, 0.05, 1] });
  assert.equal(result.diagnostics.length, 0);
});

void test('DocumentResolver rejects network references without explicit opt-in', () => {
  const external = buildGraph(
    {
      color: {
        primary: { $type: 'color', $value: { colorSpace: 'srgb', components: [0.2, 0.4, 0.6, 1] } }
      }
    },
    'https://example.com/tokens.json'
  );
  const { resolver } = buildResolver(
    {
      color: {
        external: { $type: 'color', $ref: 'https://example.com/tokens.json#/color/primary' }
      }
    },
    {
      allowNetworkReferences: false,
      externalGraphs: new Map([[external.uri.href, external]])
    }
  );

  const result = resolver.resolve('#/color/external');

  const { token } = result;
  assert.ok(token);
  assert.equal(token.value, undefined);
  const diagnostic = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.resolver.EXTERNAL_REFERENCE
  );
  assert.ok(diagnostic, 'expected external reference diagnostic');
});

void test('DocumentResolver enforces the configured max depth', () => {
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

  const { token } = result;
  assert.ok(token);
  assert.equal(token.value, undefined, 'expected unresolved token when depth exceeded');
  const diagnostic = result.diagnostics.find(
    (entry) => entry.code === DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED
  );
  assert.ok(diagnostic, 'expected max depth diagnostic');
  assert.equal(diagnostic.severity, 'error');
});

void test('DocumentResolver applies transform plugins to resolved tokens', () => {
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

  const { token } = result;
  assert.ok(token);
  const transformsResult = result.transforms;
  assert.equal(transformsResult.length, 1);
  const [evaluation] = transformsResult;
  assert.ok(evaluation);
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
  const document = createDecodedDocument(data);
  const normalised = normalizeDocument(document);
  const { ast } = normalised;
  assert.ok(ast, 'expected document to normalise successfully');
  assert.equal(normalised.diagnostics.length, 0, 'expected normaliser diagnostics to be empty');
  const graphResult = buildDocumentGraph(ast);
  const { graph } = graphResult;
  assert.ok(graph, 'expected document graph to be created');
  assert.equal(graphResult.diagnostics.length, 0, 'expected graph diagnostics to be empty');
  const resolverOptions = normalizeResolverOptions(options);
  const resolver = createDocumentResolver(graph, {
    ...resolverOptions,
    document
  });
  return { resolver };
}

function isDocumentResolverOptions(options: unknown): options is DocumentResolverOptions {
  return (
    typeof options === 'object' &&
    options !== null &&
    ('context' in options ||
      'maxDepth' in options ||
      'document' in options ||
      'transforms' in options ||
      'externalGraphs' in options ||
      'allowNetworkReferences' in options)
  );
}

function normalizeResolverOptions(
  options?: Readonly<Record<string, unknown>> | DocumentResolverOptions
): DocumentResolverOptions {
  if (!options) {
    return {};
  }

  if (isDocumentResolverOptions(options)) {
    return options;
  }

  const resolverOptions: DocumentResolverOptions = { context: options };
  return resolverOptions;
}

function createDecodedDocument(data: unknown, uriText = 'file:///document.json'): DecodedDocument {
  const text = JSON.stringify(data, null, 2);
  const uri = new URL(uriText);
  return {
    identity: Object.freeze({ uri, contentType: 'application/json' as const }),
    bytes: new TextEncoder().encode(text),
    text,
    data,
    sourceMap: { uri, pointers: new Map() }
  };
}

function buildGraph(data: unknown, uri: string): ReturnType<typeof buildDocumentGraph>['graph'] {
  const decoded = createDecodedDocument(data, uri);
  const normalized = normalizeDocument(decoded);
  const { ast } = normalized;
  assert.ok(ast, 'expected external document to normalise successfully');
  assert.equal(normalized.diagnostics.length, 0, 'expected normaliser diagnostics to be empty');
  const graphResult = buildDocumentGraph(ast);
  const { graph } = graphResult;
  assert.ok(graph, 'expected external graph to be created');
  assert.equal(graphResult.diagnostics.length, 0, 'expected graph diagnostics to be empty');
  return graph;
}
