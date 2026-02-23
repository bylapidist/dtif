import { DiagnosticCodes } from '../diagnostics/codes.js';
import { normalizeDocument } from '../ast/normaliser.js';
import { buildDocumentGraph } from '../graph/builder.js';
import { decodeDocument } from '../io/decoder.js';
import { DocumentLoaderError, type DocumentLoader } from '../io/document-loader.js';
import type { DiagnosticEvent } from '../domain/models.js';
import type { SchemaGuard } from '../validation/schema-guard.js';
import type { PluginRegistry } from '../plugins/index.js';
import type {
  DocumentGraph,
  GraphOverrideFallbackNode,
  GraphReferenceTarget
} from '../graph/nodes.js';

export interface ExternalGraphProviderRequest {
  readonly rootGraph: DocumentGraph;
  readonly targets: readonly GraphReferenceTarget[];
  readonly baseUri: URL;
}

export interface ExternalGraphProviderResult {
  readonly graphs: ReadonlyMap<string, DocumentGraph>;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface ExternalGraphProvider {
  load(request: ExternalGraphProviderRequest): Promise<ExternalGraphProviderResult>;
}

export interface DefaultExternalGraphProviderOptions {
  readonly loader: DocumentLoader;
  readonly schemaGuard: SchemaGuard;
  readonly extensions?: PluginRegistry;
  readonly allowNetworkReferences?: boolean;
}

export class DefaultExternalGraphProvider implements ExternalGraphProvider {
  readonly #loader: DocumentLoader;
  readonly #schemaGuard: SchemaGuard;
  readonly #extensions?: PluginRegistry;
  readonly #allowNetworkReferences: boolean;

  constructor(options: DefaultExternalGraphProviderOptions) {
    this.#loader = options.loader;
    this.#schemaGuard = options.schemaGuard;
    this.#extensions = options.extensions;
    this.#allowNetworkReferences = options.allowNetworkReferences ?? false;
  }

  async load(request: ExternalGraphProviderRequest): Promise<ExternalGraphProviderResult> {
    const graphs = new Map<string, DocumentGraph>();
    const diagnostics: DiagnosticEvent[] = [];
    const queue = [...request.targets];
    const visited = new Set<string>([request.rootGraph.uri.href]);

    while (queue.length > 0) {
      const target = queue.shift();
      if (!target) {
        continue;
      }

      const href = target.uri.href;
      if (visited.has(href)) {
        continue;
      }
      visited.add(href);

      const protocol = target.uri.protocol.toLowerCase();
      const networkReference = protocol === 'http:' || protocol === 'https:';
      if (networkReference && !this.#allowNetworkReferences) {
        continue;
      }

      try {
        const handle = await this.#loader.load(target.uri, { baseUri: request.baseUri });
        const decoded = await decodeDocument(handle);
        const validation = this.#schemaGuard.validate(decoded);
        diagnostics.push(...validation.diagnostics);
        if (!validation.valid) {
          continue;
        }

        const normalized = normalizeDocument(decoded, { extensions: this.#extensions });
        diagnostics.push(...normalized.diagnostics);
        if (!normalized.ast) {
          continue;
        }

        const graphResult = buildDocumentGraph(normalized.ast);
        diagnostics.push(...graphResult.diagnostics);
        if (!graphResult.graph) {
          continue;
        }

        const loadedGraph = graphResult.graph;
        graphs.set(loadedGraph.uri.href, loadedGraph);
        const nestedTargets = collectExternalReferenceTargets(loadedGraph);
        for (const nested of nestedTargets) {
          if (!visited.has(nested.uri.href)) {
            queue.push(nested);
          }
        }
      } catch (error) {
        const code =
          error instanceof DocumentLoaderError
            ? DiagnosticCodes.loader.TOO_LARGE
            : DiagnosticCodes.resolver.EXTERNAL_REFERENCE;
        diagnostics.push({
          code,
          message:
            error instanceof Error
              ? error.message
              : `Failed to load external DTIF document "${href}".`,
          severity: 'error',
          pointer: target.pointer
        });
      }
    }

    return {
      graphs,
      diagnostics
    } satisfies ExternalGraphProviderResult;
  }
}

export function createExternalGraphProvider(
  options: DefaultExternalGraphProviderOptions
): ExternalGraphProvider {
  return new DefaultExternalGraphProvider(options);
}

export function collectExternalReferenceTargets(
  graph: DocumentGraph
): readonly GraphReferenceTarget[] {
  const targets: GraphReferenceTarget[] = [];

  for (const node of graph.nodes.values()) {
    if (node.kind === 'alias' && node.ref.value.external) {
      targets.push(node.ref.value);
    }
  }

  for (const override of graph.overrides) {
    if (override.token.value.external) {
      targets.push(override.token.value);
    }
    if (override.ref?.value.external) {
      targets.push(override.ref.value);
    }
    if (override.fallback) {
      collectExternalFallbackTargets(override.fallback, targets);
    }
  }

  return Object.freeze(targets);
}

function collectExternalFallbackTargets(
  entries: readonly GraphOverrideFallbackNode[],
  targets: GraphReferenceTarget[]
): void {
  for (const entry of entries) {
    if (entry.ref?.value.external) {
      targets.push(entry.ref.value);
    }
    if (entry.fallback && entry.fallback.length > 0) {
      collectExternalFallbackTargets(entry.fallback, targets);
    }
  }
}
