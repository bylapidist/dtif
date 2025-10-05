import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DiagnosticDomain,
  formatDiagnosticCode,
  isDiagnosticCode
} from '../../src/diagnostics/codes.js';
import {
  DIAGNOSTIC_SEVERITIES,
  compareDiagnosticSeverity,
  isDiagnosticSeverity,
  maxDiagnosticSeverity,
  minDiagnosticSeverity,
  severityWeight
} from '../../src/diagnostics/severity.js';
void test('compareDiagnosticSeverity reflects repository ordering', () => {
  const sorted = [...DIAGNOSTIC_SEVERITIES].sort(compareDiagnosticSeverity);
  assert.deepEqual(sorted, ['error', 'warning', 'info']);
  assert.equal(severityWeight('error') < severityWeight('warning'), true);
  assert.equal(severityWeight('warning') < severityWeight('info'), true);
});

void test('maxDiagnosticSeverity and minDiagnosticSeverity choose extremes', () => {
  assert.equal(maxDiagnosticSeverity('info', 'warning', 'error'), 'error');
  assert.equal(minDiagnosticSeverity('info', 'warning', 'error'), 'info');
  assert.equal(maxDiagnosticSeverity(), undefined);
  assert.equal(minDiagnosticSeverity(), undefined);
});

void test('isDiagnosticSeverity validates allowed severities', () => {
  assert.equal(isDiagnosticSeverity('error'), true);
  assert.equal(isDiagnosticSeverity('fatal'), false);
});

void test('diagnostic code helpers format deterministic identifiers', () => {
  assert.equal(formatDiagnosticCode('Core', 1, 0), 'DTIF0010');
  assert.equal(formatDiagnosticCode(DiagnosticDomain.Resolver, 1, 0), 'DTIF1010');
  assert.equal(isDiagnosticCode('DTIF1010'), true);
  assert.equal(isDiagnosticCode('ERR42'), false);
});
