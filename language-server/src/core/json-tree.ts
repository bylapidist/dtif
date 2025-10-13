import type { Node as JsonNode } from 'jsonc-parser';

export function getStringProperty(node: JsonNode | undefined, name: string): string | undefined {
  if (node?.type !== 'object') {
    return undefined;
  }

  const { children } = node;
  if (!children) {
    return undefined;
  }

  for (const property of children) {
    const keyNode = property.children?.[0];
    const valueNode = property.children?.[1];

    if (!keyNode || typeof keyNode.value !== 'string' || keyNode.value !== name) {
      continue;
    }

    if (valueNode?.type === 'string' && typeof valueNode.value === 'string') {
      return valueNode.value;
    }
  }

  return undefined;
}
