import type { ErrorObject } from 'ajv';
import {
  createDtifValidator,
  DEFAULT_FORMAT_REGISTRAR,
  DEFAULT_VALIDATOR_OPTIONS as VALIDATOR_DEFAULT_OPTIONS
} from '@lapidist/dtif-validator';
import type { CreateDtifValidatorOptions, DtifValidator } from '@lapidist/dtif-validator';

import { DiagnosticCodes } from '../diagnostics/codes.js';
import { JSON_POINTER_ROOT, normalizeJsonPointer } from '../utils/json-pointer.js';
import type {
  DecodedDocument,
  DiagnosticEvent,
  DiagnosticEventRelatedInformation
} from '../domain/models.js';
import type { SourceSpan } from '../domain/primitives.js';

export interface SchemaGuardOptions extends CreateDtifValidatorOptions {
  readonly validator?: DtifValidator;
}

export interface SchemaGuardResult {
  readonly valid: boolean;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export class SchemaGuardError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SchemaGuardError';
  }
}

export { DEFAULT_FORMAT_REGISTRAR };

export const DEFAULT_VALIDATOR_OPTIONS = VALIDATOR_DEFAULT_OPTIONS;

function createSchemaValidator(options: CreateDtifValidatorOptions = {}): DtifValidator {
  return createDtifValidator(options);
}

export class SchemaGuard {
  private readonly validator: DtifValidator;

  constructor(options: SchemaGuardOptions = {}) {
    const { validator, ...validatorOptions } = options;
    this.validator = validator ?? createSchemaValidator(validatorOptions);
  }

  validate(document: DecodedDocument): SchemaGuardResult {
    let valid: boolean;

    try {
      valid = this.validator.validate(document.data);
    } catch (error) {
      throw new SchemaGuardError('Failed to validate DTIF document against the core schema.', {
        cause: error
      });
    }

    const errors = valid ? [] : (this.validator.validate.errors ?? []);
    const diagnostics = errors.map((error) => this.createDiagnostic(error, document));

    const frozenDiagnostics = diagnostics.map((diagnostic) => Object.freeze(diagnostic));

    return Object.freeze({
      valid,
      diagnostics: Object.freeze(frozenDiagnostics)
    });
  }

  private createDiagnostic(error: ErrorObject, document: DecodedDocument): DiagnosticEvent {
    const pointer = normalizeJsonPointer(`#${error.instancePath}`);
    const span =
      this.resolveSpan(pointer, document) ?? this.resolveSpan(JSON_POINTER_ROOT, document);
    const related = buildRelatedInformation(error);

    return {
      code: DiagnosticCodes.schemaGuard.INVALID_DOCUMENT,
      message: formatErrorMessage(error),
      severity: 'error',
      pointer,
      span,
      related: related.length > 0 ? related : undefined
    } satisfies DiagnosticEvent;
  }

  private resolveSpan(pointer: string, document: DecodedDocument): SourceSpan | undefined {
    const normalized = normalizeJsonPointer(pointer);
    return document.sourceMap?.pointers.get(normalized);
  }
}

function formatErrorMessage(error: ErrorObject): string {
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

function ensureSentence(value: string): string {
  const capitalised = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/u.test(capitalised) ? capitalised : `${capitalised}.`;
}

function buildRelatedInformation(error: ErrorObject): DiagnosticEventRelatedInformation[] {
  const related: DiagnosticEventRelatedInformation[] = [];

  if (error.schemaPath) {
    related.push({ message: `Schema path: ${error.schemaPath}` });
  }

  const detail = formatErrorDetail(error.keyword, error.params);
  if (detail) {
    related.push({ message: detail });
  }

  return related;
}

function formatErrorDetail(keyword: string, params: ErrorObject['params']): string | undefined {
  if (!isJsonObject(params)) {
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
        return `Expected no more than ${limitText} ${pluralise(noun, limit)}.`;
      }
      return undefined;
    }
    case 'minimum':
    case 'exclusiveMinimum': {
      const limit = params.limit;
      if (typeof limit === 'number') {
        const comparator = keyword === 'exclusiveMinimum' ? 'greater than' : 'at least';
        const limitText = limit.toString();
        return `Value must be ${comparator} ${limitText}.`;
      }
      return undefined;
    }
    case 'maximum':
    case 'exclusiveMaximum': {
      const limit = params.limit;
      if (typeof limit === 'number') {
        const comparator = keyword === 'exclusiveMaximum' ? 'less than' : 'at most';
        const limitText = limit.toString();
        return `Value must be ${comparator} ${limitText}.`;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function formatAllowedValues(values: unknown[]): string {
  return values.map((value) => formatAllowedValue(value)).join(', ');
}

function formatAllowedValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pluralise(noun: string, quantity: number): string {
  return quantity === 1 ? noun : `${noun}s`;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
