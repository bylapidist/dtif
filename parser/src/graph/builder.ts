import type { DocumentAst, DocumentGraph, GraphOverrideNode } from './nodes.js';
import type { JsonPointer } from '../domain/primitives.js';
import {
  createGraphBuilderContext,
  finalizeResult,
  recordFailure,
  type GraphBuilderContext,
  type GraphBuilderResult
} from './builder/context.js';
import { buildNodes } from './builder/nodes.js';
import { buildOverrides } from './builder/overrides.js';
import { validatePendingReferences } from './builder/references.js';

export type { GraphBuilderResult } from './builder/context.js';

export function buildDocumentGraph(ast: DocumentAst): GraphBuilderResult {
  const context = createGraphBuilderContext(ast);

  try {
    const rootPointers = buildNodes(context, ast.children, ast.pointer);
    const overrides = buildOverrides(context, ast.overrides);
    validatePendingReferences(context);
    const graph = createDocumentGraph(context, rootPointers, overrides);
    return finalizeResult(context, graph);
  } catch (error) {
    recordFailure(context, error);
    return finalizeResult(context, undefined);
  }
}

function createDocumentGraph(
  context: GraphBuilderContext,
  rootPointers: readonly JsonPointer[],
  overrides: readonly GraphOverrideNode[]
): DocumentGraph {
  const nodes = new Map(context.nodes);
  return Object.freeze({
    kind: 'document-graph',
    uri: context.ast.uri,
    ast: context.ast,
    nodes,
    rootPointers,
    overrides
  });
}
