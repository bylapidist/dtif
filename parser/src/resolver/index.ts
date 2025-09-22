import { DiagnosticCodes } from '../diagnostics/codes.js';
import { DiagnosticBag } from '../diagnostics/bag.js';
import { JSON_POINTER_ROOT, normalizeJsonPointer } from '../utils/json-pointer.js';
import type { Diagnostic, JsonPointer, RawDocument, SourceSpan } from '../types.js';
import type {
  DocumentGraph,
  GraphAliasNode,
  GraphNode,
  GraphOverrideFallbackNode,
  GraphOverrideNode,
  GraphReferenceTarget,
  GraphTokenNode
} from '../graph/nodes.js';
import type { AstField } from '../ast/nodes.js';
import type {
  ResolvedTokenTransformEntry,
  ResolvedTokenTransformEvaluation
} from '../plugins/index.js';

export interface DocumentResolverOptions {
  readonly context?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  readonly maxDepth?: number;
  readonly document?: RawDocument;
  readonly transforms?: readonly ResolvedTokenTransformEntry[];
}

export interface ResolutionResult {
  readonly token?: ResolvedToken;
  readonly diagnostics: readonly Diagnostic[];
  readonly transforms: readonly ResolvedTokenTransformEvaluation[];
}

export interface ResolutionSource {
  readonly uri: URL;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
}

export type AppliedOverrideKind =
  | 'override-ref'
  | 'override-value'
  | 'fallback-ref'
  | 'fallback-value';

export interface AppliedOverride {
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly kind: AppliedOverrideKind;
  readonly depth: number;
  readonly source?: ResolutionSource;
}

export type ResolutionTraceStepKind = 'token' | 'alias' | 'override' | 'fallback';

export interface ResolutionTraceStep {
  readonly pointer: JsonPointer;
  readonly kind: ResolutionTraceStepKind;
  readonly span?: SourceSpan;
}

export interface ResolvedToken {
  readonly pointer: JsonPointer;
  readonly uri: URL;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overridesApplied: readonly AppliedOverride[];
  readonly warnings: readonly Diagnostic[];
  readonly trace: readonly ResolutionTraceStep[];
  toJSON(): unknown;
}

interface ResolutionState {
  readonly pointer: JsonPointer;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overrides: readonly AppliedOverride[];
  readonly warnings: readonly Diagnostic[];
  readonly trace: readonly ResolutionTraceStep[];
}

interface OverrideEvaluation {
  readonly matched: boolean;
  readonly state?: OverrideState;
  readonly diagnostics: readonly Diagnostic[];
}

interface OverrideState {
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overrides: readonly AppliedOverride[];
  readonly warnings: readonly Diagnostic[];
  readonly trace: readonly ResolutionTraceStep[];
}

const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);
const EMPTY_OVERRIDES: readonly AppliedOverride[] = Object.freeze([]);
const EMPTY_TRACE: readonly ResolutionTraceStep[] = Object.freeze([]);
const EMPTY_WARNINGS: readonly Diagnostic[] = Object.freeze([]);
const EMPTY_TRANSFORM_EVALUATIONS: readonly ResolvedTokenTransformEvaluation[] = Object.freeze([]);
const EMPTY_TRANSFORM_ENTRIES: readonly ResolvedTokenTransformEntry[] = Object.freeze([]);
const DEFAULT_MAX_DEPTH = 32;

export class DocumentResolver {
  private readonly graph: DocumentGraph;
  private readonly context: ReadonlyMap<string, unknown>;
  private readonly overrides: ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]>;
  private readonly maxDepth: number;
  private readonly document?: RawDocument;
  private readonly transforms: readonly ResolvedTokenTransformEntry[];
  private readonly cache = new Map<JsonPointer, ResolutionState>();
  private readonly pending = new Set<JsonPointer>();

  constructor(graph: DocumentGraph, options: DocumentResolverOptions = {}) {
    this.graph = graph;
    this.context = normalizeContext(options.context);
    this.overrides = indexOverrides(graph.overrides);
    this.maxDepth = normalizeMaxDepth(options.maxDepth);
    this.document = options.document;
    this.transforms = options.transforms && options.transforms.length > 0
      ? Object.freeze(Array.from(options.transforms))
      : EMPTY_TRANSFORM_ENTRIES;
  }

  resolve(pointer: JsonPointer): ResolutionResult {
    const diagnostics = new DiagnosticBag();

    try {
      const normalized = normalizeJsonPointer(pointer);
      const state = this.resolveInternal(normalized, diagnostics, 0);
      if (!state) {
        return finalizeResolution(undefined, diagnostics);
      }

      const token = new ResolvedTokenImpl({
        pointer: normalized,
        uri: this.graph.uri,
        type: state.type,
        value: state.value,
        source: state.source,
        overrides: state.overrides,
        warnings: state.warnings,
        trace: state.trace
      });
      const transforms = this.applyTransforms(token, diagnostics);

      return finalizeResolution(token, diagnostics, transforms);
    } catch (error) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.FAILED,
        message: error instanceof Error ? error.message : 'Failed to resolve token.',
        severity: 'error',
        pointer
      });
      return finalizeResolution(undefined, diagnostics);
    }
  }

  private resolveInternal(
    pointer: JsonPointer,
    diagnostics: DiagnosticBag,
    depth: number
  ): ResolutionState | undefined {
    if (this.cache.has(pointer)) {
      return this.cache.get(pointer)!;
    }

    if (this.pending.has(pointer)) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.CYCLE_DETECTED,
        message: `Circular reference detected while resolving "${pointer}".`,
        severity: 'error',
        pointer
      });
      return undefined;
    }

    if (depth > this.maxDepth) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED,
        message: `Resolution depth exceeded maximum of ${this.maxDepth} while resolving "${pointer}".`,
        severity: 'error',
        pointer
      });
      return undefined;
    }

    const node = this.graph.nodes.get(pointer);

    if (!node) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.UNKNOWN_POINTER,
        message: `No token exists at pointer "${pointer}".`,
        severity: 'error',
        pointer
      });
      return undefined;
    }

    if (node.kind === 'collection') {
      diagnostics.add({
        code: DiagnosticCodes.resolver.INVALID_NODE_KIND,
        message: `Cannot resolve collection node at pointer "${pointer}".`,
        severity: 'error',
        pointer,
        span: node.span
      });
      return undefined;
    }

    this.pending.add(pointer);

    try {
      const base = this.resolveBaseNode(node, diagnostics, depth);
      if (!base) {
        return undefined;
      }

      const withOverrides = this.applyOverrides(node.pointer, base, diagnostics, depth);
      this.cache.set(pointer, withOverrides);
      return withOverrides;
    } finally {
      this.pending.delete(pointer);
    }
  }

  private resolveBaseNode(
    node: GraphNode,
    diagnostics: DiagnosticBag,
    depth: number
  ): ResolutionState | undefined {
    switch (node.kind) {
      case 'token':
        return this.resolveTokenNode(node, diagnostics);
      case 'alias':
        return this.resolveAliasNode(node, diagnostics, depth);
      default:
        return undefined;
    }
  }

  private resolveTokenNode(node: GraphTokenNode, diagnostics: DiagnosticBag): ResolutionState {
    const trace = Object.freeze([createTraceStep(node.pointer, 'token', node.span)]);
    const valueField = node.value;
    const warnings: Diagnostic[] = [];
    let source: ResolutionSource | undefined;
    let value: unknown;

    if (valueField) {
      value = valueField.value;
      source = createFieldSource(valueField, this.graph.uri);
    } else {
      diagnostics.add({
        code: DiagnosticCodes.resolver.MISSING_BASE_VALUE,
        message: `Token "${node.pointer}" does not declare a $value.`,
        severity: 'error',
        pointer: node.pointer,
        span: node.span
      });
      value = undefined;
    }

    return {
      pointer: node.pointer,
      type: node.type?.value,
      value,
      source,
      overrides: EMPTY_OVERRIDES,
      warnings: warnings.length === 0 ? EMPTY_WARNINGS : Object.freeze(warnings),
      trace
    };
  }

  private resolveAliasNode(
    node: GraphAliasNode,
    diagnostics: DiagnosticBag,
    depth: number
  ): ResolutionState | undefined {
    const tracePrefix = createTraceStep(node.pointer, 'alias', node.span);
    const target = node.ref.value;

    if (target.external) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
        message: `Alias "${node.pointer}" references external pointer "${target.uri.href}${target.pointer}" which is not yet supported.`,
        severity: 'error',
        pointer: node.pointer,
        span: node.ref.span
      });
      return {
        pointer: node.pointer,
        type: node.type.value,
        value: undefined,
        source: undefined,
        overrides: EMPTY_OVERRIDES,
        warnings: EMPTY_WARNINGS,
        trace: Object.freeze([tracePrefix])
      };
    }

    const targetState = this.resolveInternal(target.pointer, diagnostics, depth + 1);
    if (!targetState) {
      return {
        pointer: node.pointer,
        type: node.type.value,
        value: undefined,
        source: undefined,
        overrides: EMPTY_OVERRIDES,
        warnings: EMPTY_WARNINGS,
        trace: Object.freeze([tracePrefix])
      };
    }

    const type = node.type.value ?? targetState.type;

    if (type && targetState.type && type !== targetState.type) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH,
        message: `Alias "${node.pointer}" expects type "${type}" but target "${target.pointer}" resolved to type "${targetState.type}".`,
        severity: 'error',
        pointer: node.ref.pointer,
        span: node.ref.span,
        related: [
          {
            message: 'Target token resolved here.',
            pointer: target.pointer,
            span: targetState.source?.span
          }
        ]
      });
    }

    const trace = Object.freeze([tracePrefix, ...targetState.trace]);

    return {
      pointer: node.pointer,
      type,
      value: targetState.value,
      source: targetState.source,
      overrides: targetState.overrides,
      warnings: targetState.warnings,
      trace
    };
  }

  private applyOverrides(
    pointer: JsonPointer,
    base: ResolutionState,
    diagnostics: DiagnosticBag,
    depth: number
  ): ResolutionState {
    const overrides = this.overrides.get(pointer);
    if (!overrides || overrides.length === 0) {
      return base;
    }

    let matchedState: OverrideState | undefined;

    for (const override of overrides) {
      const evaluation = this.evaluateOverride(override, base, diagnostics, depth);
      for (const diagnostic of evaluation.diagnostics) {
        diagnostics.add(diagnostic);
      }
      if (evaluation.matched && evaluation.state) {
        matchedState = evaluation.state;
      }
    }

    if (!matchedState) {
      return base;
    }

    const prefix = base.trace.length > 0 ? base.trace[0] : createTraceStep(pointer, 'token');
    const trace = Object.freeze([prefix, ...matchedState.trace]);
    const type = base.type ?? matchedState.type;
    const warnings = mergeDiagnostics(base.warnings, matchedState.warnings);

    return {
      pointer: base.pointer,
      type,
      value: matchedState.value,
      source: matchedState.source ?? base.source,
      overrides: matchedState.overrides,
      warnings,
      trace
    };
  }

  private evaluateOverride(
    override: GraphOverrideNode,
    base: ResolutionState,
    diagnostics: DiagnosticBag,
    depth: number
  ): OverrideEvaluation {
    if (!this.doesOverrideApply(override)) {
      return { matched: false, diagnostics: EMPTY_DIAGNOSTICS };
    }

    if (override.token.value.external) {
      return {
        matched: true,
        diagnostics: [
          {
            code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
            message: `Override "$token" target "${override.token.value.uri.href}${override.token.value.pointer}" is external and not yet supported.`,
            severity: 'error',
            pointer: override.pointer,
            span: override.token.span
          }
        ]
      };
    }

    const traceSteps: ResolutionTraceStep[] = [createTraceStep(override.pointer, 'override', override.span)];
    const diagnosticsList: Diagnostic[] = [];
    let state: OverrideState | undefined;

    if (override.ref) {
      state = this.resolveOverrideRef(override, base, diagnosticsList, traceSteps, depth);
    }

    if (!state && override.value) {
      state = this.resolveOverrideValue(override, traceSteps);
    }

    if (!state && override.fallback) {
      state = this.resolveFallbackChain(override.fallback, base, diagnosticsList, 1, traceSteps, depth + 1);
    }

    if (!state) {
      diagnosticsList.push({
        code: DiagnosticCodes.resolver.OVERRIDE_FAILED,
        message: `Override "${override.pointer}" matched the current context but did not resolve to a value.`,
        severity: 'error',
        pointer: override.pointer,
        span: override.span
      });
    }

    return {
      matched: true,
      state,
      diagnostics: diagnosticsList.length === 0 ? EMPTY_DIAGNOSTICS : Object.freeze(diagnosticsList)
    };
  }

  private doesOverrideApply(override: GraphOverrideNode): boolean {
    const conditions = override.when.value;
    let recognized = false;

    for (const [key, expected] of Object.entries(conditions)) {
      if (!this.context.has(key)) {
        continue;
      }

      recognized = true;
      const actual = this.context.get(key);
      if (!conditionMatches(expected, actual)) {
        return false;
      }
    }

    return recognized;
  }

  private resolveOverrideRef(
    override: GraphOverrideNode,
    base: ResolutionState,
    diagnostics: Diagnostic[],
    trace: ResolutionTraceStep[],
    depth: number
  ): OverrideState | undefined {
    const ref = override.ref!;
    const target = ref.value;

    if (target.external) {
      diagnostics.push({
        code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
        message: `Override "${override.pointer}" references external pointer "${target.uri.href}${target.pointer}" which is not yet supported.`,
        severity: 'error',
        pointer: ref.pointer,
        span: ref.span
      });
      return undefined;
    }

    const targetDiagnostics = new DiagnosticBag();
    const targetState = this.resolveInternal(target.pointer, targetDiagnostics, depth + 1);
    const targetMessages = targetDiagnostics.toArray();
    if (targetMessages.length > 0) {
      diagnostics.push(...targetMessages);
    }
    if (!targetState) {
      diagnostics.push({
        code: DiagnosticCodes.resolver.OVERRIDE_FAILED,
        message: `Override "${override.pointer}" could not resolve target "${target.pointer}".`,
        severity: 'error',
        pointer: ref.pointer,
        span: ref.span
      });
      return undefined;
    }

    const type = base.type ?? targetState.type;
    if (base.type && targetState.type && base.type !== targetState.type) {
      diagnostics.push({
        code: DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH,
        message: `Override "${override.pointer}" expects type "${base.type}" but target "${target.pointer}" resolved to type "${targetState.type}".`,
        severity: 'error',
        pointer: ref.pointer,
        span: ref.span,
        related: [
          {
            message: 'Target token resolved here.',
            pointer: target.pointer,
            span: targetState.source?.span
          }
        ]
      });
    }

    const source = targetState.source ?? createTargetSource(target, ref.span);
    const overrides = Object.freeze([
      ...targetState.overrides,
      Object.freeze({
        pointer: override.pointer,
        span: override.span,
        kind: 'override-ref' as AppliedOverrideKind,
        depth: 0,
        source
      })
    ]);

    const warnings = mergeDiagnostics(targetState.warnings, []);
    const traceSteps = Object.freeze([...trace, ...targetState.trace]);

    return {
      type,
      value: targetState.value,
      source,
      overrides,
      warnings,
      trace: traceSteps
    };
  }

  private resolveOverrideValue(
    override: GraphOverrideNode,
    trace: ResolutionTraceStep[]
  ): OverrideState {
    const valueField = override.value!;
    const source = createFieldSource(valueField, this.graph.uri);

    const overrides = Object.freeze([
      Object.freeze({
        pointer: override.pointer,
        span: override.span,
        kind: 'override-value' as AppliedOverrideKind,
        depth: 0,
        source
      })
    ]);

    const traceSteps = Object.freeze([...trace]);

    return {
      value: valueField.value,
      source,
      overrides,
      warnings: EMPTY_WARNINGS,
      trace: traceSteps
    };
  }

  private resolveFallbackChain(
    chain: readonly GraphOverrideFallbackNode[],
    base: ResolutionState,
    diagnostics: Diagnostic[],
    depth: number,
    trace: ResolutionTraceStep[],
    resolutionDepth: number
  ): OverrideState | undefined {
    if (resolutionDepth > this.maxDepth) {
      diagnostics.push({
        code: DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED,
        message: `Resolution depth exceeded maximum of ${this.maxDepth} while evaluating fallback chain for "${chain[0]?.pointer ?? base.pointer}".`,
        severity: 'error',
        pointer: chain[0]?.pointer ?? base.pointer
      });
      return undefined;
    }

    for (const entry of chain) {
      const result = this.resolveFallbackEntry(entry, base, diagnostics, depth, trace, resolutionDepth);
      if (result) {
        return result;
      }
    }

    diagnostics.push({
      code: DiagnosticCodes.resolver.FALLBACK_EXHAUSTED,
      message: 'Override fallback chain exhausted without producing a value.',
      severity: 'error',
      pointer: chain[0]?.pointer ?? JSON_POINTER_ROOT
    });

    return undefined;
  }

  private resolveFallbackEntry(
    entry: GraphOverrideFallbackNode,
    base: ResolutionState,
    diagnostics: Diagnostic[],
    depth: number,
    trace: ResolutionTraceStep[],
    resolutionDepth: number
  ): OverrideState | undefined {
    if (resolutionDepth > this.maxDepth) {
      diagnostics.push({
        code: DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED,
        message: `Resolution depth exceeded maximum of ${this.maxDepth} while evaluating fallback entry "${entry.pointer}".`,
        severity: 'error',
        pointer: entry.pointer,
        span: entry.span
      });
      return undefined;
    }

    const fallbackTrace = [...trace, createTraceStep(entry.pointer, 'fallback', entry.span)];

    if (entry.ref) {
      const target = entry.ref.value;
      if (target.external) {
        diagnostics.push({
          code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
          message: `Fallback entry "${entry.pointer}" references external pointer "${target.uri.href}${target.pointer}" which is not yet supported.`,
          severity: 'error',
          pointer: entry.ref.pointer,
          span: entry.ref.span
        });
      } else {
        const targetDiagnostics = new DiagnosticBag();
        const targetState = this.resolveInternal(target.pointer, targetDiagnostics, resolutionDepth + 1);
        const targetMessages = targetDiagnostics.toArray();
        if (targetMessages.length > 0) {
          diagnostics.push(...targetMessages);
        }
        if (targetState) {
          const type = base.type ?? targetState.type;
          if (base.type && targetState.type && base.type !== targetState.type) {
            diagnostics.push({
              code: DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH,
              message: `Fallback entry "${entry.pointer}" expects type "${base.type}" but target "${target.pointer}" resolved to type "${targetState.type}".`,
              severity: 'error',
              pointer: entry.ref.pointer,
              span: entry.ref.span,
              related: [
                {
                  message: 'Target token resolved here.',
                  pointer: target.pointer,
                  span: targetState.source?.span
                }
              ]
            });
          }

          const source = targetState.source ?? createTargetSource(target, entry.ref.span);
          const overrides = Object.freeze([
            ...targetState.overrides,
            Object.freeze({
              pointer: entry.pointer,
              span: entry.span,
              kind: 'fallback-ref' as AppliedOverrideKind,
              depth,
              source
            })
          ]);

          const warnings = mergeDiagnostics(targetState.warnings, []);
          const traceSteps = Object.freeze([...fallbackTrace, ...targetState.trace]);

          return {
            type,
            value: targetState.value,
            source,
            overrides,
            warnings,
            trace: traceSteps
          };
        }
      }
    }

    if (entry.value) {
      const source = createFieldSource(entry.value, this.graph.uri);
      const overrides = Object.freeze([
        Object.freeze({
          pointer: entry.pointer,
          span: entry.span,
          kind: 'fallback-value' as AppliedOverrideKind,
          depth,
          source
        })
      ]);
      const traceSteps = Object.freeze([...fallbackTrace]);

      return {
        value: entry.value.value,
        source,
        overrides,
        warnings: EMPTY_WARNINGS,
        trace: traceSteps
      };
    }

    if (entry.fallback && entry.fallback.length > 0) {
      return this.resolveFallbackChain(
        entry.fallback,
        base,
        diagnostics,
        depth + 1,
        fallbackTrace,
        resolutionDepth + 1
      );
    }

    return undefined;
  }

  private applyTransforms(
    token: ResolvedTokenImpl,
    diagnostics: DiagnosticBag
  ): readonly ResolvedTokenTransformEvaluation[] {
    if (this.transforms.length === 0 || !this.document) {
      return EMPTY_TRANSFORM_EVALUATIONS;
    }

    const evaluations: ResolvedTokenTransformEvaluation[] = [];

    for (const entry of this.transforms) {
      try {
        const result = entry.transform(token, { document: this.document });
        const transformDiagnostics = freezeResultDiagnostics(result?.diagnostics);
        if (transformDiagnostics.length > 0) {
          for (const diagnostic of transformDiagnostics) {
            diagnostics.add(diagnostic);
          }
        }
        evaluations.push(
          Object.freeze({
            plugin: entry.plugin,
            pointer: token.pointer,
            data: result?.data,
            diagnostics: transformDiagnostics
          })
        );
      } catch (error) {
        diagnostics.add(createTransformFailureDiagnostic(entry.plugin, token.pointer, error));
      }
    }

    if (evaluations.length === 0) {
      return EMPTY_TRANSFORM_EVALUATIONS;
    }

    return Object.freeze(evaluations);
  }
}

export function createDocumentResolver(
  graph: DocumentGraph,
  options: DocumentResolverOptions = {}
): DocumentResolver {
  return new DocumentResolver(graph, options);
}

function finalizeResolution(
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

function freezeResultDiagnostics(list?: readonly Diagnostic[]): readonly Diagnostic[] {
  if (!list || list.length === 0) {
    return EMPTY_DIAGNOSTICS;
  }
  return Object.freeze(Array.from(list));
}

function createTransformFailureDiagnostic(
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

function normalizeContext(
  context?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>
): ReadonlyMap<string, unknown> {
  if (!context) {
    return new Map();
  }

  if (context instanceof Map) {
    return context;
  }

  return new Map(Object.entries(context));
}

function normalizeMaxDepth(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MAX_DEPTH;
  }

  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_MAX_DEPTH;
  }

  return value;
}

function indexOverrides(
  overrides: readonly GraphOverrideNode[]
): ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]> {
  const mutable = new Map<JsonPointer, GraphOverrideNode[]>();

  for (const override of overrides) {
    const pointer = override.token.value.pointer;
    const list = mutable.get(pointer);
    if (list) {
      list.push(override);
    } else {
      mutable.set(pointer, [override]);
    }
  }

  const result = new Map<JsonPointer, readonly GraphOverrideNode[]>();
  for (const [pointer, list] of mutable.entries()) {
    result.set(pointer, Object.freeze(list.slice()));
  }

  return result;
}

function createTraceStep(
  pointer: JsonPointer,
  kind: ResolutionTraceStepKind,
  span?: SourceSpan
): ResolutionTraceStep {
  return Object.freeze({ pointer, kind, span });
}

function createFieldSource(field: AstField<unknown>, uri: URL): ResolutionSource {
  return Object.freeze({
    uri,
    pointer: field.pointer,
    span: field.span
  });
}

function createTargetSource(target: GraphReferenceTarget, span?: SourceSpan): ResolutionSource {
  return Object.freeze({
    uri: target.uri,
    pointer: target.pointer,
    span
  });
}

function mergeDiagnostics(
  first: readonly Diagnostic[] | undefined,
  second: readonly Diagnostic[] | undefined
): readonly Diagnostic[] {
  const merged = [...(first ?? EMPTY_WARNINGS), ...(second ?? EMPTY_WARNINGS)];
  return merged.length === 0 ? EMPTY_WARNINGS : Object.freeze(merged);
}

function conditionMatches(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    return expected.some((value) => Object.is(value, actual));
  }

  return Object.is(expected, actual);
}

class ResolvedTokenImpl implements ResolvedToken {
  readonly pointer: JsonPointer;
  readonly uri: URL;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overridesApplied: readonly AppliedOverride[];
  readonly warnings: readonly Diagnostic[];
  readonly trace: readonly ResolutionTraceStep[];

  constructor(init: {
    pointer: JsonPointer;
    uri: URL;
    type?: string;
    value?: unknown;
    source?: ResolutionSource;
    overrides: readonly AppliedOverride[];
    warnings: readonly Diagnostic[];
    trace: readonly ResolutionTraceStep[];
  }) {
    this.pointer = init.pointer;
    this.uri = init.uri;
    this.type = init.type;
    this.value = init.value;
    this.source = init.source;
    this.overridesApplied = init.overrides.length === 0 ? EMPTY_OVERRIDES : Object.freeze([...init.overrides]);
    this.warnings = init.warnings.length === 0 ? EMPTY_WARNINGS : Object.freeze([...init.warnings]);
    this.trace = init.trace.length === 0 ? EMPTY_TRACE : Object.freeze([...init.trace]);
  }

  toJSON(): unknown {
    return this.value;
  }
}
