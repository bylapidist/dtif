import type { DocumentCache } from '../types.js';
import type { DocumentLoader } from '../io/document-loader.js';
import type { SchemaGuard } from '../validation/schema-guard.js';
import type { ParserPlugin } from '../plugins/index.js';
import type { SchemaGuardOptions } from '../validation/schema-guard.js';

export type OverrideContext = ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;

export interface ParseSessionOptions {
  readonly loader?: DocumentLoader;
  readonly cache?: DocumentCache;
  readonly allowHttp?: boolean;
  readonly maxDepth?: number;
  readonly overrideContext?: OverrideContext;
  readonly schemaGuard?: SchemaGuard | SchemaGuardOptions;
  readonly plugins?: readonly ParserPlugin[];
}
