import assert from 'node:assert/strict';
import test from 'node:test';

import { createDiagnosticSummary } from '../../src/cli/serialize.js';
import type { DiagnosticEvent } from '../../src/domain/models.js';

void test('createDiagnosticSummary counts severities from iterables', () => {
  const diagnostics: DiagnosticEvent[] = [
    { code: 'DTIF0000', message: 'failure', severity: 'error' },
    { code: 'DTIF0001', message: 'heads up', severity: 'warning' },
    { code: 'DTIF0002', message: 'info', severity: 'info' }
  ];

  const summary = createDiagnosticSummary(diagnostics);

  assert.deepEqual(summary, {
    total: 3,
    error: 1,
    warning: 1,
    info: 1
  });
});

void test('createDiagnosticSummary handles empty iterables', () => {
  const summary = createDiagnosticSummary([]);

  assert.deepEqual(summary, {
    total: 0,
    error: 0,
    warning: 0,
    info: 0
  });
});
