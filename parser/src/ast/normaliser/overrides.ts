import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { appendJsonPointer } from '../../utils/json-pointer.js';
import type { JsonPointer } from '../../types.js';
import type { OverrideFallbackNode, OverrideNode } from '../nodes.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';
import {
  readOptionalStringField,
  readOverrideConditions,
  readRequiredStringField
} from './fields.js';
import { createField, EMPTY_OVERRIDES, isPlainObject } from './utils.js';

export function normalizeOverrides(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): readonly OverrideNode[] {
  if (!('$overrides' in value)) {
    return EMPTY_OVERRIDES;
  }

  const overridesValue = value['$overrides'];
  const overridesPointer = appendJsonPointer(pointer, '$overrides');

  if (!Array.isArray(overridesValue)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: '$overrides must be an array of override objects.',
      severity: 'error',
      pointer: overridesPointer,
      span: getSourceSpan(context, overridesPointer)
    });
    return EMPTY_OVERRIDES;
  }

  const overrides: OverrideNode[] = [];

  overridesValue.forEach((entry, index) => {
    const entryPointer = appendJsonPointer(overridesPointer, String(index));
    const override = normalizeOverrideNode(context, entry, entryPointer);
    if (override) {
      overrides.push(override);
    }
  });

  return overrides.length === 0 ? EMPTY_OVERRIDES : Object.freeze(overrides);
}

export function normalizeOverrideNode(
  context: NormaliserContext,
  value: unknown,
  pointer: JsonPointer
): OverrideNode | undefined {
  if (!isPlainObject(value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: 'Override entries must be JSON objects.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  const token = readRequiredStringField(context, value, '$token', pointer);
  const when = readOverrideConditions(context, value, pointer);
  const refField = readOptionalStringField(context, value, '$ref', pointer);
  const valueField =
    '$value' in value
      ? createField(context, value['$value'], appendJsonPointer(pointer, '$value'))
      : undefined;
  const fallback =
    '$fallback' in value
      ? normalizeFallbackChain(context, value['$fallback'], appendJsonPointer(pointer, '$fallback'))
      : undefined;

  if (!token || !when) {
    return undefined;
  }

  if (!refField && !valueField && !fallback) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Override entries must provide $ref, $value, or $fallback.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }

  if (refField && valueField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Override entries must not declare both $ref and $value.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }

  return Object.freeze({
    kind: 'override',
    pointer,
    span: getSourceSpan(context, pointer),
    token,
    when,
    ref: refField,
    value: valueField,
    fallback
  });
}

export function normalizeFallbackChain(
  context: NormaliserContext,
  value: unknown,
  pointer: JsonPointer
): readonly OverrideFallbackNode[] | undefined {
  if (Array.isArray(value)) {
    const entries: OverrideFallbackNode[] = [];
    value.forEach((entry, index) => {
      const entryPointer = appendJsonPointer(pointer, String(index));
      const node = normalizeFallbackEntry(context, entry, entryPointer);
      if (node) {
        entries.push(node);
      }
    });
    return entries.length === 0 ? undefined : Object.freeze(entries);
  }

  if (isPlainObject(value)) {
    const entry = normalizeFallbackEntry(context, value, pointer);
    return entry ? Object.freeze([entry]) : undefined;
  }

  context.diagnostics.push({
    code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
    message: '$fallback must be an override object or an array of override objects.',
    severity: 'error',
    pointer,
    span: getSourceSpan(context, pointer)
  });
  return undefined;
}

function normalizeFallbackEntry(
  context: NormaliserContext,
  value: unknown,
  pointer: JsonPointer
): OverrideFallbackNode | undefined {
  if (!isPlainObject(value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: 'Fallback entries must be JSON objects.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  const refField = readOptionalStringField(context, value, '$ref', pointer);
  const valueField =
    '$value' in value
      ? createField(context, value['$value'], appendJsonPointer(pointer, '$value'))
      : undefined;
  const fallback =
    '$fallback' in value
      ? normalizeFallbackChain(context, value['$fallback'], appendJsonPointer(pointer, '$fallback'))
      : undefined;

  if (!refField && !valueField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Fallback entries must provide $ref or $value.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  if (refField && valueField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Fallback entries must not declare both $ref and $value.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  return Object.freeze({
    kind: 'fallback',
    pointer,
    span: getSourceSpan(context, pointer),
    ref: refField,
    value: valueField,
    fallback
  });
}
