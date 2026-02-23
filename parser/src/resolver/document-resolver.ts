import { DiagnosticCodes } from '../diagnostics/codes.js';
import { JSON_POINTER_ROOT, normalizeJsonPointer } from '../utils/json-pointer.js';
import type { DiagnosticEvent, DecodedDocument } from '../domain/models.js';
import type { JsonPointer } from '../domain/primitives.js';
import type {
  DocumentGraph,
  GraphAliasNode,
  GraphNode,
  GraphOverrideFallbackNode,
  GraphOverrideNode,
  GraphTokenNode,
  GraphReferenceField
} from '../graph/nodes.js';
import {
  EMPTY_DIAGNOSTICS,
  EMPTY_OVERRIDES,
  EMPTY_WARNINGS,
  EMPTY_TRANSFORM_EVALUATIONS
} from './internal/constants.js';
import {
  finalizeResolution,
  freezeResultDiagnostics,
  createTransformFailureDiagnostic,
  createTraceStep,
  createFieldSource,
  createTargetSource,
  mergeDiagnostics,
  conditionMatches
} from './internal/helpers.js';
import {
  normalizeContext,
  normalizeMaxDepth,
  indexOverrides,
  normalizeTransforms
} from './internal/context.js';
import { ResolvedTokenImpl } from './internal/resolved-token.js';
import type {
  DocumentResolverOptions,
  ExternalGraphInput,
  ResolutionResult,
  ResolutionSource,
  AppliedOverride,
  ResolutionTraceStep
} from './types.js';
import type {
  ResolvedTokenTransformEntry,
  ResolvedTokenTransformEvaluation
} from '../plugins/index.js';
import { createDiagnosticCollector, type DiagnosticCollector } from './internal/diagnostics.js';
import { isOverrideValueCompatible } from './internal/type-compatibility.js';

interface ResolutionState {
  readonly pointer: JsonPointer;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overrides: readonly AppliedOverride[];
  readonly warnings: readonly DiagnosticEvent[];
  readonly trace: readonly ResolutionTraceStep[];
}

interface OverrideEvaluation {
  readonly matched: boolean;
  readonly state?: OverrideState;
  readonly diagnostics: readonly DiagnosticEvent[];
}

interface OverrideState {
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: ResolutionSource;
  readonly overrides: readonly AppliedOverride[];
  readonly warnings: readonly DiagnosticEvent[];
  readonly trace: readonly ResolutionTraceStep[];
}

export class DocumentResolver {
  private readonly graph: DocumentGraph;
  private readonly graphs: ReadonlyMap<string, DocumentGraph>;
  private readonly context: ReadonlyMap<string, unknown>;
  private readonly overridesByGraph: ReadonlyMap<
    string,
    ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]>
  >;
  private readonly maxDepth: number;
  private readonly document?: DecodedDocument;
  private readonly transforms: readonly ResolvedTokenTransformEntry[];
  private readonly allowNetworkReferences: boolean;
  private readonly cache = new Map<string, ResolutionState>();
  private readonly pending = new Set<string>();

  constructor(graph: DocumentGraph, options: DocumentResolverOptions = {}) {
    this.graph = graph;
    this.graphs = normalizeExternalGraphs(graph, options.externalGraphs);
    this.context = normalizeContext(options.context);
    this.overridesByGraph = indexOverridesByGraph(this.graphs);
    this.maxDepth = normalizeMaxDepth(options.maxDepth);
    this.document = options.document;
    this.transforms = normalizeTransforms(options.transforms);
    this.allowNetworkReferences = options.allowNetworkReferences ?? false;
  }

  resolve(pointer: JsonPointer): ResolutionResult {
    const diagnostics = createDiagnosticCollector();

    try {
      const normalized = normalizeJsonPointer(pointer);
      const state = this.resolveInternalInGraph(this.graph.uri, normalized, diagnostics, 0);
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

  private resolveInternalInGraph(
    graphUri: URL,
    pointer: JsonPointer,
    diagnostics: DiagnosticCollector,
    depth: number
  ): ResolutionState | undefined {
    const cacheKey = createResolutionKey(graphUri, pointer);

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    if (this.pending.has(cacheKey)) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.CYCLE_DETECTED,
        message: `Circular reference detected while resolving "${graphUri.href}#${pointer}".`,
        severity: 'error',
        pointer
      });
      return undefined;
    }

    if (depth > this.maxDepth) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED,
        message: `Resolution depth exceeded maximum of ${String(
          this.maxDepth
        )} while resolving "${pointer}".`,
        severity: 'error',
        pointer
      });
      return undefined;
    }

    const graph = this.graphs.get(graphUri.href);

    if (!graph) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
        message: `External document "${graphUri.href}" is not available for resolution.`,
        severity: 'error',
        pointer
      });
      return undefined;
    }

    const node = graph.nodes.get(pointer);

    if (!node) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.UNKNOWN_POINTER,
        message: `No token exists at pointer "${graphUri.href}#${pointer}".`,
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

    this.pending.add(cacheKey);

    try {
      const base = this.resolveBaseNode(graph, node, diagnostics, depth);
      if (!base) {
        return undefined;
      }

      const withOverrides = this.applyOverrides(graph, node.pointer, base, diagnostics, depth);
      this.validateDeprecatedReplacement(graph, node, withOverrides, diagnostics);
      this.cache.set(cacheKey, withOverrides);
      return withOverrides;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  private resolveBaseNode(
    graph: DocumentGraph,
    node: GraphNode,
    diagnostics: DiagnosticCollector,
    depth: number
  ): ResolutionState | undefined {
    switch (node.kind) {
      case 'token':
        return this.resolveTokenNode(graph, node, diagnostics);
      case 'alias':
        return this.resolveAliasNode(node, diagnostics, depth);
      default:
        return undefined;
    }
  }

  private resolveTokenNode(
    graph: DocumentGraph,
    node: GraphTokenNode,
    diagnostics: DiagnosticCollector
  ): ResolutionState {
    const trace = Object.freeze([createTraceStep(node.pointer, 'token', node.span)]);
    const valueField = node.value;
    const warnings: DiagnosticEvent[] = [];
    let source: ResolutionSource | undefined;
    let value: unknown;

    if (valueField) {
      value = valueField.value;
      source = createFieldSource(valueField, graph.uri);
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
    diagnostics: DiagnosticCollector,
    depth: number
  ): ResolutionState | undefined {
    const tracePrefix = createTraceStep(node.pointer, 'alias', node.span);
    const target = node.ref.value;

    const targetState = this.resolveTargetReference(target, diagnostics, depth + 1, node.ref.span);
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

    const type = node.type.value;

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
    graph: DocumentGraph,
    pointer: JsonPointer,
    base: ResolutionState,
    diagnostics: DiagnosticCollector,
    depth: number
  ): ResolutionState {
    const overrides = this.overridesByGraph.get(graph.uri.href)?.get(pointer);
    if (!overrides || overrides.length === 0) {
      return base;
    }

    let matchedState: OverrideState | undefined;

    for (const override of overrides) {
      const evaluation = this.evaluateOverride(override, base, depth);
      diagnostics.addMany(evaluation.diagnostics);
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

  private validateDeprecatedReplacement(
    graph: DocumentGraph,
    node: GraphTokenNode | GraphAliasNode,
    state: ResolutionState,
    diagnostics: DiagnosticCollector
  ): void {
    const replacement = node.metadata.deprecated?.value.replacement;
    if (!replacement) {
      return;
    }

    let resolved: URL;
    try {
      resolved = new URL(replacement.value, graph.uri);
    } catch {
      diagnostics.add({
        code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
        message: `Deprecated replacement "${replacement.value}" is not a valid reference URI.`,
        severity: 'error',
        pointer: replacement.pointer,
        span: replacement.span
      });
      return;
    }

    const pointer = normalizeJsonPointer(resolved.hash.length > 0 ? resolved.hash : '#');
    const targetUri = new URL(resolved.href);
    targetUri.hash = '';
    const target = Object.freeze({
      uri: targetUri,
      pointer,
      external: targetUri.href !== graph.uri.href
    });
    const targetGraph = this.graphs.get(target.uri.href);
    if (!targetGraph) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
        message: `Deprecated replacement "${replacement.value}" points to an unavailable document.`,
        severity: 'error',
        pointer: replacement.pointer,
        span: replacement.span
      });
      return;
    }

    const targetNode = targetGraph.nodes.get(target.pointer);
    if (!targetNode || targetNode.kind === 'collection') {
      diagnostics.add({
        code: DiagnosticCodes.resolver.UNKNOWN_POINTER,
        message: `Deprecated replacement "${replacement.value}" must resolve to an existing token.`,
        severity: 'error',
        pointer: replacement.pointer,
        span: replacement.span
      });
      return;
    }

    const expectedType = state.type;
    if (!expectedType) {
      return;
    }

    const targetType = targetNode.type?.value;
    if (!targetType) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH,
        message: `Deprecated replacement "${replacement.value}" must resolve to a token declaring "$type" "${expectedType}".`,
        severity: 'error',
        pointer: replacement.pointer,
        span: replacement.span
      });
      return;
    }

    if (targetType !== expectedType) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH,
        message: `Deprecated replacement "${replacement.value}" resolved to type "${targetType}" but expected "${expectedType}".`,
        severity: 'error',
        pointer: replacement.pointer,
        span: replacement.span,
        related: [
          {
            message: 'Replacement token resolved here.',
            pointer: target.pointer,
            span: targetNode.span
          }
        ]
      });
    }
  }

  private evaluateOverride(
    override: GraphOverrideNode,
    base: ResolutionState,
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

    const traceSteps: ResolutionTraceStep[] = [
      createTraceStep(override.pointer, 'override', override.span)
    ];
    const localDiagnostics = createDiagnosticCollector();
    let state: OverrideState | undefined;

    if (override.ref) {
      state = this.resolveOverrideRef(
        override,
        override.ref,
        base,
        localDiagnostics,
        traceSteps,
        depth
      );
    }

    if (!state && override.value) {
      state = this.resolveOverrideValue(
        override,
        override.value,
        base,
        localDiagnostics,
        traceSteps
      );
    }

    if (!state && override.fallback) {
      state = this.resolveFallbackChain(
        override.fallback,
        base,
        localDiagnostics,
        1,
        traceSteps,
        depth + 1
      );
    }

    if (!state) {
      localDiagnostics.add({
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
      diagnostics: localDiagnostics.toArray()
    };
  }

  private doesOverrideApply(override: GraphOverrideNode): boolean {
    const conditions = override.when.value;
    let recognized = false;

    for (const [key, expected] of Object.entries(conditions)) {
      if (!this.context.has(key)) {
        return false;
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
    ref: GraphReferenceField,
    base: ResolutionState,
    diagnostics: DiagnosticCollector,
    trace: ResolutionTraceStep[],
    depth: number
  ): OverrideState | undefined {
    const target = ref.value;

    const targetDiagnostics = createDiagnosticCollector();
    const targetState = this.resolveTargetReference(target, targetDiagnostics, depth + 1, ref.span);
    diagnostics.addMany(targetDiagnostics.toArray());
    if (!targetState) {
      diagnostics.add({
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
      diagnostics.add({
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
        kind: 'override-ref',
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
    valueField: NonNullable<GraphOverrideNode['value']>,
    base: ResolutionState,
    diagnostics: DiagnosticCollector,
    trace: ResolutionTraceStep[]
  ): OverrideState | undefined {
    if (!isOverrideValueCompatible(base.type, valueField.value)) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH,
        message: `Override "${override.pointer}" expects type "${base.type ?? '(unknown)'}" but inline $value is incompatible.`,
        severity: 'error',
        pointer: valueField.pointer,
        span: valueField.span
      });
      return undefined;
    }

    const source = createFieldSource(valueField, this.graph.uri);

    const overrides = Object.freeze([
      Object.freeze({
        pointer: override.pointer,
        span: override.span,
        kind: 'override-value',
        depth: 0,
        source
      })
    ]);

    const traceSteps = Object.freeze([...trace]);

    return {
      type: base.type,
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
    diagnostics: DiagnosticCollector,
    depth: number,
    trace: ResolutionTraceStep[],
    resolutionDepth: number
  ): OverrideState | undefined {
    if (resolutionDepth > this.maxDepth) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED,
        message: `Resolution depth exceeded maximum of ${String(
          this.maxDepth
        )} while evaluating fallback chain for "${chain[0]?.pointer ?? base.pointer}".`,
        severity: 'error',
        pointer: chain[0]?.pointer ?? base.pointer
      });
      return undefined;
    }

    for (const entry of chain) {
      const result = this.resolveFallbackEntry(
        entry,
        base,
        diagnostics,
        depth,
        trace,
        resolutionDepth
      );
      if (result) {
        return result;
      }
    }

    diagnostics.add({
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
    diagnostics: DiagnosticCollector,
    depth: number,
    trace: ResolutionTraceStep[],
    resolutionDepth: number
  ): OverrideState | undefined {
    if (resolutionDepth > this.maxDepth) {
      diagnostics.add({
        code: DiagnosticCodes.resolver.MAX_DEPTH_EXCEEDED,
        message: `Resolution depth exceeded maximum of ${String(
          this.maxDepth
        )} while evaluating fallback entry "${entry.pointer}".`,
        severity: 'error',
        pointer: entry.pointer,
        span: entry.span
      });
      return undefined;
    }

    const fallbackTrace = [...trace, createTraceStep(entry.pointer, 'fallback', entry.span)];

    if (entry.ref) {
      const target = entry.ref.value;
      const targetDiagnostics = createDiagnosticCollector();
      const targetState = this.resolveTargetReference(
        target,
        targetDiagnostics,
        resolutionDepth + 1,
        entry.ref.span
      );
      diagnostics.addMany(targetDiagnostics.toArray());
      if (targetState) {
        const type = base.type ?? targetState.type;
        if (base.type && targetState.type && base.type !== targetState.type) {
          diagnostics.add({
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
            kind: 'fallback-ref',
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

    if (entry.value) {
      if (!isOverrideValueCompatible(base.type, entry.value.value)) {
        diagnostics.add({
          code: DiagnosticCodes.resolver.TARGET_TYPE_MISMATCH,
          message: `Fallback entry "${entry.pointer}" expects type "${base.type ?? '(unknown)'}" but inline $value is incompatible.`,
          severity: 'error',
          pointer: entry.value.pointer,
          span: entry.value.span
        });
        return undefined;
      }

      const source = createFieldSource(entry.value, this.graph.uri);
      const overrides = Object.freeze([
        Object.freeze({
          pointer: entry.pointer,
          span: entry.span,
          kind: 'fallback-value',
          depth,
          source
        })
      ]);
      const traceSteps = Object.freeze([...fallbackTrace]);

      return {
        type: base.type,
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

  private resolveTargetReference(
    target: GraphReferenceField['value'],
    diagnostics: DiagnosticCollector,
    depth: number,
    span: GraphReferenceField['span']
  ): ResolutionState | undefined {
    if (target.external) {
      const protocol = target.uri.protocol.toLowerCase();
      const networkReference = protocol === 'http:' || protocol === 'https:';
      if (networkReference && !this.allowNetworkReferences) {
        diagnostics.add({
          code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
          message: `Reference "${target.uri.href}${target.pointer}" uses a network scheme and requires explicit opt-in.`,
          severity: 'error',
          pointer: target.pointer,
          span
        });
        return undefined;
      }

      if (!this.graphs.has(target.uri.href)) {
        diagnostics.add({
          code: DiagnosticCodes.resolver.EXTERNAL_REFERENCE,
          message: `Reference "${target.uri.href}${target.pointer}" could not be resolved because document "${target.uri.href}" is unavailable.`,
          severity: 'error',
          pointer: target.pointer,
          span
        });
        return undefined;
      }
    }

    return this.resolveInternalInGraph(target.uri, target.pointer, diagnostics, depth);
  }

  private applyTransforms(
    token: ResolvedTokenImpl,
    diagnostics: DiagnosticCollector
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

function createResolutionKey(uri: URL, pointer: JsonPointer): string {
  return `${uri.href}#${pointer}`;
}

function normalizeExternalGraphs(
  rootGraph: DocumentGraph,
  externalGraphs?: ExternalGraphInput
): ReadonlyMap<string, DocumentGraph> {
  const graphs = new Map<string, DocumentGraph>();
  graphs.set(rootGraph.uri.href, rootGraph);

  if (!externalGraphs) {
    return graphs;
  }

  if (isExternalGraphMap(externalGraphs)) {
    for (const [key, graph] of externalGraphs.entries()) {
      if (!isDocumentGraph(graph)) {
        continue;
      }
      const href = key instanceof URL ? key.href : key;
      graphs.set(href, graph);
      graphs.set(graph.uri.href, graph);
    }
    return graphs;
  }

  for (const href in externalGraphs) {
    const graph = externalGraphs[href];
    if (!isDocumentGraph(graph)) {
      continue;
    }
    graphs.set(href, graph);
    graphs.set(graph.uri.href, graph);
  }

  return graphs;
}

function indexOverridesByGraph(
  graphs: ReadonlyMap<string, DocumentGraph>
): ReadonlyMap<string, ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]>> {
  const overridesByGraph = new Map<
    string,
    ReadonlyMap<JsonPointer, readonly GraphOverrideNode[]>
  >();
  const seen = new Set<string>();

  for (const graph of graphs.values()) {
    if (seen.has(graph.uri.href)) {
      continue;
    }
    seen.add(graph.uri.href);
    overridesByGraph.set(graph.uri.href, indexOverrides(graph.overrides));
  }

  return overridesByGraph;
}

function isExternalGraphMap(
  value: ExternalGraphInput
): value is ReadonlyMap<string | URL, DocumentGraph> {
  return value instanceof Map;
}

function isDocumentGraph(value: unknown): value is DocumentGraph {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (!('kind' in value) || !('uri' in value)) {
    return false;
  }

  const kind = Reflect.get(value, 'kind');
  const uri = Reflect.get(value, 'uri');
  return kind === 'document-graph' && uri instanceof URL;
}

export function createDocumentResolver(
  graph: DocumentGraph,
  options: DocumentResolverOptions = {}
): DocumentResolver {
  return new DocumentResolver(graph, options);
}
