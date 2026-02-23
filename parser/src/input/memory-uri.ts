import { createHash } from 'node:crypto';

import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import { hashJsonValue } from '../utils/hash-json.js';

interface MemoryUriOptions {
  readonly namespace: string;
  readonly extension: string;
}

const DEFAULT_INLINE_OPTIONS: MemoryUriOptions = {
  namespace: 'inline',
  extension: 'txt'
};

const DEFAULT_INLINE_BYTES_OPTIONS: MemoryUriOptions = {
  namespace: 'inline',
  extension: 'bin'
};

const DEFAULT_DOCUMENT_OPTIONS: MemoryUriOptions = {
  namespace: 'document',
  extension: 'json'
};

export function createMemoryUriFromText(
  text: string,
  options: MemoryUriOptions = DEFAULT_INLINE_OPTIONS
): string {
  const hash = createHash('sha256').update(text).digest('hex');
  return createMemoryUri(hash, options);
}

export function createMemoryUriFromBytes(
  bytes: Uint8Array,
  options: MemoryUriOptions = DEFAULT_INLINE_BYTES_OPTIONS
): string {
  const hash = createHash('sha256').update(bytes).digest('hex');
  return createMemoryUri(hash, options);
}

export function createMemoryUriFromDesignTokens(
  value: DesignTokenInterchangeFormat,
  options: MemoryUriOptions = DEFAULT_DOCUMENT_OPTIONS
): string {
  const hash = hashJsonValue(value, { algorithm: 'sha256' });
  return createMemoryUri(hash, options);
}

function createMemoryUri(hash: string, options: MemoryUriOptions): string {
  return `memory://dtif-${options.namespace}/${hash}.${options.extension}`;
}
