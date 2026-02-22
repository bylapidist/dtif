import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { appendJsonPointer } from '../../utils/json-pointer.js';
import type { JsonPointer } from '../../types.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';
import { isPlainObject } from './utils.js';

const CANONICAL_ORDERS: readonly (readonly string[])[] = Object.freeze([
  Object.freeze(['dimensionType', 'value', 'unit']),
  Object.freeze(['fn', 'parameters']),
  Object.freeze(['colorSpace', 'components'])
]);

export function validateCollectionMemberOrder(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): void {
  const keys = Object.keys(value).filter((key) => !key.startsWith('$'));
  if (keys.length < 2) {
    return;
  }

  const sorted = [...keys].sort((left, right) => left.localeCompare(right));
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index] !== sorted[index]) {
      context.diagnostics.push({
        code: DiagnosticCodes.normaliser.INVALID_MEMBER_ORDER,
        message: 'collection members must be sorted lexicographically',
        severity: 'error',
        pointer,
        span: getSourceSpan(context, pointer)
      });
      return;
    }
  }
}

export function validateTokenMemberOrder(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): void {
  if (!('$type' in value) || !('$value' in value)) {
    return;
  }

  const keys = Object.keys(value);
  if (keys.indexOf('$type') > keys.indexOf('$value')) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_ORDER,
      message: 'token members must place $type before $value',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }
}

export function validateCanonicalValueOrdering(
  context: NormaliserContext,
  value: unknown,
  pointer: JsonPointer
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateCanonicalValueOrdering(context, entry, appendJsonPointer(pointer, String(index)));
    });
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  const keys = Object.keys(value);
  for (const canonicalOrder of CANONICAL_ORDERS) {
    if (!containsAll(keys, canonicalOrder)) {
      continue;
    }
    if (!isInOrder(keys, canonicalOrder)) {
      context.diagnostics.push({
        code: DiagnosticCodes.normaliser.INVALID_MEMBER_ORDER,
        message: `canonical key order violated: ${canonicalOrder.join(', ')}`,
        severity: 'error',
        pointer,
        span: getSourceSpan(context, pointer)
      });
      break;
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    validateCanonicalValueOrdering(context, nestedValue, appendJsonPointer(pointer, key));
  }
}

function containsAll(keys: readonly string[], sequence: readonly string[]): boolean {
  return sequence.every((key) => keys.includes(key));
}

function isInOrder(keys: readonly string[], sequence: readonly string[]): boolean {
  let previous = -1;
  for (const key of sequence) {
    const index = keys.indexOf(key);
    if (index === -1) {
      return true;
    }
    if (index < previous) {
      return false;
    }
    previous = index;
  }
  return true;
}
