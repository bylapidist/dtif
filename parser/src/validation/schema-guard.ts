import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createRequire } from 'node:module';
import type { ErrorObject } from 'ajv';
import type { CreateDtifValidatorOptions, DtifValidator } from '@lapidist/dtif-validator';

import { DiagnosticCodes } from '../diagnostics/codes.js';
import { JSON_POINTER_ROOT, normalizeJsonPointer } from '../utils/json-pointer.js';
import type { Diagnostic, RawDocument, RelatedInformation, SourceSpan } from '../types.js';

const require = createRequire(import.meta.url);
const CORE_SCHEMA = require('@lapidist/dtif-schema/core.json') as DtifValidator['schema'];
const DEFAULT_SCHEMA_ID = (CORE_SCHEMA as { readonly $id?: string }).$id ??
  'https://dtif.lapidist.net/schema/core.json';

const DEFAULT_VALIDATOR_OPTIONS = {
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
  $data: true
} as const;

type AjvInstance = import('ajv').default;

const AjvConstructor = Ajv2020 as unknown as new (options?: object) => AjvInstance;

export interface SchemaGuardOptions extends CreateDtifValidatorOptions {
  readonly validator?: DtifValidator;
}

export interface SchemaGuardResult {
  readonly valid: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

export class SchemaGuardError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SchemaGuardError';
  }
}

function createSchemaValidator(options: CreateDtifValidatorOptions = {}): DtifValidator {
  const { ajv: existingAjv, ajvOptions = {}, formats = addFormats, schemaId = DEFAULT_SCHEMA_ID } = options;

  const ajv: AjvInstance =
    existingAjv ??
    new AjvConstructor({
      ...DEFAULT_VALIDATOR_OPTIONS,
      ...ajvOptions
    });

  if (formats) {
    const register = (typeof formats === 'function' ? formats : addFormats) as (instance: AjvInstance) => unknown;
    register(ajv);
  }

  let validate = ajv.getSchema(schemaId);
  if (!validate) {
    ajv.addSchema(CORE_SCHEMA, schemaId);
    validate = ajv.getSchema(schemaId);
  }

  const compiled = validate ?? ajv.compile(CORE_SCHEMA);

  return {
    ajv,
    schema: CORE_SCHEMA,
    schemaId,
    validate: compiled
  } as DtifValidator;
}

export class SchemaGuard {
  private readonly validator: DtifValidator;

  constructor(options: SchemaGuardOptions = {}) {
    const { validator, ...validatorOptions } = options;
    this.validator = validator ?? createSchemaValidator(validatorOptions);
  }

  validate(document: RawDocument): SchemaGuardResult {
    let valid: boolean;

    try {
      valid = this.validator.validate(document.data);
    } catch (error) {
      throw new SchemaGuardError('Failed to validate DTIF document against the core schema.', {
        cause: error
      });
    }

    const errors = valid ? [] : this.validator.validate.errors ?? [];
    const diagnostics = errors.map((error) => this.createDiagnostic(error, document));

    const frozenDiagnostics = diagnostics.map((diagnostic) => Object.freeze(diagnostic));

    return Object.freeze({
      valid,
      diagnostics: Object.freeze(frozenDiagnostics)
    });
  }

  private createDiagnostic(error: ErrorObject, document: RawDocument): Diagnostic {
    const pointer = normalizeJsonPointer(`#${error.instancePath ?? ''}`);
    const span = this.resolveSpan(pointer, document) ?? this.resolveSpan(JSON_POINTER_ROOT, document);
    const related = buildRelatedInformation(error);

    return {
      code: DiagnosticCodes.schemaGuard.INVALID_DOCUMENT,
      message: formatErrorMessage(error),
      severity: 'error',
      pointer,
      span,
      related: related.length > 0 ? related : undefined
    } satisfies Diagnostic;
  }

  private resolveSpan(pointer: string, document: RawDocument): SourceSpan | undefined {
    const normalized = normalizeJsonPointer(pointer);
    return document.sourceMap.pointers.get(normalized);
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

function buildRelatedInformation(error: ErrorObject): RelatedInformation[] {
  const related: RelatedInformation[] = [];

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
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  const record = params as Record<string, unknown>;

  switch (keyword) {
    case 'required': {
      const name = record.missingProperty;
      return typeof name === 'string' ? `Missing property: ${name}` : undefined;
    }
    case 'additionalProperties': {
      const name = record.additionalProperty;
      return typeof name === 'string' ? `Unexpected property: ${name}` : undefined;
    }
    case 'type': {
      const expected = record.type;
      return typeof expected === 'string' ? `Expected type: ${expected}` : undefined;
    }
    case 'enum': {
      const values = record.allowedValues;
      return Array.isArray(values) ? `Allowed values: ${formatAllowedValues(values)}` : undefined;
    }
    case 'const': {
      const value = record.allowedValue;
      return value !== undefined ? `Expected value: ${formatAllowedValue(value)}` : undefined;
    }
    case 'pattern': {
      const pattern = record.pattern;
      return typeof pattern === 'string' ? `Required pattern: ${pattern}` : undefined;
    }
    case 'format': {
      const format = record.format;
      return typeof format === 'string' ? `Expected format: ${format}` : undefined;
    }
    case 'minItems':
    case 'minLength': {
      const limit = record.limit;
      if (typeof limit === 'number') {
        const noun = keyword === 'minItems' ? 'item' : 'character';
        return `Expected at least ${limit} ${pluralise(noun, limit)}.`;
      }
      return undefined;
    }
    case 'maxItems':
    case 'maxLength': {
      const limit = record.limit;
      if (typeof limit === 'number') {
        const noun = keyword === 'maxItems' ? 'item' : 'character';
        return `Expected no more than ${limit} ${pluralise(noun, limit)}.`;
      }
      return undefined;
    }
    case 'minimum':
    case 'exclusiveMinimum': {
      const limit = record.limit;
      if (typeof limit === 'number') {
        const comparator = keyword === 'exclusiveMinimum' ? 'greater than' : 'at least';
        return `Value must be ${comparator} ${limit}.`;
      }
      return undefined;
    }
    case 'maximum':
    case 'exclusiveMaximum': {
      const limit = record.limit;
      if (typeof limit === 'number') {
        const comparator = keyword === 'exclusiveMaximum' ? 'less than' : 'at most';
        return `Value must be ${comparator} ${limit}.`;
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
