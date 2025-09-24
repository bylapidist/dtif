import type { DocumentGraph } from '../graph/nodes.js';
import { getBaseType, getBaseValue, getTokenId, iterateTokenNodes } from './internal/graph.js';
import { toPlainJson } from './internal/utils.js';
import type { DtifFlattenedToken, ResolvedTokenView, TokenId } from './types.js';

export function flattenTokens(
  graph: DocumentGraph,
  resolutionIndex: ReadonlyMap<TokenId, ResolvedTokenView>
): DtifFlattenedToken[] {
  const nodes = Array.from(iterateTokenNodes(graph));
  nodes.sort((left, right) => left.pointer.localeCompare(right.pointer));

  const flattened: DtifFlattenedToken[] = [];

  for (const node of nodes) {
    const id = getTokenId(node.pointer);
    const resolution = resolutionIndex.get(id);
    const baseType = getBaseType(node);
    const baseValue = toPlainJson(getBaseValue(node));

    flattened.push({
      id,
      pointer: id,
      name: node.name,
      path: node.path,
      type: resolution?.type ?? baseType,
      value: resolution?.value ?? baseValue,
      raw: baseValue
    });
  }

  return flattened;
}
