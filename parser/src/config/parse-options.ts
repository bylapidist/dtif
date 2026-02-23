import type { DocumentCachePort } from '../domain/ports.js';
import type { ParserPlugin } from '../plugins/index.js';
import type { SchemaGuard, SchemaGuardOptions } from '../validation/schema-guard.js';
import type { DocumentHandle, ParseInput } from '../types.js';

export type OverrideContext = ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;

export interface ParseSessionLoader {
  load(
    input: ParseInput,
    context?: { readonly baseUri?: URL; readonly signal?: AbortSignal }
  ): Promise<DocumentHandle>;
}

export interface ParseSessionOptions {
  readonly loader?: ParseSessionLoader;
  readonly documentCache?: DocumentCachePort;
  readonly allowHttp?: boolean;
  readonly maxDepth?: number;
  readonly overrideContext?: OverrideContext;
  readonly schemaGuard?: SchemaGuard | SchemaGuardOptions;
  readonly plugins?: readonly ParserPlugin[];
}
