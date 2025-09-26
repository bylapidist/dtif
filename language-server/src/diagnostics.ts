import { createDtifValidator, type DtifValidator } from '@lapidist/dtif-validator';
import type { ErrorObject } from 'ajv';
import {
  DiagnosticSeverity,
  type Diagnostic as LspDiagnostic,
  type Range
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  findNodeAtLocation,
  getNodeValue,
  parseTree,
  printParseErrorCode,
  type Node as JsonNode,
  type ParseError
} from 'jsonc-parser';
import { pointerToPath } from './pointer-utils.js';
import { rangeFromNode, rangeFromOffset } from './core/documents/ranges.js';
import { isRecord } from './core/utils/object.js';

const SOURCE = 'dtif-schema';

export interface DtifDiagnosticData {
  readonly pointer?: string;
  readonly keyword?: string;
  readonly params?: unknown;
}

export interface DocumentValidatorOptions {
  readonly validator?: DtifValidator;
}

interface ValidationContext {
  readonly document: TextDocument;
  readonly tree?: JsonNode;
}

export class DocumentValidator {
  #validator: DtifValidator;

  constructor(options: DocumentValidatorOptions = {}) {
    this.#validator = options.validator ?? createDtifValidator();
  }

  validate(document: TextDocument): LspDiagnostic[] {
    const text = document.getText();
    const parseErrors: ParseError[] = [];
    const tree = parseTree(text, parseErrors, {
      allowTrailingComma: false,
      disallowComments: true
    });

    if (parseErrors.length > 0 || !tree) {
      return parseErrors.map((error) => buildParseDiagnostic(error, document));
    }

    const data: unknown = getNodeValue(tree);

    let valid = false;
    try {
      valid = this.#validator.validate(data);
    } catch (error) {
      return [buildValidatorFailureDiagnostic(error, document)];
    }

    if (valid) {
      return [];
    }

    const errors = this.#validator.validate.errors ?? [];
    const context: ValidationContext = { document, tree };
    return errors.map((error) => buildSchemaDiagnostic(error, context));
  }
}

function buildParseDiagnostic(error: ParseError, document: TextDocument): LspDiagnostic {
  const range = rangeFromOffset(document, error.offset, error.length);
  const message = `JSON parsing error: ${printParseErrorCode(error.error)}.`;
  return {
    range,
    message,
    severity: DiagnosticSeverity.Error,
    source: SOURCE
  } satisfies LspDiagnostic;
}

function buildValidatorFailureDiagnostic(error: unknown, document: TextDocument): LspDiagnostic {
  const range = rangeFromOffset(document, 0, document.getText().length);
  const message =
    error instanceof Error
      ? `Failed to validate DTIF document: ${error.message}`
      : 'Failed to validate DTIF document.';

  return {
    range,
    message,
    severity: DiagnosticSeverity.Error,
    source: SOURCE
  } satisfies LspDiagnostic;
}

function buildSchemaDiagnostic(error: ErrorObject, context: ValidationContext): LspDiagnostic {
  const pointer = normalizePointer(error.instancePath);
  const range = rangeFromPointer(pointer, context);
  const baseMessage = formatErrorMessage(error);
  const detail = formatErrorDetail(error.keyword, error.params);
  const message = detail ? `${baseMessage} ${detail}` : baseMessage;
  return {
    range,
    message,
    severity: DiagnosticSeverity.Error,
    source: SOURCE,
    code: error.keyword,
    data: {
      pointer,
      keyword: error.keyword,
      params: error.params
    } satisfies DtifDiagnosticData
  } satisfies LspDiagnostic;
}

function rangeFromPointer(pointer: string, context: ValidationContext): Range {
  const { document, tree } = context;
  if (!tree) {
    return rangeFromOffset(document, 0, document.getText().length);
  }

  const path = pointerToPath(pointer);
  let node = findNodeAtLocation(tree, path);

  if (!node && path.length > 0) {
    const parentPath = path.slice(0, -1);
    node = findNodeAtLocation(tree, parentPath) ?? undefined;
  }

  if (!node) {
    return rangeFromOffset(document, 0, document.getText().length);
  }

  return rangeFromNode(node, document);
}

function normalizePointer(instancePath: string): string {
  return instancePath && instancePath.length > 0 ? `#${instancePath}` : '#';
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

function formatErrorDetail(keyword: string, params: ErrorObject['params']): string | undefined {
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
