import type { ParseDocumentUseCase, ParseTokensUseCase } from '../application/use-cases.js';
import { ParseTokensUseCase as TokensUseCase } from '../application/use-cases.js';
import type { DocumentAst } from '../ast/nodes.js';
import type { DocumentGraph } from '../graph/nodes.js';
import type { DocumentResolver } from '../resolver/document-resolver.js';
import type { ParserRuntimeOptions } from '../application/runtime-options.js';
import { TokenFlatteningAdapter } from './token-flattening-adapter.js';
import {
  computeDocumentHash,
  createTokenCacheVariant,
  type TokenCacheConfiguration,
  type TokenCache,
  type TokenCacheSnapshot,
  type TokenCacheVariantOverrides
} from './cache.js';

export type ResolverResult = DocumentResolver;

export type ParseDocumentOrchestrator<TAst, TGraph, TResult> = Pick<
  ParseDocumentUseCase<TAst, TGraph, TResult>,
  'execute' | 'executeSync'
>;

export function createParseTokensUseCase(
  documents: ParseDocumentOrchestrator<DocumentAst, DocumentGraph, ResolverResult>,
  options: ParserRuntimeOptions,
  cache?: TokenCache
): ParseTokensUseCase<DocumentAst, DocumentGraph, ResolverResult, TokenCacheSnapshot> {
  const flattening = new TokenFlatteningAdapter();
  const configuration = createTokenCacheConfiguration(options);

  return new TokensUseCase({
    documents,
    flattening,
    tokenCache: cache,
    hashDocument: computeDocumentHash,
    resolveVariant: (overrides) => createVariantSignature(configuration, overrides)
  });
}

export function createTokenCacheConfiguration(
  options: ParserRuntimeOptions
): TokenCacheConfiguration {
  return {
    resolutionDepth: options.maxDepth,
    overrideContext: options.overrideContext,
    transformSignature: createTransformSignature(options.plugins?.transforms ?? []),
    variantSignature: options.allowHttp ? 'allow-http' : undefined
  } satisfies TokenCacheConfiguration;
}

function createVariantSignature(
  configuration: TokenCacheConfiguration,
  overrides: TokenCacheVariantOverrides
): string {
  return createTokenCacheVariant(configuration, overrides);
}

function createTransformSignature(
  transforms: readonly { readonly plugin: string }[]
): string | undefined {
  if (transforms.length === 0) {
    return undefined;
  }

  const signature = transforms.map((entry) => entry.plugin).join('>');
  return signature.length === 0 ? undefined : signature;
}
