import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { appendJsonPointer } from '../../utils/json-pointer.js';
import type { JsonPointer } from '../../domain/primitives.js';
import type { AstField } from '../nodes.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';
import { createField, freezeRecord, isPlainObject } from './utils.js';

export function readOptionalStringField(
  context: NormaliserContext,
  value: Record<string, unknown>,
  key: string,
  pointer: JsonPointer
): AstField<string> | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const fieldPointer = appendJsonPointer(pointer, key);
  const raw = value[key];

  if (typeof raw !== 'string') {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: `${key} must be a string.`,
      severity: 'error',
      pointer: fieldPointer,
      span: getSourceSpan(context, fieldPointer)
    });
    return undefined;
  }

  return createField(context, raw, fieldPointer);
}

export function readRequiredStringField(
  context: NormaliserContext,
  value: Record<string, unknown>,
  key: string,
  pointer: JsonPointer
): AstField<string> | undefined {
  const field = readOptionalStringField(context, value, key, pointer);
  if (!field) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.MISSING_REQUIRED_MEMBER,
      message: `Override entries must declare ${key}.`,
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }
  return field;
}

export function readOverrideConditions(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): AstField<Readonly<Record<string, unknown>>> | undefined {
  if (!('$when' in value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.MISSING_REQUIRED_MEMBER,
      message: 'Override entries must declare $when conditions.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  const fieldPointer = appendJsonPointer(pointer, '$when');
  const raw = value.$when;

  if (!isPlainObject(raw)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: '$when must be an object containing at least one condition.',
      severity: 'error',
      pointer: fieldPointer,
      span: getSourceSpan(context, fieldPointer)
    });
    return undefined;
  }

  if (Object.keys(raw).length === 0) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: '$when must declare at least one condition.',
      severity: 'error',
      pointer: fieldPointer,
      span: getSourceSpan(context, fieldPointer)
    });
  }

  const frozen = freezeRecord(raw);
  return createField(context, frozen, fieldPointer);
}
