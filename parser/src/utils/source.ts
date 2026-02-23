import type { SourcePosition, SourceSpan } from '../domain/primitives.js';

export const ZERO_SOURCE_POSITION: SourcePosition = Object.freeze({
  offset: 0,
  line: 1,
  column: 1
});

export function createSourcePosition(offset: number, line: number, column: number): SourcePosition {
  return Object.freeze({
    offset: normalizeOffset(offset),
    line: normalizeLine(line),
    column: normalizeColumn(column)
  });
}

export function cloneSourcePosition(position: SourcePosition): SourcePosition {
  return createSourcePosition(position.offset, position.line, position.column);
}

export function compareSourcePositions(a: SourcePosition, b: SourcePosition): number {
  if (a.offset !== b.offset) {
    return a.offset - b.offset;
  }
  if (a.line !== b.line) {
    return a.line - b.line;
  }
  if (a.column !== b.column) {
    return a.column - b.column;
  }
  return 0;
}

export function minSourcePosition(
  ...positions: readonly SourcePosition[]
): SourcePosition | undefined {
  if (positions.length === 0) {
    return undefined;
  }
  return positions.reduce((min, current) =>
    compareSourcePositions(current, min) < 0 ? current : min
  );
}

export function maxSourcePosition(
  ...positions: readonly SourcePosition[]
): SourcePosition | undefined {
  if (positions.length === 0) {
    return undefined;
  }
  return positions.reduce((max, current) =>
    compareSourcePositions(current, max) > 0 ? current : max
  );
}

export function createSourceSpan(uri: URL, start: SourcePosition, end: SourcePosition): SourceSpan {
  const [normalizedStart, normalizedEnd] = orderSpanEndpoints(start, end);
  return Object.freeze({
    uri,
    start: normalizedStart,
    end: normalizedEnd
  });
}

export function cloneSourceSpan(span: SourceSpan): SourceSpan {
  return createSourceSpan(span.uri, span.start, span.end);
}

export function spanLength(span: SourceSpan): number {
  return Math.max(0, span.end.offset - span.start.offset);
}

export function spanContainsPosition(span: SourceSpan, position: SourcePosition): boolean {
  return (
    compareSourcePositions(position, span.start) >= 0 &&
    compareSourcePositions(position, span.end) <= 0
  );
}

export function spansOverlap(a: SourceSpan, b: SourceSpan): boolean {
  if (a.uri.href !== b.uri.href) {
    return false;
  }
  return compareSourcePositions(a.start, b.end) <= 0 && compareSourcePositions(a.end, b.start) >= 0;
}

export function unionSourceSpans(spans: Iterable<SourceSpan>): SourceSpan | undefined {
  let result: SourceSpan | undefined;
  for (const span of spans) {
    if (!result) {
      result = span;
      continue;
    }
    if (span.uri.href !== result.uri.href) {
      throw new Error('Cannot union spans from different documents.');
    }
    const start = compareSourcePositions(span.start, result.start) < 0 ? span.start : result.start;
    const end = compareSourcePositions(span.end, result.end) > 0 ? span.end : result.end;
    result = createSourceSpan(result.uri, start, end);
  }
  return result;
}

export function translateSourceSpan(
  span: SourceSpan,
  delta: { offset?: number; line?: number; column?: number }
): SourceSpan {
  const offsetDelta = toInteger(delta.offset ?? 0);
  const lineDelta = toInteger(delta.line ?? 0);
  const columnDelta = toInteger(delta.column ?? 0);

  const newStart = createSourcePosition(
    span.start.offset + offsetDelta,
    Math.max(1, span.start.line + lineDelta),
    Math.max(1, span.start.column + columnDelta)
  );

  const newEnd = createSourcePosition(
    span.end.offset + offsetDelta,
    Math.max(1, span.end.line + lineDelta),
    Math.max(1, span.end.column + columnDelta)
  );

  return createSourceSpan(span.uri, newStart, newEnd);
}

export function isSourceSpan(value: unknown): value is SourceSpan {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (!('uri' in value) || !(value.uri instanceof URL)) {
    return false;
  }

  if (!('start' in value) || !isSourcePosition(value.start)) {
    return false;
  }

  if (!('end' in value) || !isSourcePosition(value.end)) {
    return false;
  }

  return true;
}

export function isSourcePosition(value: unknown): value is SourcePosition {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (!('offset' in value) || typeof value.offset !== 'number') {
    return false;
  }

  if (!('line' in value) || typeof value.line !== 'number') {
    return false;
  }

  if (!('column' in value) || typeof value.column !== 'number') {
    return false;
  }

  return true;
}

function orderSpanEndpoints(
  start: SourcePosition,
  end: SourcePosition
): [SourcePosition, SourcePosition] {
  if (compareSourcePositions(start, end) <= 0) {
    return [start, end];
  }
  return [end, start];
}

function normalizeOffset(offset: number): number {
  return Math.max(0, toInteger(offset));
}

function normalizeLine(line: number): number {
  return Math.max(1, toInteger(line));
}

function normalizeColumn(column: number): number {
  return Math.max(1, toInteger(column));
}

function toInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}
