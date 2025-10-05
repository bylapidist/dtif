import assert from 'node:assert/strict';
import test from 'node:test';

import { createSourcePosition, createSourceSpan } from '../../../src/utils/source.js';
import { formatDiagnostic } from '../../../src/diagnostics/format.js';
import type { DiagnosticEvent } from '../../../src/domain/models.js';

const DOCUMENT_URI = new URL('file:///tokens.json');
const POINTER = '#/color/background';

function createSpan() {
  return createSourceSpan(
    DOCUMENT_URI,
    createSourcePosition(0, 1, 1),
    createSourcePosition(12, 1, 13)
  );
}

void test('formatDiagnostic renders source locations when spans exist', () => {
  const span = createSpan();
  const diagnostic: DiagnosticEvent = {
    code: 'parser.missingValue',
    message: 'Token is missing a $value property.',
    severity: 'error',
    pointer: POINTER,
    span
  };

  const formatted = formatDiagnostic(diagnostic, { cwd: '/workspace' });

  assert.match(formatted, /ERROR parser.missingValue: Token is missing a \$value property\./);
  assert.match(formatted, /tokens.json:1:1/);
});

void test('formatDiagnostic falls back to pointers when spans are not available', () => {
  const diagnostic: DiagnosticEvent = {
    code: 'resolver.targetMismatch',
    message: 'Alias type does not match resolved token type.',
    severity: 'warning',
    pointer: POINTER
  };

  const formatted = formatDiagnostic(diagnostic);

  assert.match(
    formatted,
    /WARNING resolver.targetMismatch: Alias type does not match resolved token type\./
  );
  assert.match(formatted, /at #\/color\/background/);
});

void test('formatDiagnostic applies ANSI colors when enabled', () => {
  const span = createSpan();
  const diagnostic: DiagnosticEvent = {
    code: 'parser.failure',
    message: 'Example failure',
    severity: 'error',
    pointer: POINTER,
    span
  };

  const formatted = formatDiagnostic(diagnostic, { color: true });

  assert.match(formatted, /\u001b\[31mERROR/);
});
