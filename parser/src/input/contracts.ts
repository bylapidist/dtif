import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import type { ParseDataInputRecord, ParseInputRecord } from '../types.js';

export function isRecord(value: unknown): value is Record<string | number | symbol, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isDesignTokenDocument(value: unknown): value is DesignTokenInterchangeFormat {
  if (!isRecord(value)) {
    return false;
  }

  if (value instanceof URL || value instanceof Uint8Array) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isParseInputRecord(value: unknown): value is ParseInputRecord {
  if (!isRecord(value)) {
    return false;
  }

  const content = value.content;
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    return false;
  }

  const { uri, contentType } = value;
  const validUri = uri === undefined || typeof uri === 'string' || uri instanceof URL;
  const validContentType =
    contentType === undefined ||
    contentType === 'application/json' ||
    contentType === 'application/yaml';

  return validUri && validContentType;
}

export function isParseDataInputRecord(value: unknown): value is ParseDataInputRecord {
  if (!isRecord(value)) {
    return false;
  }

  if (!('data' in value)) {
    return false;
  }

  return isDesignTokenDocument(value.data);
}
