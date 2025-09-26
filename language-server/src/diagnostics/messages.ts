import type { ErrorObject } from 'ajv';
import { isRecord } from '../core/utils/object.js';

export function formatSchemaViolationMessage(error: ErrorObject): string {
  const base = error.message?.trim();
  const keyword = error.keyword ? error.keyword.trim() : '';

  if (base && base.length > 0) {
    return `Schema violation: ${ensureSentence(base)}`;
  }

  if (keyword) {
    return `Schema violation: Constraint "${keyword}" failed.`;
  }

  return 'Schema violation: Document does not conform to the DTIF schema.';
}

export function formatSchemaViolationDetail(
  keyword: string,
  params: ErrorObject['params']
): string | undefined {
  if (!isRecord(params)) {
    return undefined;
  }

  switch (keyword) {
    case 'required': {
      const name = params.missingProperty;
      return typeof name === 'string' ? `Missing property: ${name}` : undefined;
    }
    case 'additionalProperties': {
      const name = params.additionalProperty;
      return typeof name === 'string' ? `Unexpected property: ${name}` : undefined;
    }
    case 'type': {
      const expected = params.type;
      return typeof expected === 'string' ? `Expected type: ${expected}` : undefined;
    }
    case 'enum': {
      const values = params.allowedValues;
      return Array.isArray(values) ? `Allowed values: ${formatAllowedValues(values)}` : undefined;
    }
    case 'const': {
      const value = params.allowedValue;
      return value !== undefined ? `Expected value: ${formatAllowedValue(value)}` : undefined;
    }
    case 'pattern': {
      const pattern = params.pattern;
      return typeof pattern === 'string' ? `Required pattern: ${pattern}` : undefined;
    }
    case 'format': {
      const format = params.format;
      return typeof format === 'string' ? `Expected format: ${format}` : undefined;
    }
    case 'minItems':
    case 'minLength': {
      const limit = params.limit;
      if (typeof limit === 'number') {
        const noun = keyword === 'minItems' ? 'item' : 'character';
        const limitText = limit.toString();
        return `Expected at least ${limitText} ${pluralise(noun, limit)}.`;
      }
      return undefined;
    }
    case 'maxItems':
    case 'maxLength': {
      const limit = params.limit;
      if (typeof limit === 'number') {
        const noun = keyword === 'maxItems' ? 'item' : 'character';
        const limitText = limit.toString();
        return `Expected at most ${limitText} ${pluralise(noun, limit)}.`;
      }
      return undefined;
    }
    case 'minimum':
    case 'maximum': {
      const limit = params.limit;
      if (typeof limit === 'number') {
        const comparator = keyword === 'minimum' ? 'at least' : 'at most';
        const limitText = limit.toString();
        return `Expected value ${comparator} ${limitText}.`;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function ensureSentence(value: string): string {
  const capitalised = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/u.test(capitalised) ? capitalised : `${capitalised}.`;
}

function formatAllowedValues(values: unknown[]): string {
  return values.map(formatAllowedValue).join(', ');
}

function formatAllowedValue(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return JSON.stringify(value);
}

function pluralise(noun: string, count: number): string {
  return Math.abs(count) === 1 ? noun : `${noun}s`;
}
