import type { JsonPointer, SourcePosition, SourceSpan } from '../types.js';
import type { DiagnosticEvent as Diagnostic } from '../domain/models.js';
import type { ResolutionResult, ResolvedToken } from '../resolver/index.js';
import type {
  DiagnosticsSummary,
  ResolutionSummary,
  SerializableAppliedOverride,
  SerializableDiagnostic,
  SerializablePosition,
  SerializableResolvedToken,
  SerializableResolutionSource,
  SerializableRelatedInformation,
  SerializableSpan,
  SerializableTraceStep
} from './types.js';

export function serializeResolution(
  pointer: JsonPointer,
  resolution: ResolutionResult
): ResolutionSummary {
  return {
    pointer,
    token: resolution.token ? serializeResolvedToken(resolution.token) : undefined,
    diagnostics: resolution.diagnostics.map(serializeDiagnostic)
  };
}

export function serializeResolvedToken(token: ResolvedToken): SerializableResolvedToken {
  return {
    pointer: token.pointer,
    uri: token.uri.href,
    type: token.type,
    value: token.value,
    source: token.source ? serializeResolutionSource(token.source) : undefined,
    overridesApplied: token.overridesApplied.map(serializeAppliedOverride),
    warnings: token.warnings.map(serializeDiagnostic),
    trace: token.trace.map(serializeTraceStep)
  };
}

export function serializeDiagnostic(diagnostic: Diagnostic): SerializableDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
    pointer: diagnostic.pointer,
    span: serializeSpan(diagnostic.span),
    related: diagnostic.related?.map(serializeRelatedInformation)
  };
}

export function createDiagnosticSummary(diagnostics: Iterable<Diagnostic>): DiagnosticsSummary {
  let error = 0;
  let warning = 0;
  let info = 0;
  let total = 0;

  for (const diagnostic of diagnostics) {
    total += 1;
    switch (diagnostic.severity) {
      case 'error':
        error += 1;
        break;
      case 'warning':
        warning += 1;
        break;
      case 'info':
        info += 1;
        break;
    }
  }

  return { total, error, warning, info };
}

export function serializeSpan(span?: SourceSpan): SerializableSpan | undefined {
  if (!span) {
    return undefined;
  }
  return {
    uri: span.uri.href,
    start: serializePosition(span.start),
    end: serializePosition(span.end)
  };
}

export function formatSpan(span: SerializableSpan): string {
  const startLine = span.start.line.toString();
  const startColumn = span.start.column.toString();
  const start = `${startLine}:${startColumn}`;
  const endLine = span.end.line.toString();
  const endColumn = span.end.column.toString();
  const end = `${endLine}:${endColumn}`;
  if (start === end) {
    return `${span.uri} @ ${start}`;
  }
  return `${span.uri} @ ${start}-${end}`;
}

function serializeResolutionSource(
  source: NonNullable<ResolvedToken['source']>
): SerializableResolutionSource {
  return {
    uri: source.uri.href,
    pointer: source.pointer,
    span: serializeSpan(source.span)
  };
}

function serializeAppliedOverride(
  override: ResolvedToken['overridesApplied'][number]
): SerializableAppliedOverride {
  return {
    pointer: override.pointer,
    kind: override.kind,
    depth: override.depth,
    span: serializeSpan(override.span),
    source: override.source ? serializeResolutionSource(override.source) : undefined
  };
}

function serializeTraceStep(step: ResolvedToken['trace'][number]): SerializableTraceStep {
  return {
    pointer: step.pointer,
    kind: step.kind,
    span: serializeSpan(step.span)
  };
}

function serializeRelatedInformation(
  info: NonNullable<Diagnostic['related']>[number]
): SerializableRelatedInformation {
  return {
    message: info.message,
    pointer: info.pointer,
    span: serializeSpan(info.span)
  };
}

function serializePosition(position: SourcePosition): SerializablePosition {
  return {
    offset: position.offset,
    line: position.line,
    column: position.column
  };
}
