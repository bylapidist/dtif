import type { DiagnosticEvent, PipelineDiagnostics, TokenSnapshot } from '../domain/models.js';
import type { TokenFlatteningPort, TokenFlatteningRequest } from '../domain/ports.js';
import type { TokenFlatteningService } from '../domain/services.js';
import type { DocumentGraph } from '../graph/nodes.js';
import type { DocumentResolver } from '../resolver/document-resolver.js';
import { computeDocumentHash, type TokenCacheSnapshot } from './cache.js';
import { flattenTokens } from './flatten.js';
import { createMetadataSnapshot, createResolutionSnapshot } from './snapshots.js';

const EMPTY_DIAGNOSTICS: readonly DiagnosticEvent[] = Object.freeze([]);
const EMPTY_PIPELINE_DIAGNOSTICS: PipelineDiagnostics = Object.freeze({
  events: EMPTY_DIAGNOSTICS
});

export interface TokenFlatteningAdapterOptions {
  readonly metadataSnapshot?: typeof createMetadataSnapshot;
  readonly resolutionSnapshot?: typeof createResolutionSnapshot;
  readonly flattenTokens?: typeof flattenTokens;
  readonly clock?: () => number;
}

export class TokenFlatteningAdapter implements TokenFlatteningService<
  DocumentResolver,
  DocumentGraph,
  TokenCacheSnapshot
> {
  readonly flattener: TokenFlatteningPort<DocumentResolver, DocumentGraph, TokenCacheSnapshot>;
  readonly #metadataSnapshot: typeof createMetadataSnapshot;
  readonly #resolutionSnapshot: typeof createResolutionSnapshot;
  readonly #flattenTokens: typeof flattenTokens;
  readonly #clock: () => number;

  constructor(options: TokenFlatteningAdapterOptions = {}) {
    this.#metadataSnapshot = options.metadataSnapshot ?? createMetadataSnapshot;
    this.#resolutionSnapshot = options.resolutionSnapshot ?? createResolutionSnapshot;
    this.#flattenTokens = options.flattenTokens ?? flattenTokens;
    this.#clock = options.clock ?? Date.now;
    this.flattener = {
      flatten: (request) => this.flatten(request)
    } satisfies TokenFlatteningPort<DocumentResolver, DocumentGraph, TokenCacheSnapshot>;
  }

  flatten(request: TokenFlatteningRequest<DocumentGraph, DocumentResolver>): {
    outcome: TokenSnapshot<TokenCacheSnapshot>;
    diagnostics: PipelineDiagnostics;
  } {
    const { document, graph, resolution, documentHash, flatten } = request;

    const metadataIndex = this.#metadataSnapshot(graph.graph);
    let resolutionIndex: TokenCacheSnapshot['resolutionIndex'];
    let flattenedTokens: TokenCacheSnapshot['flattened'];
    const resolutionDiagnostics: DiagnosticEvent[] = [];

    if (flatten) {
      resolutionIndex = this.#resolutionSnapshot(graph.graph, resolution.result, {
        onDiagnostic: (diagnostic) => {
          resolutionDiagnostics.push(diagnostic);
        }
      });
      flattenedTokens = this.#flattenTokens(graph.graph, resolutionIndex);
    }

    const snapshotDiagnostics =
      resolutionDiagnostics.length > 0
        ? Object.freeze(resolutionDiagnostics.slice())
        : EMPTY_DIAGNOSTICS;
    const entryDiagnostics = snapshotDiagnostics.length > 0 ? snapshotDiagnostics : undefined;

    const entry: TokenCacheSnapshot = {
      documentHash: documentHash ?? computeDocumentHash(document),
      flattened: flatten ? (flattenedTokens ?? []) : undefined,
      metadataIndex,
      resolutionIndex: flatten ? resolutionIndex : undefined,
      diagnostics: entryDiagnostics,
      timestamp: this.#clock()
    } satisfies TokenCacheSnapshot;

    const snapshot: TokenSnapshot<TokenCacheSnapshot> = {
      token: entry,
      diagnostics: snapshotDiagnostics
    } satisfies TokenSnapshot<TokenCacheSnapshot>;

    const diagnostics: PipelineDiagnostics = snapshotDiagnostics.length
      ? { events: snapshotDiagnostics }
      : EMPTY_PIPELINE_DIAGNOSTICS;

    return { outcome: snapshot, diagnostics };
  }
}
