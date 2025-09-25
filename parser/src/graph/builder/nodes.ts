import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { splitJsonPointer } from '../../utils/json-pointer.js';
import type { JsonPointer } from '../../types.js';
import type {
  DocumentChildNode,
  GraphCollectionNode,
  GraphNode,
  GraphNodeBase,
  GraphTokenNode
} from '../nodes.js';
import type { GraphBuilderContext } from './context.js';
import { createReferenceField, NON_COLLECTION_NODE_KINDS } from './references.js';
import type { GraphAliasNode } from '../nodes.js';

const EMPTY_POINTERS: readonly JsonPointer[] = Object.freeze([]);

export function buildNodes(
  context: GraphBuilderContext,
  children: readonly DocumentChildNode[],
  parentPointer: JsonPointer
): readonly JsonPointer[] {
  if (children.length === 0) {
    return EMPTY_POINTERS;
  }

  const childPointers: JsonPointer[] = [];

  for (const child of children) {
    const node = createGraphNode(context, child, parentPointer);
    if (node) {
      childPointers.push(node.pointer);
    }
  }

  return childPointers.length === 0 ? EMPTY_POINTERS : Object.freeze(childPointers);
}

export function createGraphNode(
  context: GraphBuilderContext,
  child: DocumentChildNode,
  parentPointer: JsonPointer
): GraphNode | undefined {
  if (context.nodes.has(child.pointer)) {
    context.diagnostics.push({
      code: DiagnosticCodes.graph.DUPLICATE_POINTER,
      message: `Duplicate node pointer "${child.pointer}" detected.`,
      severity: 'error',
      pointer: child.pointer,
      span: child.span
    });
    return undefined;
  }

  let node: GraphNode | undefined;

  switch (child.kind) {
    case 'collection': {
      const base = createBaseNode(child, parentPointer);
      node = createCollectionNode(context, child, base);
      break;
    }
    case 'token': {
      const base = createBaseNode(child, parentPointer);
      node = createTokenNode(child, base);
      break;
    }
    case 'alias': {
      const base = createBaseNode(child, parentPointer);
      node = createAliasNode(context, child, base);
      break;
    }
  }

  if (node) {
    context.nodes.set(node.pointer, node);
  }

  return node;
}

function createBaseNode<TKind extends DocumentChildNode['kind']>(
  child: Extract<DocumentChildNode, { kind: TKind }>,
  parentPointer: JsonPointer
): GraphNodeBase & { readonly kind: TKind } {
  const pathSegments = splitJsonPointer(child.pointer);
  const path = Object.freeze([...pathSegments]);

  const base = {
    kind: child.kind,
    name: child.name,
    pointer: child.pointer,
    span: child.span,
    path,
    parent: parentPointer,
    metadata: child.metadata
  } satisfies GraphNodeBase & { readonly kind: TKind };

  return Object.freeze(base);
}

function createCollectionNode(
  context: GraphBuilderContext,
  collection: DocumentChildNode & { kind: 'collection' },
  base: GraphNodeBase & { readonly kind: 'collection' }
): GraphCollectionNode {
  const children = buildNodes(context, collection.children, collection.pointer);
  return Object.freeze({ ...base, children });
}

function createTokenNode(
  token: DocumentChildNode & { kind: 'token' },
  base: GraphNodeBase & { readonly kind: 'token' }
): GraphTokenNode {
  return Object.freeze({
    ...base,
    type: token.type,
    value: token.value
  });
}

function createAliasNode(
  context: GraphBuilderContext,
  alias: DocumentChildNode & { kind: 'alias' },
  base: GraphNodeBase & { readonly kind: 'alias' }
): GraphAliasNode | undefined {
  const ref = createReferenceField(context, alias.ref, 'alias $ref', NON_COLLECTION_NODE_KINDS);

  if (!ref) {
    return undefined;
  }

  return Object.freeze({
    ...base,
    type: alias.type,
    ref
  });
}
