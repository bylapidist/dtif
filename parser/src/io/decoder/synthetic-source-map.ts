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
      const childPointer = appendJsonPointer(pointer, String(index)) as JsonPointer;
      pointers.set(childPointer, createSourceSpan(uri, ZERO_SOURCE_POSITION, ZERO_SOURCE_POSITION));
      populatePointers(item, childPointer, pointers, uri);
    });
    return;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [key, childValue] of entries) {
      const childPointer = appendJsonPointer(pointer, key) as JsonPointer;
      pointers.set(childPointer, createSourceSpan(uri, ZERO_SOURCE_POSITION, ZERO_SOURCE_POSITION));
      populatePointers(childValue, childPointer, pointers, uri);
    }
  }
}
