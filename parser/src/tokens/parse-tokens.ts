import type { ParseSessionOptions } from '../session.js';
import type { RawDocument as DomainRawDocument } from '../domain/models.js';
import type { DocumentGraph } from '../graph/nodes.js';
import type { DocumentResolver } from '../resolver/index.js';
import { type TokenCache } from './cache.js';
import type {
  DtifFlattenedToken,
  ResolvedTokenView,
  TokenId,
  TokenMetadataSnapshot
} from './types.js';
import {
  createParseDocumentUseCase,
  createInlineParseDocumentUseCase,
  createParseTokensUseCase
} from '../application/factory.js';
import type { ParseTokensExecution } from '../application/use-cases.js';
import { resolveOptions } from '../session/internal/options.js';
import { createDocumentRequest, createInlineDocumentRequest } from '../application/requests.js';
import { type ParseTokensInput, normalizeInput, normalizeInlineInput } from './inputs.js';
import type { DiagnosticEvent } from '../domain/models.js';
export type { ParseTokensInput } from './inputs.js';
import type { DocumentAst } from '../ast/nodes.js';

export interface ParseTokensOptions extends ParseSessionOptions {
  readonly flatten?: boolean;
  readonly includeGraphs?: boolean;
  readonly tokenCache?: TokenCache;
  readonly onDiagnostic?: (diagnostic: DiagnosticEvent) => void;
  readonly warn?: (diagnostic: DiagnosticEvent) => void;
}

export interface ParseTokensResult {
  readonly document?: DomainRawDocument;
  readonly graph?: DocumentGraph;
  readonly resolver?: DocumentResolver;
  readonly flattened: readonly DtifFlattenedToken[];
  readonly metadataIndex: ReadonlyMap<TokenId, TokenMetadataSnapshot>;
  readonly resolutionIndex: ReadonlyMap<TokenId, ResolvedTokenView>;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export async function parseTokens(
  input: ParseTokensInput,
  options: ParseTokensOptions = {}
): Promise<ParseTokensResult> {
  const {
    flatten = true,
    includeGraphs = true,
    tokenCache,
    documentCache,
    onDiagnostic,
    warn,
    ...sessionOptions
  } = options;
  const resolvedOptions = resolveOptions({ ...sessionOptions, documentCache });
  const request = createDocumentRequest(normalizeInput(input));

  const documents = createParseDocumentUseCase(resolvedOptions);
  const useCase = createParseTokensUseCase(documents, resolvedOptions, tokenCache);

  const execution = await useCase.execute({
    request,
    flatten,
    includeGraphs
  });

  return assembleParseTokensResult(execution, {
    flatten,
    includeGraphs,
    onDiagnostic,
    warn
  });
}

export function parseTokensSync(
  input: ParseTokensInput,
  options: ParseTokensOptions = {}
): ParseTokensResult {
  const {
    flatten = true,
    includeGraphs = true,
    tokenCache,
    documentCache,
    onDiagnostic,
    warn,
    ...sessionOptions
  } = options;

  if (documentCache) {
    throw new Error('parseTokensSync does not support document caches.');
  }

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

  return assembleParseTokensResult(execution, {
    flatten,
    includeGraphs,
    onDiagnostic,
    warn
  });
}

function assembleParseTokensResult(
  execution: ParseTokensExecution<DocumentAst, DocumentGraph, DocumentResolver>,
  options: {
    readonly flatten: boolean;
    readonly includeGraphs: boolean;
    readonly onDiagnostic?: (diagnostic: DiagnosticEvent) => void;
    readonly warn?: (diagnostic: DiagnosticEvent) => void;
  }
): ParseTokensResult {
  const diagnostics = execution.diagnostics;
  notifyDiagnostics(diagnostics, options);

  const document = options.includeGraphs ? execution.document : undefined;
  const graph = options.includeGraphs ? execution.graph?.graph : undefined;
  const resolver = options.includeGraphs ? execution.resolution?.result : undefined;

  const metadataIndex = execution.tokens?.token.metadataIndex
    ? new Map(execution.tokens.token.metadataIndex)
    : new Map<TokenId, TokenMetadataSnapshot>();
  const resolutionIndex = execution.tokens?.token.resolutionIndex
    ? new Map(execution.tokens.token.resolutionIndex)
    : new Map<TokenId, ResolvedTokenView>();
  const flattened =
    options.flatten && execution.tokens?.token.flattened
      ? [...execution.tokens.token.flattened]
      : [];

  return {
    document,
    graph,
    resolver,
    flattened,
    metadataIndex,
    resolutionIndex,
    diagnostics
  } satisfies ParseTokensResult;
}

function notifyDiagnostics(
  diagnostics: readonly DiagnosticEvent[],
  options: {
    readonly onDiagnostic?: (diagnostic: DiagnosticEvent) => void;
    readonly warn?: (diagnostic: DiagnosticEvent) => void;
  }
): void {
  if (diagnostics.length === 0) {
    return;
  }

  if (options.onDiagnostic) {
    for (const diagnostic of diagnostics) {
      options.onDiagnostic(diagnostic);
    }
  }

  if (options.warn) {
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity !== 'error') {
        options.warn(diagnostic);
      }
    }
  }
}
