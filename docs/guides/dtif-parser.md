---
title: Using the DTIF parser
description: Learn how to install, configure, and integrate the canonical DTIF parser in tooling and workflows.
keywords:
  - dtif
  - parser
  - guide
  - usage
outline: [2, 3]
---

# DTIF parser guide {#dtif-parser-guide}

The canonical DTIF parser powers validation, normalisation, graph construction, and resolution across the toolchain. This guide focuses on how to consume the parser from applications and CI pipelines rather than on its internal architecture.

## Installation {#installation}

The parser is published as `@lapidist/dtif-parser`. Install it alongside the DTIF schema and validator packages:

```bash
npm install @lapidist/dtif-parser
```

The package ships ESM output, TypeScript declarations, and a `dtif-parse` CLI binary.

## Quick start {#quick-start}

Create a new parse session to reuse caches and configuration across documents:

```ts
import { createSession } from '@lapidist/dtif-parser';

const session = createSession({
  allowHttp: false,
  maxDepth: 32
});

const result = await session.parseDocument('/path/to/tokens.json');

if (result.diagnostics.hasErrors()) {
  // Format diagnostics for display or CI output
}

const resolution = result.resolver?.resolve('#/color/brand/primary');
if (resolution?.token) {
  console.log(resolution.token.value);
}
```

Parse sessions expose:

- `document`: the decoded `RawDocument` including original text and source map.
- `ast`: the normalised AST when schema validation succeeds.
- `graph`: the constructed document graph for pointer lookups.
- `resolver`: a `DocumentResolver` that evaluates aliases, overrides, and fallbacks.
- `extensions`: plugin evaluation results.
- `diagnostics`: a `DiagnosticBag` populated by all pipeline stages.

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

## Configuration options {#configuration}

`createSession` accepts `ParseSessionOptions`:

- **loader** – replace the default document loader.
- **cache** – supply a `DocumentCache` implementation to reuse decoded documents.
- **allowHttp** – allow the default loader to fetch HTTP(S) URLs.
- **maxDepth** – limit resolution depth to guard against cycles.
- **overrideContext** – provide a map of override conditions.
- **schemaGuard** – override the default schema guard instance.
- **plugins** – register parser plugins for `$extensions` handling and post-resolution transforms.

### Working with caches {#caching}

The default behaviour performs no caching. Provide a cache to speed up repeated parses:

```ts
import { createSession, InMemoryDocumentCache } from '@lapidist/dtif-parser';

const cache = new InMemoryDocumentCache({ maxAgeMs: 60_000, maxEntries: 100 });
const session = createSession({ cache });
```

Caches receive decoded documents and are responsible for TTL (`maxAgeMs`) and eviction policies. The parser validates cached bytes before reuse to avoid stale results.

### Loader configuration {#loader}

`DefaultDocumentLoader` resolves inline content, filesystem paths, and optionally HTTP(S) URLs. It enforces a 5&nbsp;MiB default byte cap. Override the loader to integrate custom protocols:

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

Use `createPluginRegistry` when you need to reuse a plugin set across sessions or feed the normalised transforms into manual resolver construction.

Extension collectors run during normalisation; transform plugins run after resolution. Both may add diagnostics that flow into the session result.

## Diagnostics {#diagnostics}

The parser never throws for document issues. Instead, each stage records diagnostics in a `DiagnosticBag`. Use `result.diagnostics.toArray()` for raw access or the helper methods `hasErrors()`, `count()`, and `filter()` to categorise messages.

Each diagnostic includes a code, message, severity, JSON pointer, and optional source span. CLI output mirrors this information.

## Integration tips {#integration-tips}

- Reuse sessions across documents to take advantage of shared caches and schema guards.
- Enforce sensible `maxDepth` limits when resolving user-provided documents.
- Persist the serialised parse result (`document`, `ast`, and `graph`) if downstream tooling relies on consistent pointer structures.
- Normalisation emits plugin evaluations and metadata so IDEs and design tools can surface extension information without re-parsing.

## Related resources {#related}

- [`@lapidist/dtif-schema`](https://www.npmjs.com/package/@lapidist/dtif-schema)
- [`@lapidist/dtif-validator`](https://www.npmjs.com/package/@lapidist/dtif-validator)
- [`dtif` repository](https://github.com/bylapidist/dtif)
