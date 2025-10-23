function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createRecord(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

export function cloneJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (isRecord(value)) {
    const clone = createRecord();

    for (const [key, entry] of Object.entries(value)) {
      Reflect.defineProperty(clone, key, {
        value: cloneJsonValue(entry),
        configurable: true,
        enumerable: true,
        writable: true
      });
    }

    return clone;
  }

  return value;
}
