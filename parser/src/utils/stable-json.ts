export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForStringify(value));
}

function normalizeForStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForStringify);
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([a], [b]) =>
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
