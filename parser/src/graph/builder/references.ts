import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { JSON_POINTER_ROOT, normalizeJsonPointer, isJsonPointer } from '../../utils/json-pointer.js';
import type { AstField } from '../../ast/nodes.js';
import type { GraphReferenceField, GraphReferenceTarget, GraphNode } from '../nodes.js';
import type { GraphBuilderContext } from './context.js';

export const NON_COLLECTION_NODE_KINDS: readonly GraphNode['kind'][] = Object.freeze(['token', 'alias']);

export function createReferenceField(
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

export function validatePendingReferences(context: GraphBuilderContext): void {
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

  return Object.freeze({
    uri: targetUri,
    pointer,
    external
  });
}
