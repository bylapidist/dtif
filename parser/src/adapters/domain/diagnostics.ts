import type {
  DiagnosticEvent,
  DiagnosticEventRelatedInformation,
  PipelineDiagnostics
} from '../../domain/models.js';

export const EMPTY_PIPELINE_DIAGNOSTICS: PipelineDiagnostics = Object.freeze({
  events: Object.freeze([])
});

export function toPipelineDiagnostics(
  diagnostics: readonly DiagnosticEvent[]
): PipelineDiagnostics {
  if (diagnostics.length === 0) {
    return EMPTY_PIPELINE_DIAGNOSTICS;
  }

  return {
    events: Object.freeze(diagnostics.map(freezeDiagnosticEvent))
  } satisfies PipelineDiagnostics;
}

export const toDomainDiagnostic = freezeDiagnosticEvent;

function freezeRelated(
  related: readonly DiagnosticEventRelatedInformation[]
): readonly DiagnosticEventRelatedInformation[] {
  if (related.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(
    related.map((info) =>
      Object.freeze({
        message: info.message,
        pointer: info.pointer,
        span: info.span
      })
    )
  );
}

function freezeDiagnosticEvent(diagnostic: DiagnosticEvent): DiagnosticEvent {
  const related = diagnostic.related ? freezeRelated(diagnostic.related) : undefined;

  return Object.freeze({
    ...diagnostic,
    related
  });
}
