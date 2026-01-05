import type {
  ExtensionCollectionContext,
  ExtensionEvaluationSnapshot,
  PipelineResult,
  TokenTransformEvaluationSnapshot,
  TransformExecutionContext,
  DiagnosticEvent
} from '../../domain/models.js';
import type { ExtensionCollectorPort, TransformExecutorPort } from '../../domain/ports.js';
import type { PluginRegistry } from '../../plugins/index.js';
import type { ExtensionCollector, ResolvedTokenTransformEntry } from '../../plugins/registry.js';
import {
  createTransformFailureDiagnostic,
  freezeResultDiagnostics
} from '../../resolver/internal/helpers.js';
import type { ResolvedToken } from '../../resolver/types.js';
import {
  EMPTY_PIPELINE_DIAGNOSTICS,
  toDomainDiagnostic,
  toPipelineDiagnostics
} from './diagnostics.js';

export type PluginExtensionCollectorContext = ExtensionCollectionContext;

export type PluginExtensionCollectorResult = PipelineResult<readonly ExtensionEvaluationSnapshot[]>;

export type PluginTransformExecutionContext = TransformExecutionContext<ResolvedToken>;

export type PluginTransformExecutionResult = PipelineResult<
  readonly TokenTransformEvaluationSnapshot[]
>;

const EMPTY_EXTENSION_RESULTS: readonly ExtensionEvaluationSnapshot[] = Object.freeze([]);
const EMPTY_TRANSFORM_RESULTS: readonly TokenTransformEvaluationSnapshot[] = Object.freeze([]);

export class PluginExtensionCollectorAdapter implements ExtensionCollectorPort<
  PluginExtensionCollectorContext,
  PluginExtensionCollectorResult
> {
  readonly #registry: PluginRegistry;

  constructor(registry: PluginRegistry) {
    this.#registry = registry;
  }

  collect(context: PluginExtensionCollectorContext): PluginExtensionCollectorResult {
    const diagnostics: DiagnosticEvent[] = [];
    const collector = this.#createCollector(context.document, diagnostics);

    if (!collector || context.invocations.length === 0) {
      return {
        outcome: EMPTY_EXTENSION_RESULTS,
        diagnostics:
          diagnostics.length === 0 ? EMPTY_PIPELINE_DIAGNOSTICS : toPipelineDiagnostics(diagnostics)
      } satisfies PluginExtensionCollectorResult;
    }

    for (const invocation of context.invocations) {
      collector.handle({
        namespace: invocation.namespace,
        pointer: invocation.pointer,
        span: invocation.span,
        value: invocation.value
      });
    }

    const evaluations = collector.results();
    if (evaluations.length === 0) {
      return {
        outcome: EMPTY_EXTENSION_RESULTS,
        diagnostics:
          diagnostics.length === 0 ? EMPTY_PIPELINE_DIAGNOSTICS : toPipelineDiagnostics(diagnostics)
      } satisfies PluginExtensionCollectorResult;
    }

    const snapshots = evaluations.map((evaluation) => {
      const diagnosticsSnapshot =
        evaluation.diagnostics.length === 0
          ? Object.freeze([])
          : Object.freeze(evaluation.diagnostics.map(toDomainDiagnostic));

      const snapshot = Object.freeze({
        plugin: evaluation.plugin,
        namespace: evaluation.namespace,
        pointer: evaluation.pointer,
        span: evaluation.span,
        value: evaluation.value,
        normalized: evaluation.normalized,
        diagnostics: diagnosticsSnapshot
      }) satisfies ExtensionEvaluationSnapshot;

      return snapshot;
    });

    return {
      outcome: Object.freeze(snapshots),
      diagnostics:
        diagnostics.length === 0 ? EMPTY_PIPELINE_DIAGNOSTICS : toPipelineDiagnostics(diagnostics)
    } satisfies PluginExtensionCollectorResult;
  }

  #createCollector(
    document: PluginExtensionCollectorContext['document'],
    diagnostics: DiagnosticEvent[]
  ): ExtensionCollector | undefined {
    return this.#registry.createExtensionCollector(document, diagnostics);
  }
}

export class PluginTransformExecutorAdapter implements TransformExecutorPort<
  PluginTransformExecutionContext,
  PluginTransformExecutionResult
> {
  readonly #transforms: readonly ResolvedTokenTransformEntry[];

  constructor(transforms: readonly ResolvedTokenTransformEntry[]) {
    this.#transforms = transforms;
  }

  execute(context: PluginTransformExecutionContext): PluginTransformExecutionResult {
    if (this.#transforms.length === 0) {
      return { outcome: EMPTY_TRANSFORM_RESULTS, diagnostics: EMPTY_PIPELINE_DIAGNOSTICS };
    }

    const diagnostics: DiagnosticEvent[] = [];
    const snapshots: TokenTransformEvaluationSnapshot[] = [];

    for (const entry of this.#transforms) {
      try {
        const result = entry.transform(context.token, { document: context.document });
        const transformDiagnostics = freezeResultDiagnostics(result?.diagnostics);
        if (transformDiagnostics.length > 0) {
          diagnostics.push(...transformDiagnostics);
        }

        const evaluationDiagnostics =
          transformDiagnostics.length === 0
            ? Object.freeze([])
            : Object.freeze(transformDiagnostics.map(toDomainDiagnostic));

        const evaluation = Object.freeze({
          plugin: entry.plugin,
          pointer: context.token.pointer,
          data: result?.data,
          diagnostics: evaluationDiagnostics
        }) satisfies TokenTransformEvaluationSnapshot;

        snapshots.push(evaluation);
      } catch (error) {
        const diagnostic = createTransformFailureDiagnostic(
          entry.plugin,
          context.token.pointer,
          error
        );
        diagnostics.push(diagnostic);
      }
    }

    const outcome =
      snapshots.length === 0 ? EMPTY_TRANSFORM_RESULTS : Object.freeze(snapshots.slice());

    return {
      outcome,
      diagnostics:
        diagnostics.length === 0 ? EMPTY_PIPELINE_DIAGNOSTICS : toPipelineDiagnostics(diagnostics)
    } satisfies PluginTransformExecutionResult;
  }
}
