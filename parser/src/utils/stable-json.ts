export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForStringify(value));
}

function normalizeForStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForStringify);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      normalized[key] = normalizeForStringify(entry);
    }
    return normalized;
  }

  return value;
}
