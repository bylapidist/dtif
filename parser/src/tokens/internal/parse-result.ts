import type { ParseTokensExecution } from '../../application/use-cases.js';
import type { DocumentAst } from '../../ast/nodes.js';
import type { DiagnosticEvent } from '../../domain/models.js';
import type { DocumentGraph } from '../../graph/nodes.js';
import type { DocumentResolver } from '../../resolver/document-resolver.js';
import type { ParseTokensResult } from '../contracts.js';
import type { ResolvedTokenView, TokenId, TokenMetadataSnapshot } from '../types.js';

export interface ParseTokensResultOptions {
  readonly flatten: boolean;
  readonly includeGraphs: boolean;
  readonly onDiagnostic?: (diagnostic: DiagnosticEvent) => void;
  readonly warn?: (diagnostic: DiagnosticEvent) => void;
}

export function toParseTokensResult(
  execution: ParseTokensExecution<DocumentAst, DocumentGraph, DocumentResolver>,
  options: ParseTokensResultOptions
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
  options: Pick<ParseTokensResultOptions, 'onDiagnostic' | 'warn'>
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
