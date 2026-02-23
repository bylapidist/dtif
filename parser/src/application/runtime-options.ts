import type { DocumentCachePort } from '../domain/ports.js';
import type { DocumentLoader } from '../io/document-loader.js';
import type { PluginRegistry } from '../plugins/index.js';
import type { SchemaGuard } from '../validation/schema-guard.js';

export interface ParserRuntimeOptions {
  readonly loader: DocumentLoader;
  readonly documentCache?: DocumentCachePort;
  readonly allowHttp: boolean;
  readonly maxDepth: number;
  readonly overrideContext: ReadonlyMap<string, unknown>;
  readonly schemaGuard: SchemaGuard;
  readonly plugins?: PluginRegistry;
}
