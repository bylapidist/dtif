import assert from 'node:assert/strict';

export function toSerializable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toSerializable(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toSerializable(entry)])
    );
  }

  return value;
}

export function assertNullPrototypeDeep(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNullPrototypeDeep(entry);
    }
    return;
  }

  if (value && typeof value === 'object') {
    assert.equal(Reflect.getPrototypeOf(value), null);

    for (const entry of Object.values(value as Record<string, unknown>)) {
      assertNullPrototypeDeep(entry);
    }
  }
}
