import { createHash, type Hash } from 'node:crypto';

export interface HashJsonValueOptions {
  readonly algorithm?: string;
}

export function hashJsonValue(value: unknown, options: HashJsonValueOptions = {}): string {
  const { algorithm = 'sha256' } = options;
  const hash = createHash(algorithm);
  updateHashWithValue(hash, value);
  return hash.digest('hex');
}

function updateHashWithValue(hash: Hash, value: unknown): void {
  if (value === null) {
    hash.update('null');
    return;
  }

  switch (typeof value) {
    case 'undefined': {
      hash.update('undefined');
      return;
    }
    case 'boolean': {
      hash.update('bool:');
      hash.update(value ? '1' : '0');
      return;
    }
    case 'number': {
      hash.update('number:');
      hash.update(Number.isFinite(value) ? value.toString() : 'NaN');
      return;
    }
    case 'bigint': {
      hash.update('bigint:');
      hash.update(value.toString());
      return;
    }
    case 'string': {
      hash.update('string:');
      hash.update(value);
      return;
    }
    case 'symbol': {
      hash.update('symbol:');
      hash.update(String(value.description ?? ''));
      return;
    }
    case 'function': {
      hash.update('function');
      return;
    }
    case 'object': {
      if (Array.isArray(value)) {
        hash.update('array[');
        hash.update(value.length.toString());
        hash.update(']:');
        for (const item of value) {
          updateHashWithValue(hash, item);
          hash.update(';');
        }
        return;
      }

      hash.update('object{');
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      for (const [key, entryValue] of entries) {
        hash.update(key);
        hash.update(':');
        updateHashWithValue(hash, entryValue);
        hash.update(';');
      }
      hash.update('}');
      return;
    }
    default: {
      hash.update('unknown');
    }
  }
}
