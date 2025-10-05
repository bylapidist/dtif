import { createHash } from 'node:crypto';

import type {
  DtifFlattenedToken,
  ResolvedTokenView,
  TokenId,
  TokenMetadataSnapshot
} from './types.js';
import type { RawDocument } from '../types.js';
import { hashJsonValue } from '../utils/hash-json.js';
import type { TokenCachePort, TokenCacheKey as DomainTokenCacheKey } from '../domain/ports.js';
import type { RawDocumentIdentity } from '../domain/models.js';
import type { DiagnosticEvent } from '../domain/models.js';

export type TokenCacheKey = DomainTokenCacheKey;

export interface TokenCacheVariantOptions {
  readonly flatten: boolean;
  readonly includeGraphs: boolean;
}

export type TokenCacheVariantOverrides = Partial<TokenCacheVariantOptions>;

export interface TokenCacheSnapshot {
  readonly documentHash: string;
  readonly flattened?: readonly DtifFlattenedToken[];
  readonly metadataIndex?: ReadonlyMap<TokenId, TokenMetadataSnapshot>;
  readonly resolutionIndex?: ReadonlyMap<TokenId, ResolvedTokenView>;
  readonly diagnostics?: readonly DiagnosticEvent[];
  readonly timestamp: number;
}

export interface TokenCacheConfiguration {
  readonly resolutionDepth: number;
  readonly overrideContext?: ReadonlyMap<string, unknown>;
  readonly transformSignature?: string;
  readonly variantSignature?: string;
}

export type TokenCache = TokenCachePort<TokenCacheSnapshot>;

export interface InMemoryTokenCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
  readonly defaultVariant?: string;
}

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_CACHE_VARIANT_OPTIONS: TokenCacheVariantOptions = Object.freeze({
  flatten: true,
  includeGraphs: true
});
const DEFAULT_VARIANT = 'default';

export class InMemoryTokenCache implements TokenCache {
  readonly #maxEntries: number;
  readonly #ttlMs?: number;
  readonly #store = new Map<
    string,
    { readonly entry: TokenCacheSnapshot; readonly createdAt: number }
  >();
  readonly #defaultVariant: string;

  constructor(options: InMemoryTokenCacheOptions = {}) {
    this.#maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.#ttlMs = options.ttlMs;
    this.#defaultVariant = options.defaultVariant ?? DEFAULT_VARIANT;
  }

  get(key: TokenCacheKey): TokenCacheSnapshot | undefined {
    const id = serializeKey(key, this.#defaultVariant);
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

  set(key: TokenCacheKey, value: TokenCacheSnapshot): void {
    const id = serializeKey(key, this.#defaultVariant);
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

export function createTokenCache(options?: InMemoryTokenCacheOptions): InMemoryTokenCache {
  return new InMemoryTokenCache(options);
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

export function createTokenCacheVariant(
  configuration: TokenCacheConfiguration,
  variantOptions?: TokenCacheVariantOverrides
): string {
  const resolvedVariantOptions = resolveVariantOptions(variantOptions);
  return createOptionsVariant(configuration, resolvedVariantOptions);
}

function createOptionsVariant(
  configuration: TokenCacheConfiguration,
  variantOptions: TokenCacheVariantOptions
): string {
  const payload = {
    depth: configuration.resolutionDepth,
    context: normalizeContext(configuration.overrideContext),
    transforms: configuration.transformSignature,
    variant: configuration.variantSignature,
    flatten: variantOptions.flatten,
    includeGraphs: variantOptions.includeGraphs
  } satisfies Record<string, unknown>;

  return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}

export function createTokenCacheKey(
  identity: RawDocumentIdentity,
  configuration: TokenCacheConfiguration,
  variantOptions?: TokenCacheVariantOverrides
): TokenCacheKey {
  return {
    document: identity,
    variant: createTokenCacheVariant(configuration, variantOptions)
  } satisfies TokenCacheKey;
}

function normalizeContext(
  context: TokenCacheConfiguration['overrideContext']
): Record<string, unknown> | undefined {
  if (!context || context.size === 0) {
    return undefined;
  }

  const entries = Array.from(context.entries()).sort(([a], [b]) => a.localeCompare(b));
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    normalized[key] = value;
  }
  return normalized;
}

function resolveVariantOptions(
  variantOptions?: TokenCacheVariantOverrides
): TokenCacheVariantOptions {
  return {
    flatten: variantOptions?.flatten ?? DEFAULT_CACHE_VARIANT_OPTIONS.flatten,
    includeGraphs: variantOptions?.includeGraphs ?? DEFAULT_CACHE_VARIANT_OPTIONS.includeGraphs
  };
}

function serializeKey(key: TokenCacheKey, defaultVariant: string): string {
  const variant = key.variant ?? defaultVariant;
  return `${key.document.uri.href}::${variant}`;
}
