import type { JsonValue, TokenPointer } from '../types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

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
    return value;
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

  if (isRecord(value)) {
    const result: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalized = toPlainJson(entry);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }
    return result;
  }

  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      return undefined;
    }

    const parsed: unknown = JSON.parse(serialized);
    return isJsonValue(parsed) ? parsed : undefined;
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
