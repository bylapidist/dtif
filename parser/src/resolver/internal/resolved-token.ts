import type { DiagnosticEvent } from '../../domain/models.js';
import type { JsonPointer } from '../../domain/primitives.js';
import type {
  ResolutionSource,
  AppliedOverride,
  ResolutionTraceStep,
  ResolvedToken
} from '../types.js';
import { EMPTY_OVERRIDES, EMPTY_TRACE, EMPTY_WARNINGS } from './constants.js';

export class ResolvedTokenImpl implements ResolvedToken {
  readonly pointer: JsonPointer;
  readonly uri: URL;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overridesApplied: readonly AppliedOverride[];
  readonly warnings: readonly DiagnosticEvent[];
  readonly trace: readonly ResolutionTraceStep[];

  constructor(init: {
    pointer: JsonPointer;
    uri: URL;
    type?: string;
    value?: unknown;
    source?: ResolutionSource;
    overrides: readonly AppliedOverride[];
    warnings: readonly DiagnosticEvent[];
    trace: readonly ResolutionTraceStep[];
  }) {
    this.pointer = init.pointer;
    this.uri = init.uri;
    this.type = init.type;
    this.value = init.value;
    this.source = init.source;
    this.overridesApplied =
      init.overrides.length === 0 ? EMPTY_OVERRIDES : Object.freeze([...init.overrides]);
    this.warnings = init.warnings.length === 0 ? EMPTY_WARNINGS : Object.freeze([...init.warnings]);
    this.trace = init.trace.length === 0 ? EMPTY_TRACE : Object.freeze([...init.trace]);
  }

  toJSON(): unknown {
    return this.value;
  }
}
