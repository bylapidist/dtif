import type { JsonPointer } from '../../domain/primitives.js';
import type { GraphOverrideNode } from '../../graph/nodes.js';
import type { ResolvedTokenTransformEntry } from '../../plugins/types.js';
import { toReadonlyContextMap } from '../../utils/context.js';
import { DEFAULT_MAX_DEPTH, EMPTY_TRANSFORM_ENTRIES } from './constants.js';

export function normalizeContext(
  context?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>
): ReadonlyMap<string, unknown> {
  return toReadonlyContextMap(context);
}

export function normalizeMaxDepth(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MAX_DEPTH;
  }

  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_MAX_DEPTH;
  }

  return value;
}

export function indexOverrides(
  overrides: readonly GraphOverrideNode[]
): ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]> {
  const mutable = new Map<JsonPointer, GraphOverrideNode[]>();

  for (const override of overrides) {
    const pointer = override.token.value.pointer;
    const list = mutable.get(pointer);
    if (list) {
      list.push(override);
    } else {
      mutable.set(pointer, [override]);
    }
  }

  const result = new Map<JsonPointer, readonly GraphOverrideNode[]>();
  for (const [pointer, list] of mutable.entries()) {
    result.set(pointer, Object.freeze(list.slice()));
  }

  return result;
}

export function normalizeTransforms(
  transforms: readonly ResolvedTokenTransformEntry[] | undefined
): readonly ResolvedTokenTransformEntry[] {
  return transforms && transforms.length > 0
    ? Object.freeze(Array.from(transforms))
    : EMPTY_TRANSFORM_ENTRIES;
}
