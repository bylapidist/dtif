import type { Diagnostic } from '../../types.js';
import type { AppliedOverride } from '../types.js';
import type { ResolutionTraceStep } from '../types.js';
import type {
  ResolvedTokenTransformEntry,
  ResolvedTokenTransformEvaluation
} from '../../plugins/index.js';

export const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);
export const EMPTY_OVERRIDES: readonly AppliedOverride[] = Object.freeze([]);
export const EMPTY_TRACE: readonly ResolutionTraceStep[] = Object.freeze([]);
export const EMPTY_WARNINGS: readonly Diagnostic[] = Object.freeze([]);
export const EMPTY_TRANSFORM_EVALUATIONS: readonly ResolvedTokenTransformEvaluation[] =
  Object.freeze([]);
export const EMPTY_TRANSFORM_ENTRIES: readonly ResolvedTokenTransformEntry[] = Object.freeze([]);
export const DEFAULT_MAX_DEPTH = 32;
