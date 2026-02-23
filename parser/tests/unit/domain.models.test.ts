import test from 'node:test';
import assert from 'node:assert/strict';

import { domain } from '../../src/index.js';
import { formatDiagnosticCode } from '../../src/diagnostics/codes.js';

void test('domain models: creates diagnostic events with optional related information', () => {
  const related: domain.DiagnosticEventRelatedInformation = {
    message: 'See parent document'
  };

  const event: domain.DiagnosticEvent = {
    code: formatDiagnosticCode('Core', 9, 9),
    message: 'Example message',
    severity: 'warning',
    related: [related]
  };

  assert.equal(event.related?.[0], related);
});

void test('domain models: allows pipeline results to surface diagnostics', () => {
  const diagnostics: domain.PipelineDiagnostics = {
    events: [
      {
        code: formatDiagnosticCode('Core', 8, 8),
        message: 'ok',
        severity: 'info'
      }
    ]
  };

  const result: domain.PipelineResult<number> = {
    outcome: 42,
    diagnostics
  };

  assert.equal(result.outcome, 42);
  assert.equal(result.diagnostics.events.length, 1);
});
