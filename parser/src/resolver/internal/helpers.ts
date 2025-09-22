import { DiagnosticCodes } from '../../diagnostics/codes.js';
import type { AstField } from '../../ast/nodes.js';
import type { Diagnostic, JsonPointer, SourceSpan } from '../../types.js';
import type { GraphReferenceTarget } from '../../graph/nodes.js';
import type { DiagnosticBag } from '../../diagnostics/bag.js';
import {
  EMPTY_DIAGNOSTICS,
  EMPTY_TRANSFORM_EVALUATIONS
} from './constants.js';
import type { ResolutionResult, ResolvedToken } from '../types.js';
import type { ResolutionSource, ResolutionTraceStep } from '../types.js';
import type { ResolvedTokenTransformEvaluation } from '../../plugins/index.js';

export function finalizeResolution(
  token: ResolvedToken | undefined,
  diagnostics: DiagnosticBag,
  transforms: readonly ResolvedTokenTransformEvaluation[] = EMPTY_TRANSFORM_EVALUATIONS
): ResolutionResult {
  const diagnosticArray = diagnostics.toArray();
  return {
    token,
    diagnostics: diagnosticArray.length === 0 ? EMPTY_DIAGNOSTICS : diagnosticArray,
    transforms: transforms.length === 0 ? EMPTY_TRANSFORM_EVALUATIONS : transforms
  };
}

export function freezeResultDiagnostics(list?: readonly Diagnostic[]): readonly Diagnostic[] {
  if (!list || list.length === 0) {
    return EMPTY_DIAGNOSTICS;
  }
  return Object.freeze(Array.from(list));
}

export function createTransformFailureDiagnostic(
  plugin: string,
  pointer: JsonPointer,
  error: unknown
): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: DiagnosticCodes.plugins.RESOLUTION_FAILED,
    message: `Plugin "${plugin}" failed to transform resolved token: ${message}`,
    severity: 'error',
    pointer
  };
}

export function createTraceStep(
  pointer: JsonPointer,
  kind: ResolutionTraceStep['kind'],
  span?: SourceSpan
): ResolutionTraceStep {
  return Object.freeze({ pointer, kind, span });
}

export function createFieldSource(field: AstField<unknown>, uri: URL): ResolutionSource {
  return Object.freeze({
    uri,
    pointer: field.pointer,
    span: field.span
  });
}

export function createTargetSource(target: GraphReferenceTarget, span?: SourceSpan): ResolutionSource {
  return Object.freeze({
    uri: target.uri,
    pointer: target.pointer,
    span
  });
}

export function mergeDiagnostics(
  first: readonly Diagnostic[] | undefined,
  second: readonly Diagnostic[] | undefined
): readonly Diagnostic[] {
  const merged = [...(first ?? EMPTY_DIAGNOSTICS), ...(second ?? EMPTY_DIAGNOSTICS)];
  return merged.length === 0 ? EMPTY_DIAGNOSTICS : Object.freeze(merged);
}

export function conditionMatches(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return expected.some((value) => Object.is(value, actual));
  }

  return Object.is(expected, actual);
}
