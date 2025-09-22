import type { Diagnostic, JsonPointer, SourceSpan } from '../../types.js';
import type { DocumentAst, DocumentGraph, GraphNode } from '../nodes.js';
import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { JSON_POINTER_ROOT } from '../../utils/json-pointer.js';

export interface GraphBuilderResult {
  readonly graph?: DocumentGraph;
  readonly diagnostics: readonly Diagnostic[];
}

export interface GraphBuilderContext {
  readonly ast: DocumentAst;
  readonly diagnostics: Diagnostic[];
  readonly nodes: Map<JsonPointer, GraphNode>;
  readonly pendingReferences: PendingInternalReference[];
}

export interface PendingInternalReference {
  readonly fieldPointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly target: JsonPointer;
  readonly allowedKinds: readonly GraphNode['kind'][];
  readonly label: string;
}

const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);

export function createGraphBuilderContext(ast: DocumentAst): GraphBuilderContext {
  return {
    ast,
    diagnostics: [],
    nodes: new Map(),
    pendingReferences: []
  };
}

export function finalizeResult(
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

export function recordFailure(context: GraphBuilderContext, error: unknown): void {
  context.diagnostics.push({
    code: DiagnosticCodes.graph.FAILED,
    message: error instanceof Error ? error.message : 'Failed to build document graph.',
    severity: 'error',
    pointer: JSON_POINTER_ROOT
  });
}
