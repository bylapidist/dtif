import { createHash } from 'node:crypto';

import type { ResolvedParseSessionOptions } from '../session/internal/options.js';
import type {
  DtifFlattenedToken,
  ResolvedTokenView,
  TokenDiagnostic,
  TokenId,
  TokenMetadataSnapshot
} from './types.js';
import type { RawDocument } from '../types.js';
import { hashJsonValue } from '../utils/hash-json.js';

export interface ParseCacheKey {
  readonly uri: string;
  readonly variant: string;
}

export interface CacheVariantOptions {
  readonly flatten: boolean;
  readonly includeGraphs: boolean;
}

export interface ParseCacheEntry {
  readonly documentHash: string;
  readonly flattened?: readonly DtifFlattenedToken[];
  readonly metadataIndex?: ReadonlyMap<TokenId, TokenMetadataSnapshot>;
  readonly resolutionIndex?: ReadonlyMap<TokenId, ResolvedTokenView>;
  readonly diagnostics?: readonly TokenDiagnostic[];
  readonly timestamp: number;
}

export interface ParseCache {
  get(key: ParseCacheKey): ParseCacheEntry | undefined | Promise<ParseCacheEntry | undefined>;
  set(key: ParseCacheKey, value: ParseCacheEntry): void | Promise<void>;
}

export interface InMemoryParseCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
}

const DEFAULT_MAX_ENTRIES = 100;

export class InMemoryParseCache implements ParseCache {
  readonly #maxEntries: number;
  readonly #ttlMs?: number;
  readonly #store = new Map<
    string,
    { readonly entry: ParseCacheEntry; readonly createdAt: number }
  >();

  constructor(options: InMemoryParseCacheOptions = {}) {
    this.#maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.#ttlMs = options.ttlMs;
  }

  get(key: ParseCacheKey): ParseCacheEntry | undefined {
    const id = serializeKey(key);
    const stored = this.#store.get(id);
    if (!stored) {
      return undefined;
    }

    if (this.#ttlMs && Date.now() - stored.createdAt > this.#ttlMs) {
      this.#store.delete(id);
      return undefined;
    }

    // refresh LRU ordering
    this.#store.delete(id);
    this.#store.set(id, { entry: stored.entry, createdAt: stored.createdAt });
    return stored.entry;
  }

  set(key: ParseCacheKey, value: ParseCacheEntry): void {
    const id = serializeKey(key);
    this.#store.delete(id);
    this.#store.set(id, { entry: value, createdAt: Date.now() });
    this.#evict();
  }

  #evict(): void {
    if (this.#store.size <= this.#maxEntries) {
      return;
    }

    const iterator = this.#store.keys();
    while (this.#store.size > this.#maxEntries) {
      const next = iterator.next();
      if (next.done) {
        break;
      }
      this.#store.delete(next.value);
    }
  }
}

export function createParseCache(options?: InMemoryParseCacheOptions): InMemoryParseCache {
  return new InMemoryParseCache(options);
}

export function computeDocumentHash(input: Uint8Array | RawDocument): string {
  if (input instanceof Uint8Array) {
    return createHash('sha256').update(input).digest('hex');
  }

  if (input.data !== undefined) {
    return hashJsonValue(input.data, { algorithm: 'sha256' });
  }

  return createHash('sha256').update(input.bytes).digest('hex');
}

export function createCacheKey(
  uri: string,
  options: ResolvedParseSessionOptions,
  variantOptions: CacheVariantOptions
): ParseCacheKey {
  return {
    uri,
    variant: createOptionsVariant(options, variantOptions)
  } satisfies ParseCacheKey;
}

function createOptionsVariant(
  options: ResolvedParseSessionOptions,
  variantOptions: CacheVariantOptions
): string {
  const payload = {
    maxDepth: options.maxDepth,
    context: normalizeContext(options.overrideContext),
    plugins: normalizePlugins(options.plugins),
    flatten: variantOptions.flatten,
    includeGraphs: variantOptions.includeGraphs
  } satisfies Record<string, unknown>;

  return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

function normalizeContext(
  context: ResolvedParseSessionOptions['overrideContext']
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }

  const entries = Array.from(context.entries()).sort(([a], [b]) => a.localeCompare(b));
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    normalized[key] = value;
  }
  return normalized;
}

function normalizePlugins(
  plugins: ResolvedParseSessionOptions['plugins']
): readonly string[] | undefined {
  if (!plugins) {
    return undefined;
  }

  const transformCount = plugins.transforms.length;
  return [`transforms:${transformCount}`];
}

function serializeKey(key: ParseCacheKey): string {
  return `${key.uri}::${key.variant}`;
}
