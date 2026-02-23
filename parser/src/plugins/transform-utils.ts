import { DiagnosticCodes } from '../diagnostics/codes.js';
import type { DiagnosticEvent } from '../domain/models.js';
import type { JsonPointer } from '../domain/primitives.js';

const EMPTY_DIAGNOSTICS: readonly DiagnosticEvent[] = Object.freeze([]);

export function freezeResultDiagnostics(
  list?: readonly DiagnosticEvent[]
): readonly DiagnosticEvent[] {
  if (!list || list.length === 0) {
    return EMPTY_DIAGNOSTICS;
  }

  return Object.freeze(Array.from(list));
}

export function createTransformFailureDiagnostic(
  plugin: string,
  pointer: JsonPointer,
  error: unknown
): DiagnosticEvent {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: DiagnosticCodes.plugins.RESOLUTION_FAILED,
    message: `Plugin "${plugin}" failed to transform resolved token: ${message}`,
    severity: 'error',
    pointer
  } satisfies DiagnosticEvent;
}
