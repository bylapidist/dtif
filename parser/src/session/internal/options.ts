import { DefaultDocumentLoader } from '../../io/document-loader.js';
import { SchemaGuard } from '../../validation/schema-guard.js';
import { PluginRegistry } from '../../plugins/index.js';
import type { DocumentLoader } from '../../io/document-loader.js';
import type { DocumentCache } from '../../types.js';
import type { OverrideContext, ParseSessionOptions } from '../types.js';

export interface ResolvedParseSessionOptions {
  readonly loader: DocumentLoader;
  readonly cache?: DocumentCache;
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
    cache: options.cache,
    allowHttp,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    overrideContext: normalizeOverrideContext(options.overrideContext),
    schemaGuard,
    plugins
  };
}

function normalizeOverrideContext(context?: OverrideContext): ReadonlyMap<string, unknown> {
  if (!context) {
    return new Map();
  }

  if (context instanceof Map) {
    return context;
  }

  return new Map(Object.entries(context));
}
