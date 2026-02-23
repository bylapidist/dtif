import assert from 'node:assert/strict';
import test from 'node:test';

import { createSourcePosition, createSourceSpan } from '../../../src/utils/source.js';
import { formatDiagnostic } from '../../../src/diagnostics/format.js';
import { formatDiagnosticCode } from '../../../src/diagnostics/codes.js';
import type { DiagnosticEvent } from '../../../src/domain/models.js';

const DOCUMENT_URI = new URL('file:///tokens.json');
const POINTER = '#/color/background';
const MISSING_VALUE_CODE = formatDiagnosticCode('Normaliser', 2, 0);
const TARGET_MISMATCH_CODE = formatDiagnosticCode('Resolver', 2, 1);
const FAILURE_CODE = formatDiagnosticCode('Core', 0, 0);

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
    code: MISSING_VALUE_CODE,
    message: 'Token is missing a $value property.',
    severity: 'error',
    pointer: POINTER,
    span
  };

  const formatted = formatDiagnostic(diagnostic, { cwd: '/workspace' });

  assert.match(
    formatted,
    new RegExp(`ERROR ${MISSING_VALUE_CODE}: Token is missing a \\\\$value property\\\\.`)
  );
  assert.match(formatted, /tokens.json:1:1/);
});

void test('formatDiagnostic falls back to pointers when spans are not available', () => {
  const diagnostic: DiagnosticEvent = {
    code: TARGET_MISMATCH_CODE,
    message: 'Alias type does not match resolved token type.',
    severity: 'warning',
    pointer: POINTER
  };

  const formatted = formatDiagnostic(diagnostic);

  assert.match(
    formatted,
    new RegExp(
      `WARNING ${TARGET_MISMATCH_CODE}: Alias type does not match resolved token type\\\\.`
    )
  );
  assert.match(formatted, /at #\/color\/background/);
});

void test('formatDiagnostic applies ANSI colors when enabled', () => {
  const span = createSpan();
  const diagnostic: DiagnosticEvent = {
    code: FAILURE_CODE,
    message: 'Example failure',
    severity: 'error',
    pointer: POINTER,
    span
  };

  const formatted = formatDiagnostic(diagnostic, { color: true });

  assert.match(formatted, /\u001b\[31mERROR/);
});
