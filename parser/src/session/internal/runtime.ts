import { createParseDocumentUseCase } from '../../application/factory.js';
import type { ParseDocumentUseCase, ParseTokensUseCase } from '../../application/use-cases.js';
import type { DocumentAst } from '../../ast/nodes.js';
import type { DocumentGraph } from '../../graph/nodes.js';
import type { DocumentResolver } from '../../resolver/document-resolver.js';
import type { TokenCache } from '../../tokens/cache.js';
import { createParseTokensUseCase } from '../../tokens/use-case-factory.js';
import { resolveOptions, type ResolvedParseSessionOptions } from './options.js';
import type { ParseSessionOptions } from '../types.js';

export interface ParserRuntime {
  readonly options: ResolvedParseSessionOptions;
  readonly documents: ParseDocumentUseCase<DocumentAst, DocumentGraph, DocumentResolver>;
  createTokensUseCase(
    tokenCache?: TokenCache
  ): ParseTokensUseCase<DocumentAst, DocumentGraph, DocumentResolver>;
}

export function createRuntime(options: ParseSessionOptions = {}): ParserRuntime {
  return createRuntimeFromResolvedOptions(resolveOptions(options));
}

export function createRuntimeFromResolvedOptions(
  options: ResolvedParseSessionOptions
): ParserRuntime {
  const documents = createParseDocumentUseCase(options);

  return {
    options,
    documents,
    createTokensUseCase: (tokenCache) => createParseTokensUseCase(documents, options, tokenCache)
  } satisfies ParserRuntime;
}
