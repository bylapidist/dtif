import type { DecodedDocument } from '../../domain/models.js';
import type {
  ResolvedTokenTransformEntry,
  ResolvedTokenTransformEvaluation
} from '../../plugins/types.js';
import {
  createTransformFailureDiagnostic,
  freezeResultDiagnostics
} from '../../plugins/transform-utils.js';
import type { ResolvedToken } from '../types.js';
import type { DiagnosticCollector } from './diagnostics.js';
import { EMPTY_TRANSFORM_EVALUATIONS } from './constants.js';

export function runTokenTransforms(
  token: ResolvedToken,
  transforms: readonly ResolvedTokenTransformEntry[],
  document: DecodedDocument | undefined,
  diagnostics: DiagnosticCollector
): readonly ResolvedTokenTransformEvaluation[] {
  if (!document || transforms.length === 0) {
    return EMPTY_TRANSFORM_EVALUATIONS;
  }

  const evaluations: ResolvedTokenTransformEvaluation[] = [];

  for (const entry of transforms) {
    try {
      const result = entry.transform(token, { document });
      const transformDiagnostics = freezeResultDiagnostics(result?.diagnostics);
      for (const diagnostic of transformDiagnostics) {
        diagnostics.add(diagnostic);
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
