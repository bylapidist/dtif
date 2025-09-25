function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createRecordWithPrototype(prototype: object | null): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  Reflect.setPrototypeOf(record, prototype);
  return record;
}

export function cloneJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (isRecord(value)) {
    const prototype = Reflect.getPrototypeOf(value);
    const clone = createRecordWithPrototype(prototype);

    for (const [key, entry] of Object.entries(value)) {
      clone[key] = cloneJsonValue(entry);
    }

    return clone;
  }

  return value;
}
