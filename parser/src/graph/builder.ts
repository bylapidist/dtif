import { DiagnosticCodes } from '../diagnostics/codes.js';
import { JSON_POINTER_ROOT, normalizeJsonPointer, splitJsonPointer } from '../utils/json-pointer.js';
import { isJsonPointer } from '../utils/json-pointer.js';
import type { Diagnostic, JsonPointer, SourceSpan } from '../types.js';
import type {
  DocumentAst,
  DocumentChildNode,
  DocumentGraph,
  GraphAliasNode,
  GraphCollectionNode,
  GraphNode,
  GraphNodeBase,
  GraphOverrideFallbackNode,
  GraphOverrideNode,
  GraphReferenceField,
  GraphReferenceTarget,
  GraphTokenNode
} from './nodes.js';
import type { AstField, OverrideFallbackNode, OverrideNode } from '../ast/nodes.js';

export interface GraphBuilderResult {
  readonly graph?: DocumentGraph;
  readonly diagnostics: readonly Diagnostic[];
}

interface GraphBuilderContext {
  readonly ast: DocumentAst;
  readonly diagnostics: Diagnostic[];
  readonly nodes: Map<JsonPointer, GraphNode>;
  readonly pendingReferences: PendingInternalReference[];
}

interface PendingInternalReference {
  readonly fieldPointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly target: JsonPointer;
  readonly allowedKinds: readonly GraphNode['kind'][];
  readonly label: string;
}

const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);
const EMPTY_POINTERS: readonly JsonPointer[] = Object.freeze([]);
const EMPTY_OVERRIDES: readonly GraphOverrideNode[] = Object.freeze([]);

const NON_COLLECTION_NODE_KINDS: readonly GraphNode['kind'][] = Object.freeze(['token', 'alias']);

export function buildDocumentGraph(ast: DocumentAst): GraphBuilderResult {
  const context: GraphBuilderContext = {
    ast,
    diagnostics: [],
    nodes: new Map(),
    pendingReferences: []
  };

  try {
    const rootPointers = buildNodes(context, ast.children, ast.pointer);
    const overrides = buildOverrides(context, ast.overrides);
    validatePendingReferences(context);
    const graph = finalizeGraph(context, rootPointers, overrides);
    return finalizeResult(context, graph);
  } catch (error) {
    context.diagnostics.push({
      code: DiagnosticCodes.graph.FAILED,
      message: error instanceof Error ? error.message : 'Failed to build document graph.',
      severity: 'error',
      pointer: JSON_POINTER_ROOT
    });
    return finalizeResult(context, undefined);
  }
}

function buildNodes(
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

function createGraphNode(
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

function createBaseNode<TKind extends GraphNode['kind']>(
  child: Extract<DocumentChildNode, { kind: TKind }>,
  parentPointer: JsonPointer
): GraphNodeBase & { readonly kind: TKind } {
  const base: GraphNodeBase & { readonly kind: TKind } = Object.freeze({
    kind: child.kind,
    name: child.name,
    pointer: child.pointer,
    span: child.span,
    path: Object.freeze(splitJsonPointer(child.pointer)),
    parent: parentPointer,
    metadata: child.metadata
  });

  return base;
}

function createCollectionNode(
  context: GraphBuilderContext,
  collection: DocumentChildNode & { kind: 'collection' },
  base: GraphNodeBase & { readonly kind: 'collection' }
): GraphCollectionNode {
  const children = buildNodes(context, collection.children, collection.pointer);
  const node: GraphCollectionNode = Object.freeze({ ...base, children });
  return node;
}

function createTokenNode(
  token: DocumentChildNode & { kind: 'token' },
  base: GraphNodeBase & { readonly kind: 'token' }
): GraphTokenNode {
  const node: GraphTokenNode = Object.freeze({
    ...base,
    type: token.type,
    value: token.value
  });
  return node;
}

function createAliasNode(
  context: GraphBuilderContext,
  alias: DocumentChildNode & { kind: 'alias' },
  base: GraphNodeBase & { readonly kind: 'alias' }
): GraphAliasNode | undefined {
  const ref = createReferenceField(
    context,
    alias.ref,
    'alias $ref',
    NON_COLLECTION_NODE_KINDS
  );

  if (!ref) {
    return undefined;
  }

  const node: GraphAliasNode = Object.freeze({
    ...base,
    type: alias.type,
    ref
  });
  return node;
}

function buildOverrides(
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

  const node: GraphOverrideNode = Object.freeze({
    kind: 'override',
    pointer: override.pointer,
    span: override.span,
    token: tokenRef,
    when: override.when,
    ref,
    value: override.value,
    fallback
  });

  return node;
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

  const node: GraphOverrideFallbackNode = Object.freeze({
    kind: 'fallback',
    pointer: fallback.pointer,
    span: fallback.span,
    ref,
    value: fallback.value,
    fallback: nested
  });

  return node;
}

function createReferenceField(
  context: GraphBuilderContext,
  field: AstField<string> | undefined,
  label: string,
  allowedKinds: readonly GraphNode['kind'][]
): GraphReferenceField | undefined {
  if (!field) {
    return undefined;
  }

  const target = resolveReferenceTarget(context, field, label);
  if (!target) {
    return undefined;
  }

  if (!target.external) {
    context.pendingReferences.push({
      fieldPointer: field.pointer,
      span: field.span,
      target: target.pointer,
      allowedKinds,
      label
    });
  }

  return Object.freeze({
    value: target,
    pointer: field.pointer,
    span: field.span
  });
}

function resolveReferenceTarget(
  context: GraphBuilderContext,
  field: AstField<string>,
  label: string
): GraphReferenceTarget | undefined {
  const raw = field.value;
  let resolved: URL;

  try {
    resolved = new URL(raw, context.ast.uri);
  } catch (error) {
    context.diagnostics.push({
      code: DiagnosticCodes.graph.INVALID_REFERENCE,
      message: `${label} "${raw}" is not a valid URL or JSON Pointer.`,
      severity: 'error',
      pointer: field.pointer,
      span: field.span
    });
    return undefined;
  }

  const fragment = resolved.hash ?? '';
  const pointerValue = fragment.length === 0 ? JSON_POINTER_ROOT : fragment;

  if (!isJsonPointer(pointerValue)) {
    context.diagnostics.push({
      code: DiagnosticCodes.graph.INVALID_REFERENCE,
      message: `${label} "${raw}" does not resolve to a valid JSON Pointer.`,
      severity: 'error',
      pointer: field.pointer,
      span: field.span
    });
    return undefined;
  }

  const pointer = normalizeJsonPointer(pointerValue);
  const targetUri = new URL(resolved.href);
  targetUri.hash = '';
  const external = targetUri.href !== context.ast.uri.href;

  const target: GraphReferenceTarget = Object.freeze({
    uri: targetUri,
    pointer,
    external
  });

  return target;
}

function validatePendingReferences(context: GraphBuilderContext): void {
  for (const reference of context.pendingReferences) {
    const target = context.nodes.get(reference.target);
    if (!target) {
      context.diagnostics.push({
        code: DiagnosticCodes.graph.MISSING_TARGET,
        message: `${reference.label} target "${reference.target}" does not exist in the document.`,
      severity: 'error',
        pointer: reference.fieldPointer,
        span: reference.span
      });
      continue;
    }

    if (!reference.allowedKinds.includes(target.kind)) {
      const expected = reference.allowedKinds.join(' or ');
      context.diagnostics.push({
        code: DiagnosticCodes.graph.INVALID_TARGET_KIND,
        message: `${reference.label} target "${reference.target}" is a ${target.kind} node but expected ${expected}.`,
      severity: 'error',
        pointer: reference.fieldPointer,
        span: reference.span
      });
    }
  }
}

function finalizeGraph(
  context: GraphBuilderContext,
  rootPointers: readonly JsonPointer[],
  overrides: readonly GraphOverrideNode[]
): DocumentGraph {
  const nodes = new Map(context.nodes);
  const graph: DocumentGraph = Object.freeze({
    kind: 'document-graph',
    uri: context.ast.uri,
    ast: context.ast,
    nodes,
    rootPointers,
    overrides
  });
  return graph;
}

function finalizeResult(
  context: GraphBuilderContext,
  graph: DocumentGraph | undefined
): GraphBuilderResult {
  const diagnostics =
    context.diagnostics.length === 0
      ? EMPTY_DIAGNOSTICS
      : Object.freeze(context.diagnostics.map((diagnostic) => Object.freeze(diagnostic)));

  return {
    graph,
    diagnostics
  };
}
