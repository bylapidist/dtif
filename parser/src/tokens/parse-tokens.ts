import {
  createInlineParseDocumentUseCase,
  createParseDocumentUseCase
} from '../application/factory.js';
import { createParseTokensUseCase } from './use-case-factory.js';
import { isRecord } from '../input/contracts.js';
import { resolveOptions } from '../runtime/resolve-options.js';
import { createDocumentRequest, createInlineDocumentRequest } from '../application/requests.js';
import { type ParseTokensInput, normalizeInput, normalizeInlineInput } from './inputs.js';
import type { ParseTokensOptions, ParseTokensResult, ParseTokensSyncOptions } from './contracts.js';
import { toParseTokensResult } from './internal/parse-result.js';
export type { ParseTokensInput } from './inputs.js';
export type { ParseTokensOptions, ParseTokensResult, ParseTokensSyncOptions } from './contracts.js';

export async function parseTokens(
  input: ParseTokensInput,
  options: ParseTokensOptions = {}
): Promise<ParseTokensResult> {
  const {
    flatten = true,
    includeGraphs = true,
    tokenCache,
    onDiagnostic,
    warn,
    ...sessionOptions
  } = options;
  const resolvedOptions = resolveOptions(sessionOptions);
  const documents = createParseDocumentUseCase(resolvedOptions);
  const request = createDocumentRequest(normalizeInput(input));
  const useCase = createParseTokensUseCase(documents, resolvedOptions, tokenCache);

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

export function parseTokensSync(
  input: ParseTokensInput,
  options: ParseTokensSyncOptions = {}
): ParseTokensResult {
  assertSyncCompatibleOptions(options);

  const {
    flatten = true,
    includeGraphs = true,
    tokenCache,
    onDiagnostic,
    warn,
    ...sessionOptions
  } = options;

  const inline = normalizeInlineInput(input);
  if (!inline) {
    throw new Error('parseTokensSync requires inline content or design token objects.');
  }
  const resolvedOptions = resolveOptions(sessionOptions);
  const request = createInlineDocumentRequest(inline);
  const documents = createInlineParseDocumentUseCase(inline, resolvedOptions);
  const useCase = createParseTokensUseCase(documents, resolvedOptions, tokenCache);

  const execution = useCase.executeSync({
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

function assertSyncCompatibleOptions(options: unknown): void {
  if (!isRecord(options)) {
    return;
  }

  if (hasDefinedOption(options, 'documentCache')) {
    throw new Error('parseTokensSync does not support document caches.');
  }

  if (hasDefinedOption(options, 'loader')) {
    throw new Error('parseTokensSync does not support custom document loaders.');
  }

  if (hasDefinedOption(options, 'allowHttp')) {
    throw new Error('parseTokensSync does not support allowHttp because inputs must be inline.');
  }
}

function hasDefinedOption(options: Record<string, unknown>, key: string): boolean {
  return key in options && options[key] !== undefined;
}
