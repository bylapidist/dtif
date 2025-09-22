import { PluginRegistry } from './registry.js';
import type { ParserPlugin } from './types.js';

export { PluginRegistry };

export function createPluginRegistry(plugins: readonly ParserPlugin[] = []): PluginRegistry {
  return new PluginRegistry(plugins);
}

export type { ExtensionCollector } from './registry.js';
export type {
  ExtensionEvaluation,
  ExtensionHandler,
  ExtensionHandlerInput,
  ExtensionHandlerResult,
  ParserPlugin,
  ResolvedTokenTransform,
  ResolvedTokenTransformContext,
  ResolvedTokenTransformEvaluation,
  ResolvedTokenTransformResult,
  ResolvedTokenTransformEntry
} from './types.js';
