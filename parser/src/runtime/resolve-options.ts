import { DefaultDocumentLoader, type DocumentLoader } from '../io/document-loader.js';
import { PluginRegistry } from '../plugins/index.js';
import { toReadonlyContextMap } from '../utils/context.js';
import { SchemaGuard } from '../validation/schema-guard.js';
import type { DocumentCachePort } from '../domain/ports.js';
import type { ParseSessionOptions } from '../config/parse-options.js';

export interface ResolvedParseSessionOptions {
  readonly loader: DocumentLoader;
  readonly documentCache?: DocumentCachePort;
  readonly allowHttp: boolean;
  readonly maxDepth: number;
  readonly overrideContext: ReadonlyMap<string, unknown>;
  readonly schemaGuard: SchemaGuard;
  readonly plugins?: PluginRegistry;
}

const DEFAULT_MAX_DEPTH = 32;

export function resolveOptions(options: ParseSessionOptions = {}): ResolvedParseSessionOptions {
  const allowHttp = options.allowHttp ?? false;
  const schemaGuardInput = options.schemaGuard;
  const schemaGuard =
    schemaGuardInput instanceof SchemaGuard ? schemaGuardInput : new SchemaGuard(schemaGuardInput);
  const plugins =
    options.plugins && options.plugins.length > 0 ? new PluginRegistry(options.plugins) : undefined;

  return {
    loader: options.loader ?? new DefaultDocumentLoader({ allowHttp }),
    documentCache: options.documentCache,
    allowHttp,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    overrideContext: toReadonlyContextMap(options.overrideContext),
    schemaGuard,
    plugins
  };
}
