import type { DiagnosticEvent } from '../../domain/models.js';
import type { JsonPointer } from '../../domain/primitives.js';
import type { AppliedOverride, ResolutionSource, ResolutionTraceStep } from '../types.js';

export interface ResolutionState {
  readonly pointer: JsonPointer;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overrides: readonly AppliedOverride[];
  readonly warnings: readonly DiagnosticEvent[];
  readonly trace: readonly ResolutionTraceStep[];
}

export interface OverrideEvaluation {
  readonly matched: boolean;
  readonly state?: OverrideState;
  readonly diagnostics: readonly DiagnosticEvent[];
}

export interface OverrideState {
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overrides: readonly AppliedOverride[];
  readonly warnings: readonly DiagnosticEvent[];
  readonly trace: readonly ResolutionTraceStep[];
}
