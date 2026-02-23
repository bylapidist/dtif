export * as domain from './domain/index.js';
export * as domainAdapters from './adapters/domain/index.js';
export * as application from './application/index.js';

export { normalizeDocument } from './ast/normaliser.js';
export type { NormaliserResult, NormaliserOptions } from './ast/normaliser.js';
export type {
  AliasNode,
  AstField,
  CollectionNode,
  DocumentAst,
  DocumentChildNode,
  NodeMetadata,
  OverrideFallbackNode,
  OverrideNode,
  TokenNode
} from './ast/nodes.js';

export { ParseSession, createSession, parseCollection, parseDocument } from './session.js';
export type { OverrideContext, ParseSessionOptions } from './session.js';

export { createDocumentResolver, DocumentResolver } from './resolver/index.js';
export type {
  DocumentResolverOptions,
  ResolutionResult,
  ResolvedToken,
  ResolutionSource,
  AppliedOverride,
  AppliedOverrideKind,
  ResolutionTraceStep,
  ResolutionTraceStepKind
} from './resolver/index.js';

export { buildDocumentGraph } from './graph/builder.js';
export type { GraphBuilderResult } from './graph/builder.js';
export type {
  GraphNode,
  GraphNodeBase,
  GraphCollectionNode,
  GraphTokenNode,
  GraphAliasNode,
  GraphReferenceField,
  GraphReferenceTarget,
  GraphOverrideNode,
  GraphOverrideFallbackNode
} from './graph/nodes.js';

export {
  DiagnosticCodes,
  DiagnosticDomain,
  type DiagnosticDomainKey,
  type DiagnosticDomainValue,
  formatDiagnosticCode,
  isDiagnosticCode
} from './diagnostics/codes.js';
export {
  DIAGNOSTIC_SEVERITIES,
  compareDiagnosticSeverity,
  isDiagnosticSeverity,
  maxDiagnosticSeverity,
  minDiagnosticSeverity,
  severityWeight
} from './diagnostics/severity.js';

export { DefaultDocumentLoader, DocumentLoaderError } from './io/document-loader.js';
export type {
  DocumentLoader,
  DocumentLoaderContext,
  DefaultDocumentLoaderOptions,
  DocumentLoaderErrorReason
} from './io/document-loader.js';

export { InMemoryDocumentCache } from './io/document-cache.js';
export type { InMemoryDocumentCacheOptions } from './io/document-cache.js';

export { SchemaGuard } from './validation/schema-guard.js';
export type { SchemaGuardOptions, SchemaGuardResult } from './validation/schema-guard.js';

export type {
  ContentType,
  Diagnostic,
  DocumentCache,
  DocumentGraph,
  DocumentHandle,
  JsonPointer,
  ParseInput,
  ParseInputRecord,
  ParseDataInputRecord,
  RawDocument,
  RelatedInformation,
  SourceMap,
  SourcePosition,
  SourceSpan
} from './types.js';
export type { DiagnosticSeverity, DiagnosticCode } from './types.js';

export type { ParseDocumentResult, ParseCollectionResult } from './session.js';

export {
  JSON_POINTER_ROOT,
  appendJsonPointer,
  decodeJsonPointerSegment,
  encodeJsonPointerSegment,
  isJsonPointer,
  joinJsonPointer,
  jsonPointerStartsWith,
  normalizeJsonPointer,
  parentJsonPointer,
  splitJsonPointer,
  tailJsonPointer
} from './utils/json-pointer.js';

export {
  ZERO_SOURCE_POSITION,
  cloneSourcePosition,
  cloneSourceSpan,
  compareSourcePositions,
  createSourcePosition,
  createSourceSpan,
  isSourcePosition,
  isSourceSpan,
  maxSourcePosition,
  minSourcePosition,
  spanContainsPosition,
  spanLength,
  spansOverlap,
  translateSourceSpan,
  unionSourceSpans
} from './utils/source.js';

export { PluginRegistry, createPluginRegistry } from './plugins/index.js';
export type {
  ParserPlugin,
  ExtensionHandler,
  ExtensionHandlerResult,
  ExtensionHandlerInput,
  ExtensionEvaluation,
  ResolvedTokenTransform,
  ResolvedTokenTransformContext,
  ResolvedTokenTransformResult,
  ResolvedTokenTransformEvaluation
} from './plugins/index.js';

export { formatDiagnostic } from './diagnostics/format.js';
export type {
  TokenId,
  TokenPointer,
  TokenMetadataSnapshot,
  ResolvedTokenView,
  TokenType,
  JsonValue,
  DtifFlattenedToken
} from './tokens/types.js';
export type { FormatDiagnosticOptions } from './diagnostics/format.js';
export { parseTokens, parseTokensSync } from './tokens/parse-tokens.js';
export type {
  ParseTokensInput,
  ParseTokensOptions,
  ParseTokensSyncOptions,
  ParseTokensResult
} from './tokens/parse-tokens.js';
export { createMetadataSnapshot, createResolutionSnapshot } from './tokens/snapshots.js';
export { flattenTokens } from './tokens/flatten.js';
export { InMemoryTokenCache, createTokenCache } from './tokens/cache.js';
export type {
  TokenCache,
  TokenCacheSnapshot,
  TokenCacheKey,
  TokenCacheConfiguration,
  TokenCacheVariantOverrides,
  InMemoryTokenCacheOptions
} from './tokens/cache.js';
export {
  parseTokensFromFile,
  readTokensFile,
  DtifTokenParseError
} from './adapters/node/token-parser.js';
export type { NodeParseTokensOptions } from './adapters/node/token-parser.js';
