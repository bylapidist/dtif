import test from 'node:test';
import assert from 'node:assert/strict';

import { domain } from '../../src/index.js';

void test('domain models: creates diagnostic events with optional related information', () => {
  const related: domain.DiagnosticEventRelatedInformation = {
    message: 'See parent document'
  };

  const event: domain.DiagnosticEvent = {
    code: 'example/code',
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
        code: 'pipeline/check',
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
