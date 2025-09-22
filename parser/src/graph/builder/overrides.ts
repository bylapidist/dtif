import type { OverrideFallbackNode, OverrideNode } from '../../ast/nodes.js';
import type { GraphOverrideFallbackNode, GraphOverrideNode } from '../nodes.js';
import type { GraphBuilderContext } from './context.js';
import { createReferenceField, NON_COLLECTION_NODE_KINDS } from './references.js';

const EMPTY_OVERRIDES: readonly GraphOverrideNode[] = Object.freeze([]);

export function buildOverrides(
  context: GraphBuilderContext,
  overrides: readonly OverrideNode[]
): readonly GraphOverrideNode[] {
  if (overrides.length === 0) {
    return EMPTY_OVERRIDES;
  }

  const result: GraphOverrideNode[] = [];

  for (const override of overrides) {
    const node = createOverrideNode(context, override);
    if (node) {
      result.push(node);
    }
  }

  return result.length === 0 ? EMPTY_OVERRIDES : Object.freeze(result);
}

function createOverrideNode(
  context: GraphBuilderContext,
  override: OverrideNode
): GraphOverrideNode | undefined {
  const tokenRef = createReferenceField(
    context,
    override.token,
    'override $token',
    NON_COLLECTION_NODE_KINDS
  );

  if (!tokenRef) {
    return undefined;
  }

  const ref = createReferenceField(
    context,
    override.ref,
    'override $ref',
    NON_COLLECTION_NODE_KINDS
  );
  const fallback = buildFallbackChain(context, override.fallback);

  return Object.freeze({
    kind: 'override',
    pointer: override.pointer,
    span: override.span,
    token: tokenRef,
    when: override.when,
    ref,
    value: override.value,
    fallback
  });
}

function buildFallbackChain(
  context: GraphBuilderContext,
  fallback: readonly OverrideFallbackNode[] | undefined
): readonly GraphOverrideFallbackNode[] | undefined {
  if (!fallback || fallback.length === 0) {
    return undefined;
  }

  const nodes: GraphOverrideFallbackNode[] = [];

  for (const entry of fallback) {
    const node = createFallbackNode(context, entry);
    if (node) {
      nodes.push(node);
    }
  }

  return nodes.length === 0 ? undefined : Object.freeze(nodes);
}

function createFallbackNode(
  context: GraphBuilderContext,
  fallback: OverrideFallbackNode
): GraphOverrideFallbackNode | undefined {
  const ref = createReferenceField(
    context,
    fallback.ref,
    'fallback $ref',
    NON_COLLECTION_NODE_KINDS
  );
  const nested = buildFallbackChain(context, fallback.fallback);

  if (!ref && !fallback.value) {
    return undefined;
  }

  return Object.freeze({
    kind: 'fallback',
    pointer: fallback.pointer,
    span: fallback.span,
    ref,
    value: fallback.value,
    fallback: nested
  });
}
