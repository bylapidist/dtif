import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

import type { ParseTokensOptions, ParseTokensResult } from '../../tokens/contracts.js';
import { formatDiagnostic } from '../../diagnostics/format.js';
import type { FormatDiagnosticOptions } from '../../diagnostics/format.js';
import type { DiagnosticEvent } from '../../domain/models.js';
import { isDesignTokenDocument } from '../../input/contracts.js';
import { createDocumentRequest } from '../../application/requests.js';
import { createRuntime } from '../../session/runtime.js';
import { toParseTokensResult } from '../../tokens/internal/parse-result.js';

const SUPPORTED_EXTENSIONS = ['.tokens', '.tokens.json', '.tokens.yaml', '.tokens.yml'];

export interface NodeParseTokensOptions extends ParseTokensOptions {
  readonly onWarn?: (message: string) => void;
  readonly diagnosticFormat?: FormatDiagnosticOptions;
}

export class DtifTokenParseError extends Error {
  readonly diagnostics: readonly DiagnosticEvent[];
  readonly source: string;
  readonly formatOptions?: FormatDiagnosticOptions;

  constructor(
    source: string | URL,
    diagnostics: readonly DiagnosticEvent[],
    formatOptions?: FormatDiagnosticOptions
  ) {
    const sourceText = toSourceString(source);
    super(createDtifErrorMessage(sourceText, diagnostics, formatOptions));
    this.name = 'DtifTokenParseError';
    this.diagnostics = diagnostics;
    this.source = sourceText;
    this.formatOptions = formatOptions;
  }

  format(options?: FormatDiagnosticOptions): string {
    return createDtifErrorMessage(this.source, this.diagnostics, options ?? this.formatOptions);
  }
}

export async function parseTokensFromFile(
  filePath: string | URL,
  options: NodeParseTokensOptions = {}
): Promise<ParseTokensResult> {
  assertSupportedFile(filePath);
  const result = await parseTokensWithRuntime(filePath, options);
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
  assertIsDesignTokenDocument(data, document.identity.uri.href);
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
      onWarn(formatDiagnostic(diagnostic, diagnosticFormat));
      originalWarn?.(diagnostic);
    }
  } satisfies ParseTokensOptions;
}

async function parseTokensWithRuntime(
  input: string | URL,
  options: NodeParseTokensOptions
): Promise<ParseTokensResult> {
  const parseOptions = toParseTokensOptions(options);
  const {
    flatten = true,
    includeGraphs = true,
    tokenCache,
    onDiagnostic,
    warn,
    ...runtimeOptions
  } = parseOptions;
  const runtime = createRuntime(runtimeOptions);
  const request = createDocumentRequest(input);
  const useCase = runtime.createTokensUseCase(tokenCache);
  const execution = await useCase.execute({
    request,
    flatten,
    includeGraphs
  });

  return toParseTokensResult(execution, {
    flatten,
    includeGraphs,
    onDiagnostic,
    warn
  });
}

function assertSupportedFile(filePath: string | URL): void {
  const source = toSourceString(filePath);
  if (!SUPPORTED_EXTENSIONS.some((extension) => source.endsWith(extension))) {
    throw new Error(`Unsupported design tokens file: ${source}`);
  }
}

function createDtifErrorMessage(
  source: string,
  diagnostics: readonly DiagnosticEvent[],
  formatOptions?: FormatDiagnosticOptions
): string {
  const header = `Failed to parse DTIF document: ${source}`;
  const formatted = diagnostics.map((diagnostic) => formatDiagnostic(diagnostic, formatOptions));
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
