---
title: DTIF parser API reference
description: End-to-end guide to the @lapidist/dtif-parser helpers, flattened token snapshots, diagnostics, caching, and supporting architecture.
keywords:
  - dtif
  - parser
  - api
  - tokens
  - diagnostics
outline: [2, 3]
---

# DTIF parser API reference {#dtif-parser-api-reference}

The `@lapidist/dtif-parser` package provides the canonical runtime for loading and
resolving Design Token Interchange Format (DTIF) documents. This guide explains
how to call the parser, flatten tokens, consume metadata and resolution
snapshots, and work with diagnostics across both asynchronous and synchronous
workflows. It also surveys the underlying architecture so you know where each
piece of the pipeline lives inside the repository.

## Quick start {#quick-start}

Use `parseTokens` when you want flattened tokens, metadata, resolution traces,
and normalised diagnostics in one call:

```ts
import { parseTokens } from '@lapidist/dtif-parser';

const result = await parseTokens('tokens/base.tokens.json', {
  onDiagnostic: (diagnostic) => {
    if (diagnostic.severity === 'error') {
      console.error(diagnostic.message);
    }
  }
});

console.log(result.flattened.length);
console.log(result.metadataIndex.get('#/color/brand/primary')?.description);
console.log(result.resolutionIndex.get('#/color/brand/primary')?.value);
```

For inline workflows—such as bundlers or design tool plugins that already hold
an object in memory—use the synchronous variant. It never touches the filesystem
and will throw if a loader would be required:

```ts
import { parseTokensSync } from '@lapidist/dtif-parser';

const { flattened } = parseTokensSync({
  $schema: 'https://dtif.lapidist.net/schema.json',
  values: {
    color: {
      brand: { primary: { $type: 'color', $value: '#0055ff' } }
    }
  }
});

console.log(flattened[0]);
```

## Supported inputs {#supported-inputs}

`parseTokens` accepts the same sources as `parseDocument` while adding explicit
support for DTIF objects:

| Input                                    | Description                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string`                                 | Interpreted as a URI or filesystem path. The default loader reads from disk and resolves relative paths.                                            |
| `URL`                                    | Parsed with the configured document loader (HTTP, file, or custom).                                                                                 |
| `{ contents: string; uri?: string }`     | Inline text with an optional URI for diagnostics.                                                                                                   |
| `ArrayBuffer`, `Uint8Array`, or `Buffer` | Treated as raw bytes paired with the provided URI, if any.                                                                                          |
| `DesignTokenInterchangeFormat` object    | Consumed without serialisation. The loader builds a synthetic `DocumentHandle` so schema validation and caching can reuse the caller-provided data. |

The synchronous helper only accepts inline text or DTIF objects. It raises an
error if resolving the input would require I/O (e.g., HTTP or disk access).

## Options {#options}

`ParseTokensOptions` extend the base session options with flattening, graph
control, caching hooks, and diagnostic observers.

| Option                   | Type                                    | Default     | Purpose                                                                                                                                                                     |
| ------------------------ | --------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flatten`                | `boolean`                               | `true`      | Skips the flattening stage when `false`, returning empty arrays for `flattened`, `metadataIndex`, and `resolutionIndex`. Useful if you only need the raw session artefacts. |
| `includeGraphs`          | `boolean`                               | `true`      | Includes `document`, `graph`, and `resolver` on the result. Disable when you only care about the flattened outputs.                                                         |
| `cache`                  | `ParseCache`                            | `undefined` | Stores flattened tokens, metadata, resolution snapshots, and diagnostics keyed by the document hash. The bundled `InMemoryParseCache` offers LRU eviction.                  |
| `documentCache`          | `DocumentCache`                         | `undefined` | Shares decoded documents across sessions. Async-only: `parseTokensSync` throws if this is provided.                                                                         |
| `onDiagnostic`           | `(diagnostic: TokenDiagnostic) => void` | `undefined` | Invoked for every diagnostic in severity order as soon as it is produced, including cache hits.                                                                             |
| `warn`                   | `(diagnostic: TokenDiagnostic) => void` | `undefined` | Called for non-fatal warnings. Use this to surface soft failures immediately while still receiving a complete result.                                                       |
| `...ParseSessionOptions` | —                                       | —           | Any session option (`loader`, `schemaGuard`, `plugins`, etc.) is forwarded to `createSession`.                                                                              |

## Result shape {#result-shape}

Both helpers return the same structure:

```ts
interface ParseTokensResult {
  document?: RawDocument;
  graph?: DocumentGraph;
  resolver?: DocumentResolver;
  flattened: readonly DtifFlattenedToken[];
  metadataIndex: ReadonlyMap<TokenId, TokenMetadataSnapshot>;
  resolutionIndex: ReadonlyMap<TokenId, ResolvedTokenView>;
  diagnostics: readonly TokenDiagnostic[];
}
```

- `document`, `graph`, and `resolver` are only present when `includeGraphs` is
  `true` and the document parsed successfully.
- `flattened` provides ready-to-render values, aliases, and references.
- `metadataIndex` exposes per-token metadata for descriptions, extensions, and
  deprecation details.
- `resolutionIndex` mirrors the resolver cache so you can inspect resolution
  paths, applied overrides, and reference chains.
- `diagnostics` is always populated, even for cache hits. The array is ordered by
  severity, then by the original emission order.

### Flattened token entries {#flattened-token-entries}

`DtifFlattenedToken` aligns with the DTIF schema. Each entry includes:

- `id`: Stable token identifier, matching the canonical JSON pointer.
- `pointer`: Pointer to the token’s location within the source document.
- `type`: The declared DTIF token type.
- `value`: Resolved JavaScript value suitable for design tooling or build
  pipelines.
- `raw`: The un-transformed `$value` from the source document.
- `path`: Collection path segments that describe the hierarchy.
- `mode`: Normalised mode value when present.

### Metadata snapshots {#metadata-snapshots}

`createMetadataSnapshot(session, graph)` builds the `metadataIndex` map and is
exported for advanced use cases. Metadata entries are cloned to plain JSON and
contain:

- `description`: Normalised description text when present.
- `extensions`: Deep-cloned extension records.
- `deprecated`: Optional object describing deprecation reasons and replacement
  pointers.
- `source`: `{ uri, line, column }` pointing to the token definition for
  diagnostics and editor integrations.

### Resolution views {#resolution-views}

`createResolutionSnapshot(resolver)` powers `resolutionIndex`. Each entry tracks:

- `id`, `type`, and `raw` schema-level information.
- `value`: The resolved token value, post-aliasing and overrides.
- `references`: Immediate references encountered while resolving the token.
- `resolutionPath`: The ordered chain of pointers the resolver followed.
- `appliedAliases`: Alias tokens that were ultimately applied.

## Diagnostics {#diagnostics}

All diagnostics emitted by the loader, schema guard, normaliser, and resolver are
normalised via `toTokenDiagnostic`. The resulting `TokenDiagnostic` interface is
compatible with Language Server Protocol conventions and includes related
information with URI-anchored ranges. Format diagnostics for terminal output or
logging with `formatTokenDiagnostic`:

```ts
import { parseTokens, formatTokenDiagnostic } from '@lapidist/dtif-parser';

const { diagnostics } = await parseTokens('tokens/base.tokens.json');

for (const diagnostic of diagnostics) {
  console.log(formatTokenDiagnostic(diagnostic, { color: process.stdout.isTTY }));
}
```

`parseTokens` invokes `onDiagnostic` and `warn` hooks immediately so tooling can
stream feedback while the document is processed. Cached results re-emit the saved
warnings before returning.

## Caching {#caching}

The parser separates document caching from flattening caches:

- `documentCache` (a `DocumentCache` implementation) deduplicates decoded raw
  documents and schema results across sessions. This mirrors the behaviour
  already available through `createSession`.
- `cache` (a `ParseCache`) stores flattened outputs keyed by the document hash.
  Use `InMemoryParseCache` for a drop-in LRU cache:

```ts
import { parseTokens, InMemoryParseCache } from '@lapidist/dtif-parser';

const cache = new InMemoryParseCache({ maxEntries: 50 });
await parseTokens('tokens/base.tokens.json', { cache }); // parses and caches
await parseTokens('tokens/base.tokens.json', { cache }); // served from cache
```

`createParseCache` exports the same implementation with configuration defaults.
Provide your own cache by implementing `get` and `set` if you need persistence or
shared storage.

## Sessions and document loaders {#sessions-and-document-loaders}

When you need to customise document loading, plugin resolution, or parse
multiple documents with shared state, create a session manually:

```ts
import { createSession } from '@lapidist/dtif-parser';

const session = createSession({
  loader: new DefaultDocumentLoader({ fetch }),
  plugins: createPluginRegistry().use(/* … */)
});

const result = await session.parseDocument('tokens/base.tokens.json');
```

Sessions use the same zero-serialisation path as `parseTokens`. When you pass a
DTIF object, the loader constructs an in-memory `DocumentHandle` so schema
validation, graph building, and caching reuse the caller-provided data without a
stringify/parse round trip.

## Node adapter {#node-adapter}

The Node adapter wraps the helper in filesystem-friendly ergonomics:

```ts
import { parseTokensFromFile } from '@lapidist/dtif-parser/adapters/node';

try {
  const result = await parseTokensFromFile('tokens/base.tokens.json', {
    cwd: process.cwd(),
    onDiagnostic: (d) => console.log(d.message)
  });
  console.log(result.flattened.length);
} catch (error) {
  if (error instanceof DtifTokenParseError) {
    for (const diagnostic of error.diagnostics) {
      console.error(formatTokenDiagnostic(diagnostic));
    }
  }
}
```

- Validates file extensions against the `.tokens.json` convention.
- Normalises diagnostics to `TokenDiagnostic` values and exposes them on
  `DtifTokenParseError`.
- Populates the same flattened token and snapshot structures returned by
  `parseTokens`.
- Provides `readTokensFile` when you only need the decoded DTIF document.

## Package architecture {#package-architecture}

Understanding how the codebase fits together makes it easier to extend the API
without breaking existing workflows.

### Public entry points {#public-entry-points}

The package exposes all user-facing APIs from the main index module:

- [`src/index.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/index.ts)
  re-exports factories and utilities including `createSession`, `parseDocument`,
  resolver helpers, graph traversal utilities, diagnostic primitives, and the
  token helpers documented above.
- [`src/session.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/session.ts)
  defines the `ParseSession` class and the `createSession` factory. Sessions
  orchestrate document loading, caching, schema validation, AST normalisation,
  graph construction, and resolver initialisation for each parse request.

### Session lifecycle {#session-lifecycle}

`ParseSession.parseDocument` executes the pipeline below:

1. Use the configured document loader to convert caller input into a
   `DocumentHandle`, surfacing loader diagnostics on failure.
2. Resolve cached `RawDocument` instances before decoding handles via
   `decodeDocument`, again collecting diagnostics when decoding fails.
3. Validate the JSON schema through `SchemaGuard`, returning early when the
   document is invalid while still exposing decoded bytes to the caller.
4. Normalise the AST and build the directed token graph, feeding diagnostics back
   into the shared `DiagnosticBag`.
5. Instantiate a `DocumentResolver` that supports alias resolution, overrides,
   and plugin transforms whenever a graph is available.

The `parseTokens` helper reuses these seams so it can share infrastructure with
existing session workflows while layering flattened outputs and metadata
snapshots on top.

### Graph and resolver utilities {#graph-and-resolver-utilities}

Supporting modules wire the AST into usable graph and resolver structures:

- [`src/graph/builder.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/graph/builder.ts)
  generates a `DocumentGraph` from the normalised AST and emits structural
  diagnostics when relationships cannot be resolved.
- [`src/resolver/document-resolver.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/resolver/document-resolver.ts)
  implements the resolution engine. It tracks visited pointers, enforces the
  `maxDepth` guard, records override applications, and exposes `ResolvedToken`
  instances for downstream tooling. The resolver already caches intermediate
  resolution state that snapshot helpers reuse.

### Diagnostics and supporting types {#diagnostics-and-supporting-types}

Diagnostic primitives keep feedback consistent across the loader, normaliser,
and resolver:

- [`src/diagnostics/bag.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/diagnostics/bag.ts)
  collects parser, loader, and resolver diagnostics in a stable insertion order
  while offering convenience helpers such as `hasErrors` and severity counters.
- [`src/diagnostics/codes.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/diagnostics/codes.ts)
  and [`src/diagnostics/severity.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/diagnostics/severity.ts)
  define the severity taxonomy and stable diagnostic codes that map onto the new
  `TokenDiagnostic` shape.
- [`src/types.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/types.ts)
  centralises shared type definitions including `ParseInput`, `ParseResult`,
  `DocumentGraph`, and the diagnostic model.

### Testing conventions {#testing-conventions}

Tests live alongside the source under `parser/tests` and are split by scope:

- Unit suites in [`tests/unit`](https://github.com/bylapidist/dtif/tree/main/parser/tests/unit)
  exercise isolated components such as session caching, resolver alias chains,
  snapshot builders, and diagnostic helpers.
- Integration suites in [`tests/integration`](https://github.com/bylapidist/dtif/tree/main/parser/tests/integration)
  cover multi-file parsing, end-to-end `parseTokens` usage—including cache reuse
  and synchronous inputs—plus the Node adapter surface.

Keeping this reference close to the rest of the documentation ensures ongoing
roadmap work builds on a shared understanding of both the public API and the
parser internals.
