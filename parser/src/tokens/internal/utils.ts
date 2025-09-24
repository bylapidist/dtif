import type { JsonValue, TokenPointer } from '../types.js';

export function toPlainJson(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value as JsonValue;
  }

  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (const entry of value) {
      const normalized = toPlainJson(entry);
      if (normalized !== undefined) {
        result.push(normalized);
      }
    }
    return result;
  }

  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const normalized = toPlainJson(entry);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }
    return result;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return undefined;
  }
}

export function dedupePointers(pointers: readonly TokenPointer[]): TokenPointer[] {
  if (pointers.length === 0) {
    return [];
  }

  const unique = new Map<string, TokenPointer>();
  for (const pointer of pointers) {
    const key = `${pointer.uri}::${pointer.pointer}`;
    if (!unique.has(key)) {
      unique.set(key, pointer);
    }
  }

  return Array.from(unique.values());
}
