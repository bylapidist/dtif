import type { DiagnosticCode } from '../../src/diagnostics/codes.js';
import type { DiagnosticEvent } from '../../src/domain/models.js';

export function hasErrors(events: readonly DiagnosticEvent[]): boolean {
  return events.some((event) => event.severity === 'error');
}

export function countErrors(events: readonly DiagnosticEvent[]): number {
  return events.filter((event) => event.severity === 'error').length;
}

export function findDiagnostic(
  events: readonly DiagnosticEvent[],
  code: DiagnosticCode
): DiagnosticEvent | undefined {
  return events.find((event) => event.code === code);
}
