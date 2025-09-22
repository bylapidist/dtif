import type { DocumentCache, RawDocument } from '../types.js';

export interface InMemoryDocumentCacheOptions {
  readonly maxEntries?: number;
  readonly maxAgeMs?: number;
  readonly clock?: () => number;
}

interface CacheEntry {
  readonly document: RawDocument;
  timestamp: number;
}

const DEFAULT_MAX_ENTRIES = 32;
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export class InMemoryDocumentCache implements DocumentCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #maxEntries: number;
  readonly #maxAgeMs?: number;
  readonly #clock: () => number;

  constructor(options: InMemoryDocumentCacheOptions = {}) {
    this.#maxEntries = normalizeMaxEntries(options.maxEntries);
    this.#maxAgeMs = normalizeMaxAge(options.maxAgeMs);
    this.#clock = options.clock ?? Date.now;
  }

  get(uri: URL): RawDocument | undefined {
    const key = uri.href;
    const entry = this.#entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (this.#isExpired(entry)) {
      this.#entries.delete(key);
      return undefined;
    }

    this.#touch(key, entry);
    return entry.document;
  }

  set(document: RawDocument): void {
    if (this.#maxEntries === 0) {
      return;
    }

    this.#pruneExpired();
    const key = document.uri.href;
    const entry: CacheEntry = {
      document,
      timestamp: this.#clock()
    };

    this.#entries.set(key, entry);
    this.#enforceSize();
  }

  delete(uri: URL): void {
    this.#entries.delete(uri.href);
  }

  clear(): void {
    this.#entries.clear();
  }

  #pruneExpired(): void {
    if (this.#maxAgeMs === undefined) {
      return;
    }

    for (const [key, entry] of this.#entries) {
      if (this.#isExpired(entry)) {
        this.#entries.delete(key);
      }
    }
  }

  #enforceSize(): void {
    if (this.#maxEntries < 0) {
      return;
    }

    while (this.#entries.size > this.#maxEntries) {
      const oldestKey = this.#entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.#entries.delete(oldestKey);
    }
  }

  #isExpired(entry: CacheEntry): boolean {
    if (this.#maxAgeMs === undefined) {
      return false;
    }

    const age = this.#clock() - entry.timestamp;
    return age > this.#maxAgeMs;
  }

  #touch(key: string, entry: CacheEntry): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
  }
}

function normalizeMaxAge(input: number | undefined): number | undefined {
  if (input === undefined) {
    return DEFAULT_MAX_AGE_MS;
  }

  if (!Number.isFinite(input)) {
    return undefined;
  }

  const normalized = Math.trunc(input);
  if (normalized <= 0) {
    return undefined;
  }

  return normalized;
}

function normalizeMaxEntries(input: number | undefined): number {
  if (input === undefined) {
    return DEFAULT_MAX_ENTRIES;
  }

  if (!Number.isFinite(input)) {
    return -1;
  }

  return Math.max(0, Math.trunc(input));
}
