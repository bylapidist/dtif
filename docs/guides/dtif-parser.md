---
title: Using the DTIF parser
description: Learn how to install, configure, and integrate the canonical DTIF parser in tooling and workflows, including helper APIs, caching strategies, and package architecture.
keywords:
  - dtif
  - parser
  - guide
  - usage
  - api
outline: [2, 3]
---

# DTIF parser guide {#dtif-parser-guide}

The canonical DTIF parser powers validation, normalisation, graph construction, and resolution across the toolchain. This guide
covers installation, configuration, the high-level helper APIs, and the internals you need to integrate the parser into tooling
and CI pipelines.

## Installation {#installation}

The parser is published as `@lapidist/dtif-parser`. Install it alongside the DTIF schema and validator packages:

```bash
npm install @lapidist/dtif-parser
```

The package ships ESM output, TypeScript declarations, and a `dtif-parse` CLI binary.

## Quick start {#quick-start}

### Parse sessions {#quick-start-sessions}

Create a new parse session to reuse caches and configuration across documents:

```ts
import { createSession } from '@lapidist/dtif-parser';

const session = createSession({
  allowHttp: false,
  maxDepth: 32
});

const result = await session.parseDocument('/path/to/tokens.json');

const hasErrors = result.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
if (hasErrors) {
  // Format diagnostics for display or CI output
}

const resolution = result.resolver?.resolve('#/color/brand/primary');
if (resolution?.token) {
  console.log(resolution.token.value);
}
```

Parse sessions expose:

- `document`: the decoded `RawDocument` when ingestion succeeds.
- `decoded`: the parsed `DecodedDocument` including JSON/YAML data and source map.
- `normalized`: the normalised AST, available after schema validation succeeds.
- `graph`: the constructed document graph for pointer lookups.
- `resolution`: the `ResolutionOutcome` containing a `DocumentResolver` when the graph is available.
- `diagnostics`: an ordered array of `DiagnosticEvent` values emitted by every pipeline stage.
- `fromCache`: whether the document was served entirely from the configured cache.

### Token helpers {#quick-start-helpers}

Use `parseTokens` when you want flattened tokens, metadata, resolution traces, and normalised diagnostics in one call:

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

The synchronous variant consumes inline content without touching the filesystem. It throws if a loader would be required:

```ts
import { parseTokensSync } from '@lapidist/dtif-parser';

const { flattened } = parseTokensSync({
  $schema: 'https://dtif.lapidist.net/schema/core.json',
  color: {
    brand: {
      primary: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0.3333, 1] }
      }
    }
  }
});

console.log(flattened[0]);
```

### Example DTIF document {#example-dtif-document}

The helpers above accept inline DTIF objects in addition to file paths. The following document is valid against the
[core schema](https://dtif.lapidist.net/schema/core.json) and demonstrates a small hierarchy, metadata, and an alias:

```json dtif
{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "$version": "1.0.0",
  "color": {
    "$description": "Brand palette",
    "primary": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0, 0.333, 1],
        "hex": "#0055ff"
      },
      "$extensions": {
        "com.acme.tokens": {
          "usage": "surface"
        }
      }
    },
    "onPrimary": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [1, 1, 1],
        "hex": "#ffffff"
      }
    },
    "onPrimaryText": {
      "$type": "color",
      "$value": { "$ref": "#/color/onPrimary" }
    }
  },
  "typography": {
    "$description": "Body copy",
    "base": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "lineHeight": {
          "dimensionType": "length",
          "value": 24,
          "unit": "px"
        }
      }
    }
  }
}
```

Supply this object directly to `parseTokensSync` or serialise it to disk and feed it through `parseTokens` to reuse caching and loader configuration.

## CLI usage {#cli}

The CLI wraps the same session pipeline and is useful for quick inspections:

```bash
npx dtif-parse tokens.yaml --resolve "#/color/brand/primary" --format json
```

Key flags:

- `--resolve <pointer>` – resolve one or more JSON pointers.
- `--context key=value` – provide override context values.
- `--allow-http` – enable HTTP(S) loading in the default loader.
- `--max-depth <number>` – cap the resolver depth (default 32).
- `--format json` – emit a machine readable summary instead of the pretty printer.

## Token helper APIs {#token-helpers}

The token helpers sit on top of the session pipeline and add caching, flattening, and metadata snapshots. They support both
asynchronous and synchronous workflows without forcing serialisation round trips.

### Supported inputs {#supported-inputs}

`parseTokens` accepts the same sources as `parseDocument` while adding explicit support for DTIF objects:

- `string` – interpreted as a URI or filesystem path. The default loader reads from disk and resolves relative paths.
- `URL` – parsed with the configured document loader (HTTP, file, or custom).
- `{ contents: string; uri?: string }` – inline text with an optional URI for diagnostics.
- `ArrayBuffer`, `Uint8Array`, or `Buffer` – treated as raw bytes paired with the provided URI, if any.
- `DesignTokenInterchangeFormat` object – consumed without serialisation. The loader builds a synthetic handle so schema
  validation and caching reuse it.

The synchronous helper only accepts inline text or DTIF objects. It raises an error if resolving the input would require I/O
(such as HTTP or disk access).

### Options {#options}

`ParseTokensOptions` extend the base session options with flattening, graph control, caching hooks, and diagnostic observers:

- `flatten` (`boolean`, default `true`) – skip the flattening stage when `false`, returning empty arrays for `flattened`,
  `metadataIndex`, and `resolutionIndex`.
- `includeGraphs` (`boolean`, default `true`) – include `document`, `graph`, and `resolver` on the result. Disable when you
  only care about the flattened outputs.
- `tokenCache` (`TokenCache`) – stores flattened tokens, metadata, resolution snapshots, and diagnostics keyed by the document
  identity and variant signature. The bundled `InMemoryTokenCache` offers an LRU eviction policy.
- `documentCache` (`DocumentCache`) – implementation of the domain cache port. It receives `RawDocumentIdentity` keys and
  returns previously decoded documents. Async-only: `parseTokensSync` throws if this is provided.
- `onDiagnostic` (`(diagnostic: domain.DiagnosticEvent) => void`) – invoked for every diagnostic in severity order as soon as it is
  produced, including cache hits.
- `warn` (`(diagnostic: domain.DiagnosticEvent) => void`) – called for non-fatal warnings. Use this to surface soft failures
  immediately while still receiving a complete result.
- `...ParseSessionOptions` – any session option (`loader`, `schemaGuard`, `plugins`, etc.) is forwarded to `createSession`.

### Result shape {#result-shape}

Both helpers return the same structure:

```ts
interface ParseTokensResult {
  document?: domain.RawDocument;
  graph?: DocumentGraph;
  resolver?: DocumentResolver;
  flattened: readonly DtifFlattenedToken[];
  metadataIndex: ReadonlyMap<TokenId, TokenMetadataSnapshot>;
  resolutionIndex: ReadonlyMap<TokenId, ResolvedTokenView>;
  diagnostics: readonly domain.DiagnosticEvent[];
}
```

- `document`, `graph`, and `resolver` are only present when `includeGraphs` is `true` and the document parsed successfully. The
  document is the domain-level raw document (`domain.RawDocument`) with identity metadata, decoded text, and JSON data.
- `flattened` provides ready-to-render values, aliases, and references.
- `metadataIndex` exposes per-token metadata for descriptions, extensions, and deprecation details.
- `resolutionIndex` mirrors the resolver cache so you can inspect resolution paths, applied overrides, and reference chains.
- `diagnostics` is always populated, even for cache hits. The array is ordered by severity, then by the original emission order.

### Flattened token entries {#flattened-token-entries}

`DtifFlattenedToken` aligns with the DTIF schema. Each entry includes:

- `id`: Stable token identifier, matching the canonical JSON pointer.
- `pointer`: Pointer to the token’s location within the source document.
- `type`: The declared DTIF token type.
- `value`: Resolved JavaScript value suitable for design tooling or build pipelines.
- `raw`: The un-transformed `$value` from the source document.
- `path`: Collection path segments that describe the hierarchy.
- `mode`: Normalised mode value when present.

### Metadata snapshots {#metadata-snapshots}

`createMetadataSnapshot(session, graph)` builds the `metadataIndex` map and is exported for advanced use cases. Metadata entries
are cloned to plain JSON and contain:

- `description`: Normalised description text when present.
- `extensions`: Deep-cloned extension records.
- `deprecated`: Optional object describing deprecation reasons and replacement pointers.
- `source`: `{ uri, line, column }` pointing to the token definition for diagnostics and editor integrations.

### Resolution views {#resolution-views}

`createResolutionSnapshot(resolver)` powers `resolutionIndex`. Each entry tracks:

- `id`, `type`, and `raw` schema-level information.
- `value`: The resolved token value, post-aliasing and overrides.
- `references`: Immediate references encountered while resolving the token.
- `resolutionPath`: The ordered chain of pointers the resolver followed.
- `appliedAliases`: Alias tokens that were ultimately applied.

## Diagnostics {#diagnostics}

The parser never throws for document issues. Instead, each stage records diagnostics as structured events. The token helpers return
an array of domain `DiagnosticEvent` objects ordered by severity, allowing you to iterate and surface messages immediately. CLI output mirrors this
information.

All diagnostics emitted by the loader, schema guard, normaliser, and resolver surface as domain events with stable codes, optional pointers, and spans.
Format diagnostics for terminal output or logging with `formatDiagnostic`:

```ts
import { parseTokens, formatDiagnostic } from '@lapidist/dtif-parser';

const { diagnostics } = await parseTokens('tokens/base.tokens.json');

for (const diagnostic of diagnostics) {
  console.log(formatDiagnostic(diagnostic, { color: process.stdout.isTTY }));
}
```

`parseTokens` invokes `onDiagnostic` and `warn` hooks immediately so tooling can stream feedback while the document is processed.
Cached results re-emit the saved warnings before returning.

## Working with caches {#caching}

The default behaviour performs no caching. Provide a document cache to speed up repeated parses:

```ts
import { createSession, InMemoryDocumentCache } from '@lapidist/dtif-parser';

const cache = new InMemoryDocumentCache({ maxAgeMs: 60_000, maxEntries: 100 });
const session = createSession({ documentCache: cache });
```

Caches receive decoded documents and are responsible for TTL (`maxAgeMs`) and eviction policies. The parser validates cached
bytes before reuse to avoid stale results. Implementations receive the full `RawDocumentIdentity`, so `get`, `set`, and
`delete` should use the identity rather than bare URLs.

The token helpers separate document caching from flattened artefact caching:

```ts
import { parseTokens, InMemoryTokenCache } from '@lapidist/dtif-parser';

const cache = new InMemoryTokenCache({ maxEntries: 50 });
await parseTokens('tokens/base.tokens.json', { tokenCache: cache }); // parses and caches
await parseTokens('tokens/base.tokens.json', { tokenCache: cache }); // served from cache
```

`createTokenCache` exports the same implementation with configuration defaults. Provide your own cache by implementing `get`
and `set` if you need persistence or shared storage.

## Loader configuration {#loader}

`DefaultDocumentLoader` resolves inline content, filesystem paths, and optionally HTTP(S) URLs. It enforces a 5 MiB default byte
cap. Override the loader to integrate custom protocols:

```ts
import { createSession, DefaultDocumentLoader } from '@lapidist/dtif-parser';

const defaultLoader = new DefaultDocumentLoader();

const session = createSession({
  loader: {
    async load(input, context) {
      if (typeof input === 'string' && input.startsWith('memory://')) {
        return {
          uri: new URL(input),
          bytes: fetchFromMemory(input),
          contentType: 'application/json'
        };
      }
      return defaultLoader.load(input, context);
    }
  }
});
```

## Plugins {#plugins}

Plugins extend the parser with `$extensions` collectors and resolution transforms.

```ts
import { createSession } from '@lapidist/dtif-parser';

const session = createSession({
  plugins: [
    {
      name: 'example.extensions',
      extensions: {
        'example.extensions'({ value }) {
          // validate extension payload
          return { normalized: value };
        }
      }
    },
    {
      name: 'example.transforms',
      transformResolvedToken(token) {
        if (token.type === 'color') {
          return { data: { rgb: convertToRgb(token.value) } };
        }
      }
    }
  ]
});
```

Use `createPluginRegistry` when you need to reuse a plugin set across sessions or feed the normalised transforms into manual
resolver construction.

Extension collectors run during normalisation; transform plugins run after resolution. Both may add diagnostics that flow into the
session result.

## Integration tips {#integration-tips}

- Reuse sessions across documents to take advantage of shared caches and schema guards.
- Enforce sensible `maxDepth` limits when resolving user-provided documents.
- Persist the serialised parse result (`document`, `ast`, and `graph`) if downstream tooling relies on consistent pointer structures.
- Normalisation emits plugin evaluations and metadata so IDEs and design tools can surface extension information without re-parsing.

## Node adapter {#node-adapter}

The Node adapter wraps the helper in filesystem-friendly ergonomics:

```ts
import { formatDiagnostic } from '@lapidist/dtif-parser';
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
      console.error(formatDiagnostic(diagnostic));
    }
  }
}
```

- Validates file extensions against the `.tokens.json` convention.
- Normalises diagnostics to domain `DiagnosticEvent` values and exposes them on `DtifTokenParseError`.
- Populates the same flattened token and snapshot structures returned by `parseTokens`.
- Provides `readTokensFile` when you only need the decoded DTIF document.

## Package architecture {#package-architecture}

Understanding how the codebase fits together makes it easier to extend the API without breaking existing workflows.

### Public entry points {#public-entry-points}

The package exposes all user-facing APIs from the main index module:

- [`src/index.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/index.ts) re-exports factories and utilities including
  `createSession`, `parseDocument`, resolver helpers, graph traversal utilities, diagnostic primitives, and the token helpers
  documented above.
- [`src/session.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/session.ts) defines the `ParseSession` class and the
  `createSession` factory. Sessions orchestrate document loading, caching, schema validation, AST normalisation, graph construction,
  and resolver initialisation for each parse request.

### Session lifecycle {#session-lifecycle}

`ParseSession.parseDocument` executes the pipeline below:

1. Use the configured document loader to convert caller input into a `DocumentHandle`, surfacing loader diagnostics on failure.
2. Resolve cached `RawDocument` instances before decoding handles via `decodeDocument`, again collecting diagnostics when decoding fails.
3. Validate the JSON schema through `SchemaGuard`, returning early when the document is invalid while still exposing decoded bytes to the caller.
4. Normalise the AST and build the directed token graph, appending diagnostics to the aggregated `DiagnosticEvent` list that the session returns.
5. Instantiate a `DocumentResolver` that supports alias resolution, overrides, and plugin transforms whenever a graph is available.

The `parseTokens` helper reuses these seams so it can share infrastructure with existing session workflows while layering flattened
outputs and metadata snapshots on top.

### Graph and resolver utilities {#graph-and-resolver-utilities}

Supporting modules wire the AST into usable graph and resolver structures:

- [`src/graph/builder.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/graph/builder.ts) generates a `DocumentGraph` from
  the normalised AST and emits structural diagnostics when relationships cannot be resolved.
- [`src/resolver/document-resolver.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/resolver/document-resolver.ts) implements the
  resolution engine. It tracks visited pointers, enforces the `maxDepth` guard, records override applications, and exposes `ResolvedToken`
  instances for downstream tooling. The resolver already caches intermediate resolution state that snapshot helpers reuse.

### Diagnostics and supporting types {#diagnostics-and-supporting-types}

Diagnostic primitives keep feedback consistent across the loader, normaliser, and resolver:

- [`src/diagnostics/format.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/diagnostics/format.ts) formats `DiagnosticEvent`
  instances for terminal output while respecting working-directory-relative spans and optional colourisation.
- [`src/cli/serialize.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/cli/serialize.ts) converts aggregated diagnostics into
  JSON-friendly structures and severity summaries for the CLI entry points.
- [`src/diagnostics/codes.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/diagnostics/codes.ts) and
  [`src/diagnostics/severity.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/diagnostics/severity.ts) define the severity taxonomy
  and stable diagnostic codes that map onto the domain `DiagnosticEvent` shape.
- [`src/types.ts`](https://github.com/bylapidist/dtif/blob/main/parser/src/types.ts) centralises shared type definitions including `ParseInput`,
  `DocumentGraph`, and the diagnostic model.

### Testing conventions {#testing-conventions}

Tests live alongside the source under `parser/tests` and are split by scope:

- Unit suites in [`tests/unit`](https://github.com/bylapidist/dtif/tree/main/parser/tests/unit) exercise isolated components such as session
  caching, resolver alias chains, snapshot builders, and diagnostic helpers.
- Integration suites in [`tests/integration`](https://github.com/bylapidist/dtif/tree/main/parser/tests/integration) cover multi-file parsing,
  end-to-end `parseTokens` usage—including cache reuse and synchronous inputs—plus the Node adapter surface.

Keeping this reference close to the rest of the documentation ensures ongoing roadmap work builds on a shared understanding of both the
public API and the parser internals.

## Related resources {#related}

- [`@lapidist/dtif-schema`](https://www.npmjs.com/package/@lapidist/dtif-schema)
- [`@lapidist/dtif-validator`](https://www.npmjs.com/package/@lapidist/dtif-validator)
- [`dtif` repository](https://github.com/bylapidist/dtif)
