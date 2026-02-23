import { DocumentLoaderSource } from '../adapters/domain/document-source.js';
import {
  DocumentDecodingAdapter,
  DocumentIngestionAdapter,
  InlineDocumentDecodingAdapter,
  InlineDocumentIngestionAdapter,
  DocumentNormalizationAdapter,
  GraphConstructionAdapter,
  ResolutionAdapter,
  SchemaValidationAdapter,
  TokenFlatteningAdapter
} from '../adapters/domain/services.js';
import type { ParseDocumentUseCase, ParseTokensUseCase } from './use-cases.js';
import {
  ParseDocumentUseCase as DocumentUseCase,
  ParseTokensUseCase as TokensUseCase
} from './use-cases.js';
import type { DocumentAst } from '../ast/nodes.js';
import type { DocumentGraph } from '../graph/nodes.js';
import type { DocumentResolver } from '../resolver/document-resolver.js';
import type { InlineDocumentRequestInput } from './requests.js';
import type { DocumentCachePort } from '../domain/ports.js';
import type { DocumentLoader } from '../io/document-loader.js';
import type { SchemaGuard } from '../validation/schema-guard.js';
import type { PluginRegistry } from '../plugins/index.js';
import {
  computeDocumentHash,
  createTokenCacheVariant,
  type TokenCacheConfiguration,
  type TokenCache,
  type TokenCacheVariantOverrides
} from '../tokens/cache.js';

export type ResolverResult = DocumentResolver;

export type ParseDocumentOrchestrator<TAst, TGraph, TResult> = Pick<
  ParseDocumentUseCase<TAst, TGraph, TResult>,
  'execute' | 'executeSync'
>;

export interface ParserRuntimeOptions {
  readonly loader: DocumentLoader;
  readonly documentCache?: DocumentCachePort;
  readonly allowHttp: boolean;
  readonly maxDepth: number;
  readonly overrideContext: ReadonlyMap<string, unknown>;
  readonly schemaGuard: SchemaGuard;
  readonly plugins?: PluginRegistry;
}

export function createParseDocumentUseCase(
  options: ParserRuntimeOptions
): ParseDocumentUseCase<DocumentAst, DocumentGraph, ResolverResult> {
  const source = new DocumentLoaderSource(options.loader);
  const ingestion = new DocumentIngestionAdapter(source);
  const decoding = new DocumentDecodingAdapter();
  const schema = new SchemaValidationAdapter(options.schemaGuard);
  const normalization = new DocumentNormalizationAdapter({
    extensions: options.plugins
  });
  const graph = new GraphConstructionAdapter();
  const resolution = new ResolutionAdapter({
    overrideContext: options.overrideContext,
    maxDepth: options.maxDepth,
    transforms: options.plugins?.transforms ?? [],
    loader: options.loader,
    schemaGuard: options.schemaGuard,
    extensions: options.plugins,
    allowNetworkReferences: options.allowHttp
  });
  return new DocumentUseCase({
    ingestion,
    decoding,
    schema,
    normalization,
    graph,
    resolution,
    documentCache: options.documentCache
  });
}

export function createInlineParseDocumentUseCase(
  input: InlineDocumentRequestInput,
  options: ParserRuntimeOptions
): ParseDocumentUseCase<DocumentAst, DocumentGraph, ResolverResult> {
  const ingestion = new InlineDocumentIngestionAdapter(input);
  const decoding = new InlineDocumentDecodingAdapter();
  const schema = new SchemaValidationAdapter(options.schemaGuard);
  const normalization = new DocumentNormalizationAdapter({
    extensions: options.plugins
  });
  const graph = new GraphConstructionAdapter();
  const resolution = new ResolutionAdapter({
    overrideContext: options.overrideContext,
    maxDepth: options.maxDepth,
    transforms: options.plugins?.transforms ?? [],
    extensions: options.plugins,
    allowNetworkReferences: options.allowHttp
  });

  return new DocumentUseCase({
    ingestion,
    decoding,
    schema,
    normalization,
    graph,
    resolution
  });
}

export function createParseTokensUseCase(
  documents: ParseDocumentOrchestrator<DocumentAst, DocumentGraph, ResolverResult>,
  options: ParserRuntimeOptions,
  cache?: TokenCache
): ParseTokensUseCase<DocumentAst, DocumentGraph, ResolverResult> {
  const flattening = new TokenFlatteningAdapter();
  const tokenCache = cache;
  const configuration = createTokenCacheConfiguration(options);

  return new TokensUseCase({
    documents,
    flattening,
    tokenCache,
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
