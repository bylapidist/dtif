import { JSON_POINTER_ROOT, appendJsonPointer } from '../../utils/json-pointer.js';
import { createSourceSpan, ZERO_SOURCE_POSITION } from '../../utils/source.js';
import type { JsonPointer, SourceMap, SourceSpan } from '../../types.js';

export function createSyntheticSourceMap(uri: URL, value: unknown): SourceMap {
  const pointers = new Map<JsonPointer, SourceSpan>();
  const span = createSourceSpan(uri, ZERO_SOURCE_POSITION, ZERO_SOURCE_POSITION);
  pointers.set(JSON_POINTER_ROOT, span);
  populatePointers(value, JSON_POINTER_ROOT, pointers, uri);
  return Object.freeze({ uri, pointers });
}

function populatePointers(
  value: unknown,
  pointer: JsonPointer,
  pointers: Map<JsonPointer, SourceSpan>,
  uri: URL
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const childPointer = appendJsonPointer(pointer, String(index));
      pointers.set(childPointer, createSourceSpan(uri, ZERO_SOURCE_POSITION, ZERO_SOURCE_POSITION));
      populatePointers(item, childPointer, pointers, uri);
    });
    return;
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, childValue] of entries) {
      const childPointer = appendJsonPointer(pointer, key);
      pointers.set(childPointer, createSourceSpan(uri, ZERO_SOURCE_POSITION, ZERO_SOURCE_POSITION));
      populatePointers(childValue, childPointer, pointers, uri);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null) {
    return false;
  }
  return typeof value === 'object';
}
