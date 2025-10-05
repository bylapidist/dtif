import { createRequire } from 'node:module';
import type { ErrorObject } from 'ajv';
import type { CreateDtifValidatorOptions, DtifValidator } from '@lapidist/dtif-validator';

import { DiagnosticCodes } from '../diagnostics/codes.js';
import { JSON_POINTER_ROOT, normalizeJsonPointer } from '../utils/json-pointer.js';
import type {
  DecodedDocument,
  DiagnosticEvent,
  DiagnosticEventRelatedInformation
} from '../domain/models.js';
import type { SourceSpan } from '../domain/primitives.js';

const require = createRequire(import.meta.url);

type AjvInstance = import('ajv').default;
type FormatRegistrar = (instance: AjvInstance) => unknown;
type AjvConstructor = new (options?: object) => AjvInstance;

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

const ajvModule: unknown = require('ajv/dist/2020.js');
const formatsModule: unknown = require('ajv-formats');

const AJV_CONSTRUCTOR = resolveAjvConstructor(ajvModule);

const DEFAULT_FORMAT_REGISTRAR = resolveFormatRegistrar(formatsModule);

const CORE_SCHEMA = loadCoreSchema();
const DEFAULT_SCHEMA_ID = readSchemaId(CORE_SCHEMA) ?? 'https://dtif.lapidist.net/schema/core.json';

export const DEFAULT_VALIDATOR_OPTIONS = {
  allErrors: true,
  strict: true,
  $data: true
} as const;

function createAjvInstance(options: object): AjvInstance {
  const instance: unknown = new AJV_CONSTRUCTOR(options);
  if (!isAjvInstance(instance)) {
    throw new SchemaGuardError('Failed to create an AJV validator instance.');
  }
  return instance;
}

function createSchemaValidator(options: CreateDtifValidatorOptions = {}): DtifValidator {
  const {
    ajv: existingAjv,
    ajvOptions = {},
    formats = DEFAULT_FORMAT_REGISTRAR,
    schemaId = DEFAULT_SCHEMA_ID
  } = options;

  const ajv: AjvInstance =
    existingAjv ??
    createAjvInstance({
      ...DEFAULT_VALIDATOR_OPTIONS,
      ...ajvOptions
    });

  if (formats) {
    const register: FormatRegistrar =
      typeof formats === 'function' ? formats : DEFAULT_FORMAT_REGISTRAR;
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
  };
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

function resolveAjvConstructor(exports: unknown): AjvConstructor {
  if (isAjvConstructor(exports)) {
    return exports;
  }

  if (isJsonObject(exports)) {
    const candidate = exports.default;
    if (isAjvConstructor(candidate)) {
      return candidate;
    }
  }

  throw new SchemaGuardError('Failed to load the AJV 2020 module.');
}

function resolveFormatRegistrar(module: unknown): FormatRegistrar {
  if (isFormatRegistrar(module)) {
    return (instance) => module(instance);
  }

  if (isJsonObject(module) && isFormatRegistrar(module.default)) {
    const registrar = module.default;
    return (instance) => registrar(instance);
  }

  throw new SchemaGuardError('Failed to load the AJV formats registrar.');
}

function isAjvConstructor(value: unknown): value is AjvConstructor {
  if (typeof value !== 'function') {
    return false;
  }

  const prototype: unknown = Reflect.get(value, 'prototype');
  return typeof prototype === 'object' && prototype !== null;
}

function isFormatRegistrar(value: unknown): value is FormatRegistrar {
  return typeof value === 'function';
}

function loadCoreSchema(): DtifValidator['schema'] {
  const schema: unknown = require('@lapidist/dtif-schema/core.json');
  assertIsDtifSchema(schema);
  return schema;
}

function readSchemaId(schema: DtifValidator['schema']): string | undefined {
  if (isJsonObject(schema) && '$id' in schema) {
    const value = schema.$id;
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function assertIsDtifSchema(value: unknown): asserts value is DtifValidator['schema'] {
  if (!isJsonObject(value)) {
    throw new SchemaGuardError('Failed to load the DTIF core schema.');
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAjvInstance(value: unknown): value is AjvInstance {
  return (
    isJsonObject(value) &&
    typeof value.compile === 'function' &&
    typeof value.getSchema === 'function' &&
    typeof value.addSchema === 'function'
  );
}
