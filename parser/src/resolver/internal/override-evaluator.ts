import type { GraphOverrideNode } from '../../graph/nodes.js';
import { conditionMatches } from './helpers.js';

export function doesOverrideApply(
  override: GraphOverrideNode,
  context: ReadonlyMap<string, unknown>
): boolean {
  const conditions = override.when.value;
  let recognized = false;

  for (const [key, expected] of Object.entries(conditions)) {
    if (!context.has(key)) {
      continue;
    }

    recognized = true;
    const actual = context.get(key);
    if (!conditionMatches(expected, actual)) {
      return false;
    }
  }

  return recognized;
}
