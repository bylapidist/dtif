import assert from 'node:assert/strict';
import test from 'node:test';

import { createSourcePosition, createSourceSpan } from '../../../src/utils/source.js';
import { toTokenDiagnostic, formatTokenDiagnostic } from '../../../src/tokens/diagnostics.js';
import type { Diagnostic } from '../../../src/types.js';

const DOCUMENT_URI = new URL('file:///tokens.json');
const POINTER = '#/color/background';

function createSpan() {
  return createSourceSpan(
    DOCUMENT_URI,
    createSourcePosition(0, 1, 1),
    createSourcePosition(12, 1, 13)
  );
}

void test('toTokenDiagnostic maps pointer spans when no explicit span is provided', () => {
  const span = createSpan();
  const diagnostic: Diagnostic = {
    code: 'parser.missingValue',
    message: 'Token is missing a $value property.',
    severity: 'error',
    pointer: POINTER
  };

  const result = toTokenDiagnostic(diagnostic, {
    documentUri: DOCUMENT_URI.href,
    pointerSpans: new Map([[POINTER, span]])
  });

  assert.equal(result.source, 'dtif-parser');
  assert.equal(result.code, 'parser.missingValue');
  assert.equal(result.target.uri, DOCUMENT_URI.href);
  assert.deepEqual(result.target.range, {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 12 }
  });
});

void test('toTokenDiagnostic maps related information entries', () => {
  const span = createSpan();
  const relatedSpan = createSourceSpan(
    DOCUMENT_URI,
    createSourcePosition(20, 2, 3),
    createSourcePosition(25, 2, 8)
  );
  const diagnostic: Diagnostic = {
    code: 'resolver.targetMismatch',
    message: 'Alias type does not match resolved token type.',
    severity: 'warning',
    pointer: POINTER,
    related: [
      {
        message: 'Target token resolved here.',
        pointer: '#/color/base'
      },
      {
        message: 'Alias declared here.',
        span: relatedSpan
      }
    ]
  };

  const result = toTokenDiagnostic(diagnostic, {
    documentUri: DOCUMENT_URI.href,
    pointerSpans: new Map([
      [POINTER, span],
      ['#/color/base', span]
    ])
  });

  assert.ok(result.related);
  const related = result.related;
  assert.equal(related.length, 2);
  const [first, second] = related;
  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(first.target.range.start, { line: 0, character: 0 });
  assert.deepEqual(second.target.range.start, { line: 1, character: 2 });
});

void test('formatTokenDiagnostic renders human readable output', () => {
  const span = createSpan();
  const diagnostic = toTokenDiagnostic(
    {
      code: 'parser.example',
      message: 'Example message',
      severity: 'info',
      pointer: POINTER
    },
    {
      documentUri: DOCUMENT_URI.href,
      pointerSpans: new Map([[POINTER, span]])
    }
  );

  const formatted = formatTokenDiagnostic(diagnostic, { cwd: '/workspace' });

  assert.match(formatted, /INFO parser.example: Example message/);
  assert.match(formatted, /tokens.json:1:1/);
});

void test('formatTokenDiagnostic applies ANSI colors when enabled', () => {
  const span = createSpan();
  const diagnostic = toTokenDiagnostic(
    {
      code: 'parser.failure',
      message: 'Example failure',
      severity: 'error',
      pointer: POINTER
    },
    {
      documentUri: DOCUMENT_URI.href,
      pointerSpans: new Map([[POINTER, span]])
    }
  );

  const formatted = formatTokenDiagnostic(diagnostic, { color: true });

  assert.match(formatted, /\u001b\[31mERROR/);
});
