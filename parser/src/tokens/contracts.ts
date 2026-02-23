import type { ParseSessionOptions } from '../config/parse-options.js';
import type { RawDocument as DomainRawDocument } from '../domain/models.js';
import type { DocumentGraph } from '../graph/nodes.js';
import type { DocumentResolver } from '../resolver/index.js';
import type { TokenCache } from './cache.js';
import type {
  DtifFlattenedToken,
  ResolvedTokenView,
  TokenId,
  TokenMetadataSnapshot
} from './types.js';
import type { DiagnosticEvent } from '../domain/models.js';

interface ParseTokensBaseOptions {
  readonly flatten?: boolean;
  readonly includeGraphs?: boolean;
  readonly tokenCache?: TokenCache;
  readonly onDiagnostic?: (diagnostic: DiagnosticEvent) => void;
  readonly warn?: (diagnostic: DiagnosticEvent) => void;
}

export interface ParseTokensOptions extends ParseSessionOptions, ParseTokensBaseOptions {}

type ParseTokensSyncSessionOptions = Omit<
  ParseSessionOptions,
  'documentCache' | 'loader' | 'allowHttp'
>;

export interface ParseTokensSyncOptions
  extends ParseTokensSyncSessionOptions, ParseTokensBaseOptions {
  readonly documentCache?: never;
  readonly loader?: never;
  readonly allowHttp?: never;
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
