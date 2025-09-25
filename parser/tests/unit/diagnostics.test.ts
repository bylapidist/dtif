import assert from 'node:assert/strict';
import test from 'node:test';

import { DiagnosticBag } from '../../src/diagnostics/bag.js';
import {
  DiagnosticCodes,
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
import type { Diagnostic } from '../../src/types.js';

void test('DiagnosticBag collects and tracks severity counts', () => {
  const bag = new DiagnosticBag();

  const error: Diagnostic = {
    code: DiagnosticCodes.core.NOT_IMPLEMENTED,
    message: 'not implemented',
    severity: 'error'
  };
  const warning: Diagnostic = {
    code: DiagnosticCodes.core.NOT_IMPLEMENTED,
    message: 'be careful',
    severity: 'warning'
  };

  bag.add(error);
  bag.add(warning);

  assert.equal(bag.size, 2);
  assert.equal(bag.errorCount, 1);
  assert.equal(bag.warningCount, 1);
  assert.equal(bag.infoCount, 0);
  assert.equal(bag.count(), 2);
  assert.equal(bag.count('warning'), 1);
  assert.ok(bag.hasSeverity('error'));
  assert.ok(bag.hasErrors());
  assert.equal(bag.highestSeverity(), 'error');

  const arr = bag.toArray();
  assert.deepEqual(
    arr.map((item) => item.message),
    ['not implemented', 'be careful']
  );
  assert.notStrictEqual(arr, bag.toArray());
});

void test('DiagnosticBag can be constructed from iterables and extended', () => {
  const initial: Diagnostic[] = [
    {
      code: DiagnosticCodes.core.NOT_IMPLEMENTED,
      message: 'first',
      severity: 'info'
    },
    {
      code: DiagnosticCodes.core.NOT_IMPLEMENTED,
      message: 'second',
      severity: 'warning'
    }
  ];
  const bag = new DiagnosticBag(initial);
  const other = new DiagnosticBag();
  other.add({
    code: DiagnosticCodes.loader.FAILED,
    message: 'loader failed',
    severity: 'error'
  });

  bag.extend(other);

  assert.equal(bag.size, 3);
  assert.equal(bag.highestSeverity(), 'error');
  assert.ok(bag.hasSeverity('info'));
});

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
