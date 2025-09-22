import type { JsonPointer } from '../types.js';

export const JSON_POINTER_ROOT: JsonPointer = '#';

const ABSOLUTE_POINTER_PATTERN = /^#(?:$|(?:\/(?:[^~]|~0|~1)*)*)$/u;

export function normalizeJsonPointer(pointer: string): JsonPointer {
  if (pointer === '' || pointer === JSON_POINTER_ROOT) {
    return JSON_POINTER_ROOT;
  }

  if (pointer.startsWith('#/')) {
    return `#${pointer.slice(1)}` as JsonPointer;
  }

  if (pointer.startsWith('#')) {
    const remainder = pointer.slice(1);
    if (remainder.length === 0) {
      return JSON_POINTER_ROOT;
    }
    if (remainder.startsWith('/')) {
      return `#${remainder}` as JsonPointer;
    }
    return `#/${remainder}` as JsonPointer;
  }

  if (pointer.startsWith('/')) {
    return `#${pointer}` as JsonPointer;
  }

  return `#/${pointer}` as JsonPointer;
}

export function isJsonPointer(value: unknown): value is JsonPointer {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = normalizeJsonPointer(value);
  return ABSOLUTE_POINTER_PATTERN.test(normalized);
}

export function encodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function decodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

export function splitJsonPointer(pointer: JsonPointer): string[] {
  const normalized = normalizeJsonPointer(pointer);

  if (normalized === JSON_POINTER_ROOT) {
    return [];
  }

  const withoutPrefix = normalized.startsWith('#/') ? normalized.slice(2) : normalized.slice(1);

  if (withoutPrefix === '') {
    return [''];
  }

  return withoutPrefix.split('/').map(decodeJsonPointerSegment);
}

export function joinJsonPointer(segments: Iterable<string>): JsonPointer {
  return buildPointerFromSegments(segments);
}

export function appendJsonPointer(base: JsonPointer, ...segments: string[]): JsonPointer {
  if (segments.length === 0) {
    return normalizeJsonPointer(base);
  }

  const baseSegments = splitJsonPointer(base);
  return buildPointerFromSegments([...baseSegments, ...segments]);
}

export function parentJsonPointer(pointer: JsonPointer): JsonPointer | undefined {
  const segments = splitJsonPointer(pointer);
  if (segments.length === 0) {
    return undefined;
  }
  segments.pop();
  return buildPointerFromSegments(segments);
}

export function jsonPointerStartsWith(pointer: JsonPointer, prefix: JsonPointer): boolean {
  const pointerSegments = splitJsonPointer(pointer);
  const prefixSegments = splitJsonPointer(prefix);

  if (prefixSegments.length > pointerSegments.length) {
    return false;
  }

  return prefixSegments.every((segment, index) => segment === pointerSegments[index]);
}

export function tailJsonPointer(pointer: JsonPointer): string | undefined {
  const segments = splitJsonPointer(pointer);
  return segments.at(-1);
}

function buildPointerFromSegments(segments: Iterable<string>): JsonPointer {
  const encoded: string[] = [];
  for (const segment of segments) {
    encoded.push(encodeJsonPointerSegment(String(segment)));
  }

  if (encoded.length === 0) {
    return JSON_POINTER_ROOT;
  }

  return `#/${encoded.join('/')}` as JsonPointer;
}
