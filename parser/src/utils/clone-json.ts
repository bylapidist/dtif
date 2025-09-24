export function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as unknown as T;
  }

  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value as object);
    const clone: Record<string, unknown> = Object.create(prototype ?? null);

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      clone[key] = cloneJsonValue(entry);
    }

    return clone as unknown as T;
  }

  return value;
}
