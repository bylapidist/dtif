import { DocumentLoaderSource } from '../adapters/domain/document-source.js';
import {
  DocumentDecodingAdapter,
  DocumentIngestionAdapter,
  InlineDocumentDecodingAdapter,
  InlineDocumentIngestionAdapter,
  DocumentNormalizationAdapter,
  GraphConstructionAdapter,
  ResolutionAdapter,
  SchemaValidationAdapter
} from '../adapters/domain/services.js';
import type { ParseDocumentUseCase } from './use-cases.js';
import { ParseDocumentUseCase as DocumentUseCase } from './use-cases.js';
import type { DocumentAst } from '../ast/nodes.js';
import type { DocumentGraph } from '../graph/nodes.js';
import type { DocumentResolver } from '../resolver/document-resolver.js';
import type { InlineDocumentRequestInput } from './requests.js';
import type { ParserRuntimeOptions } from './runtime-options.js';

export type ResolverResult = DocumentResolver;

export type ParseDocumentOrchestrator<TAst, TGraph, TResult> = Pick<
  ParseDocumentUseCase<TAst, TGraph, TResult>,
  'execute' | 'executeSync'
>;

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

export {
  createParseTokensUseCase,
  createTokenCacheConfiguration
} from '../tokens/use-case-factory.js';
