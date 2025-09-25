import { normalizeJsonPointer } from '../../utils/json-pointer.js';
import type {
  DocumentGraph,
  GraphAliasNode,
  GraphNode,
  GraphTokenNode
} from '../../graph/nodes.js';
import type { TokenId } from '../types.js';

export function isTokenLikeNode(node: GraphNode): node is GraphTokenNode | GraphAliasNode {
  return node.kind === 'token' || node.kind === 'alias';
}

export function iterateTokenNodes(
  graph: DocumentGraph
): IterableIterator<GraphTokenNode | GraphAliasNode> {
  return (function* () {
    for (const node of graph.nodes.values()) {
      if (isTokenLikeNode(node)) {
        yield node;
      }
    }
  })();
}

export function getTokenId(pointer: string): TokenId {
  return normalizeJsonPointer(pointer);
}

export function getBaseType(node: GraphTokenNode | GraphAliasNode): string | undefined {
  if (node.kind === 'alias') {
    return node.type.value;
  }
  return node.type?.value;
}

export function getBaseValue(node: GraphTokenNode | GraphAliasNode): unknown {
  if (node.kind === 'alias') {
    return undefined;
  }
  return node.value?.value;
}
