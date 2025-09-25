import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import { parseTokens } from '../../tokens/parse-tokens.js';
import type { ParseTokensOptions, ParseTokensResult } from '../../tokens/parse-tokens.js';
import { formatTokenDiagnostic } from '../../tokens/diagnostics.js';
import type { FormatTokenDiagnosticOptions, TokenDiagnostic } from '../../tokens/types.js';

const SUPPORTED_EXTENSIONS = ['.tokens', '.tokens.json', '.tokens.yaml', '.tokens.yml'];

export interface NodeParseTokensOptions extends ParseTokensOptions {
  readonly onWarn?: (message: string) => void;
  readonly diagnosticFormat?: FormatTokenDiagnosticOptions;
}

export class DtifTokenParseError extends Error {
  readonly diagnostics: readonly TokenDiagnostic[];
  readonly source: string;
  readonly formatOptions?: FormatTokenDiagnosticOptions;

  constructor(
    source: string | URL,
    diagnostics: readonly TokenDiagnostic[],
    formatOptions?: FormatTokenDiagnosticOptions
  ) {
    const sourceText = toSourceString(source);
    super(createDtifErrorMessage(sourceText, diagnostics, formatOptions));
    this.name = 'DtifTokenParseError';
    this.diagnostics = diagnostics;
    this.source = sourceText;
    this.formatOptions = formatOptions;
  }

  format(options?: FormatTokenDiagnosticOptions): string {
    return createDtifErrorMessage(this.source, this.diagnostics, options ?? this.formatOptions);
  }
}

export async function parseTokensFromFile(
  filePath: string | URL,
  options: NodeParseTokensOptions = {}
): Promise<ParseTokensResult> {
  assertSupportedFile(filePath);
  const parseOptions = toParseTokensOptions(options);
  const result = await parseTokens(filePath, parseOptions);
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length > 0) {
    throw new DtifTokenParseError(filePath, errors, options.diagnosticFormat);
  }
  return result;
}

export async function readTokensFile(
  filePath: string | URL,
  options: NodeParseTokensOptions = {}
): Promise<DesignTokenInterchangeFormat> {
  const result = await parseTokensFromFile(filePath, options);
  const document = result.document;
  if (!document) {
    throw new Error(`DTIF parser did not return a document for ${toSourceString(filePath)}`);
  }
  const data = document.data;
  assertIsDesignTokenDocument(data, document.uri.href);
  return data;
}

function toParseTokensOptions(options: NodeParseTokensOptions): ParseTokensOptions {
  const { onWarn, diagnosticFormat, warn: originalWarn, ...rest } = options;
  if (!onWarn) {
    return originalWarn ? { ...rest, warn: originalWarn } : rest;
  }

  return {
    ...rest,
    warn: (diagnostic) => {
      if (diagnostic.severity === 'error') {
        return;
      }
      onWarn(formatTokenDiagnostic(diagnostic, diagnosticFormat));
      originalWarn?.(diagnostic);
    }
  } satisfies ParseTokensOptions;
}

function assertSupportedFile(filePath: string | URL): void {
  const source = toSourceString(filePath);
  if (!SUPPORTED_EXTENSIONS.some((extension) => source.endsWith(extension))) {
    throw new Error(`Unsupported design tokens file: ${source}`);
  }
}

function createDtifErrorMessage(
  source: string,
  diagnostics: readonly TokenDiagnostic[],
  formatOptions?: FormatTokenDiagnosticOptions
): string {
  const header = `Failed to parse DTIF document: ${source}`;
  const formatted = diagnostics.map((diagnostic) =>
    formatTokenDiagnostic(diagnostic, formatOptions)
  );
  return [header, ...formatted.map((line) => `  - ${line}`)].join('\n');
}

function toSourceString(source: string | URL): string {
  return typeof source === 'string' ? source : source.toString();
}

function assertIsDesignTokenDocument(
  value: unknown,
  source: string
): asserts value is DesignTokenInterchangeFormat {
  if (!isDesignTokenDocument(value)) {
    throw new Error(`DTIF parser returned unexpected document contents for ${source}`);
  }
}

function isDesignTokenDocument(value: unknown): value is DesignTokenInterchangeFormat {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
