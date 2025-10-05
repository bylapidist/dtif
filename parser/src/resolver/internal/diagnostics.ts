import type { DiagnosticEvent } from '../../domain/models.js';
import { EMPTY_DIAGNOSTICS } from './constants.js';

export interface DiagnosticCollector {
  add(diagnostic: DiagnosticEvent): void;
  addMany(diagnostics: Iterable<DiagnosticEvent>): void;
  toArray(): readonly DiagnosticEvent[];
}

export function createDiagnosticCollector(): DiagnosticCollector {
  const events: DiagnosticEvent[] = [];

  return {
    add(diagnostic) {
      events.push(diagnostic);
    },
    addMany(diagnostics) {
      for (const diagnostic of diagnostics) {
        events.push(diagnostic);
      }
    },
    toArray() {
      if (events.length === 0) {
        return EMPTY_DIAGNOSTICS;
      }

      return Object.freeze(events.slice());
    }
  } satisfies DiagnosticCollector;
}
