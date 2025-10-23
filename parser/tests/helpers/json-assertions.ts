import assert from 'node:assert/strict';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toSerializable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toSerializable(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toSerializable(entry)])
    );
  }

  return value;
}

export function assertIsRecord(
  value: unknown,
  message = 'Expected value to be a record'
): asserts value is Record<string, unknown> {
  assert.ok(isRecord(value), message);
}

export function assertNullPrototypeDeep(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNullPrototypeDeep(entry);
    }
    return;
  }

  if (isRecord(value)) {
    assert.equal(Reflect.getPrototypeOf(value), null);

    for (const entry of Object.values(value)) {
      assertNullPrototypeDeep(entry);
    }
  }
}
