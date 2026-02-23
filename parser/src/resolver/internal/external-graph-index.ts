import type { JsonPointer } from '../../domain/primitives.js';
import type { DocumentGraph, GraphOverrideNode } from '../../graph/nodes.js';
import type { ExternalGraphInput } from '../types.js';

export type OverridesByGraph = ReadonlyMap<
  string,
  ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]>
>;

export function normalizeExternalGraphs(
  rootGraph: DocumentGraph,
  externalGraphs?: ExternalGraphInput
): ReadonlyMap<string, DocumentGraph> {
  const graphs = new Map<string, DocumentGraph>();
  graphs.set(rootGraph.uri.href, rootGraph);

  if (!externalGraphs) {
    return graphs;
  }

  if (isExternalGraphMap(externalGraphs)) {
    for (const [key, graph] of externalGraphs.entries()) {
      if (!isDocumentGraph(graph)) {
        continue;
      }
      const href = key instanceof URL ? key.href : key;
      graphs.set(href, graph);
      graphs.set(graph.uri.href, graph);
    }
    return graphs;
  }

  for (const href in externalGraphs) {
    const graph = externalGraphs[href];
    if (!isDocumentGraph(graph)) {
      continue;
    }
    graphs.set(href, graph);
    graphs.set(graph.uri.href, graph);
  }

  return graphs;
}

export function indexOverridesByGraph(
  graphs: ReadonlyMap<string, DocumentGraph>
): OverridesByGraph {
  const overridesByGraph = new Map<string, Map<JsonPointer, GraphOverrideNode[]>>();
  const seen = new Set<string>();
  const uniqueGraphs: DocumentGraph[] = [];

  for (const graph of graphs.values()) {
    if (seen.has(graph.uri.href)) {
      continue;
    }
    seen.add(graph.uri.href);
    overridesByGraph.set(graph.uri.href, new Map());
    uniqueGraphs.push(graph);
  }

  for (const graph of uniqueGraphs) {
    for (const override of graph.overrides) {
      const targetUri = override.token.value.uri.href;
      const pointer = override.token.value.pointer;
      const targetMap = overridesByGraph.get(targetUri);
      if (!targetMap) {
        continue;
      }

      const list = targetMap.get(pointer);
      if (list) {
        list.push(override);
      } else {
        targetMap.set(pointer, [override]);
      }
    }
  }

  const immutable = new Map<string, ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]>>();
  for (const [uri, pointerMap] of overridesByGraph.entries()) {
    const frozenPointers = new Map<JsonPointer, readonly GraphOverrideNode[]>();
    for (const [pointer, list] of pointerMap.entries()) {
      frozenPointers.set(pointer, Object.freeze(list.slice()));
    }
    immutable.set(uri, frozenPointers);
  }

  return immutable;
}

function isExternalGraphMap(
  value: ExternalGraphInput
): value is ReadonlyMap<string | URL, DocumentGraph> {
  return value instanceof Map;
}

function isDocumentGraph(value: unknown): value is DocumentGraph {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (!('kind' in value) || !('uri' in value)) {
    return false;
  }

  const kind = Reflect.get(value, 'kind');
  const uri = Reflect.get(value, 'uri');
  return kind === 'document-graph' && uri instanceof URL;
}
