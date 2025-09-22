---
title: Canonical parser architecture
description: High-level architecture, roadmap, and contributor guidance for the official DTIF parser.
keywords:
  - parser
  - architecture
  - dtif
  - design tokens
outline: [2, 3, 4]
---

# Canonical parser architecture {#canonical-parser-architecture}

> This guide is non-normative. It captures the reference architecture for the canonical DTIF parser along with the roadmap and quality guardrails that shape its implementation.

## Goals {#goals}

- Deliver an official `@lapidist/dtif-parser` package that all DTIF tooling can embed without re-implementing parsing, resolution, or diagnostics.
- Provide a uniform runtime that understands JSON and YAML serialisations, honours the [DTIF specification](../spec/index.md#dtif-specification), and keeps aliases, overrides, and metadata intact.
- Surface rich diagnostics with source locations so authoring tools and CI pipelines can report actionable issues.
- Remain extensible: vendors should supply custom loaders, caching, and `$extensions` interpreters without forking the parser.
- Align with existing workspaces (`schema`, `validator`) and reuse their assets rather than duplicating schema knowledge.

## Non-goals {#non-goals}

- Replacing the JSON Schema validation packages already published by this repository. The parser orchestrates them but does not redefine schemas.
- Shipping UI tooling. The parser emits structured data for other applications to consume.
- Introducing runtime execution of arbitrary extensions. The parser exposes hooks but leaves execution of vendor code to integrators.

## Core use cases {#core-use-cases}

- Design tool exporters embedding the parser to verify and normalise documents before writing files.
- Build pipelines translating DTIF into platform assets while relying on the parser for reference resolution and override evaluation.
- Language bindings (TypeScript/JavaScript first, other runtimes via generated JSON) that need a stable in-memory representation.
- Registry operations (for example linting submissions) that must dereference cross-document pointers safely.

## Architectural overview {#architectural-overview}

The parser is layered so each concern remains testable and reusable. The orchestration entry point is a `ParseSession` that drives the following pipeline:

```text
Input -> Loader -> Decoder -> Schema guard -> Normaliser -> Document graph -> Resolver -> Outputs
```

Each stage accepts structured input from the previous stage and emits typed data plus diagnostics. Stages never throw for user errors; they push diagnostics and either recover or stop gracefully.

### Pipeline stages {#pipeline-stages}

| Stage          | Responsibility                                                                                                                                                         | Key module(s)                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Loader         | Accepts URLs, file paths, Node streams, or raw objects. Normalises them into `DocumentHandle` records with canonical URIs and byte content while enforcing configurable byte limits for untrusted input.                            | `io/document-loader.ts`, `io/document-cache.ts`     |
| Decoder        | Detects JSON vs YAML, decodes UTF-8/UTF-16 input, and produces `RawDocument` objects plus a source map capturing character offsets.                                    | `io/decoder.ts`, `io/source-map.ts`        |
| Schema guard   | Runs `@lapidist/dtif-schema` via AJV to assert structural validity before deeper analysis. Diagnostics include schema paths and pointer locations.                     | `validation/schema-guard.ts`               |
| Normaliser     | Builds a typed AST describing collections, tokens, aliases, metadata, and override blocks. Ensures reserved members are canonicalised.                                 | `ast/normaliser.ts`, `ast/nodes.ts`        |
| Document graph | Converts AST nodes into a graph that spans internal and external references. Nodes contain pre-computed pointer indices for O(1) lookups.                              | `graph/builder.ts`, `graph/nodes.ts`       |
| Resolver       | Evaluates `$ref`, `$overrides`, and `$fallback` chains with cycle detection, caching, and context awareness. Produces resolved token views and exposes lazy iterators. | `resolver/index.ts`, `resolver/context.ts` |
| Outputs        | Surfaces stable APIs: raw AST, resolved token graph, JSON serialiser, diagnostics stream, and metadata summaries.                                                      | `public-api.ts`                            |

## Module layout {#module-layout}

### Workspace structure {#workspace-structure}

A new workspace `parser` will be added alongside `schema` and `validator`:

```text
parser/
  package.json
  src/
    index.ts
    io/
    ast/
    graph/
    resolver/
    diagnostics/
    utils/
    plugins/
    cli/
  tests/
    fixtures/
    unit/
    integration/
```

The package exports both ESM and CJS builds, type declarations, and ship-ready source maps. Build tooling reuses the existing `scripts/build-packages.mjs` pipeline.

### Core runtime modules {#core-runtime-modules}

- **`src/index.ts`** exposes the stable API surface documented in [API design](#api-design).
- **`io/document-loader.ts`** defines an asynchronous `DocumentLoader` interface with default file-system, HTTP(S), and in-memory implementations. It supports caching and redaction policies specified in options, and enforces configurable byte limits (5&nbsp;MiB by default) to defend against untrusted payloads.
- **`io/document-cache.ts`** implements the default in-memory `DocumentCache` with configurable TTL and LRU eviction for decoded documents.
- **`io/decoder.ts`** performs BOM detection, encoding conversion, and JSON/YAML parsing (via `yaml` dependency). It records a translation map from pointer segments to byte offsets for diagnostics.
- **`validation/schema-guard.ts`** wraps AJV instances from `@lapidist/dtif-validator`. It compiles schemas on demand and caches validators keyed by spec version.
- **`ast/*`** defines typed nodes (`CollectionNode`, `TokenNode`, `AliasNode`, `OverrideNode`) and a normaliser that canonicalises ordering, ensures reserved member casing, and stores provenance metadata.
- **`graph/*`** builds a `DocumentGraph` where each node knows its JSON Pointer, `$type`, and inbound/outbound reference edges. It supports incremental updates for long-lived sessions.
- **`resolver/*`** implements multi-phase resolution:
  1. Expand local references.
  2. Resolve external documents asynchronously via the loader while preventing duplicate fetches.
  3. Evaluate overrides with context filters, fallback chains, and cycle detection across both tokens and overrides.
  4. Produce deterministic resolved values while preserving alias metadata for tooling that needs to surface both.
- **`diagnostics/*`** houses severity enums, diagnostic codes, message formatters, and helpers for spanning character ranges.
- **`utils/*`** centralises JSON Pointer manipulation and source-span helpers reused across pipeline stages.
- **`plugins/*`** provides hook registration for: custom document loaders, `$extensions` decoders, context providers (for overrides), and post-processing.
- **`cli/*`** implements a lightweight `dtif-parse` binary for smoke testing and manual inspection (reads from stdin or file paths and prints diagnostics plus resolved tokens).

## Data model {#data-model}

### Documents and handles {#documents-and-handles}

- `ParseInput` accepts `string | Uint8Array | URL | { uri: string; content: string | Uint8Array; }`.
- `DocumentHandle` stores `{ uri: URL; contentType: "application/json" | "application/yaml"; bytes: Uint8Array; sourceMap: SourceMap; }`.
- `ParseSessionOptions` include: custom loader, trust policies (allow HTTP?), maximum depth, override context map, cache strategy, and toggles for lazy resolution.

### AST representation {#ast-representation}

- `CollectionNode` represents top-level token groups (for example `color`, `typography`). It records child pointers and metadata.
- `TokenNode` holds `{ pointer: JSONPointer; type: string; value?: TokenValue; ref?: JSONPointer; description?: string; extensions?: Record<string, unknown>; provenance: SourceSpan; }`.
- `AliasNode` is a specialised `TokenNode` where `value` is absent and `ref` is set.
- `OverrideNode` stores `$token`, `$when`, `$ref`, `$value`, and `$fallback` entries, each with their own provenance and compiled pointer references.
- Metadata nodes preserve `$metadata`, `$documentation`, and vendor namespaces so the parser can emit them unchanged.

### Document graph {#document-graph}

- `DocumentGraph` indexes nodes by absolute JSON Pointer (for example `#/color/brand/primary`).
- Edges reference either other pointers in the same document or `DocumentHandle` identifiers for external resources. Each edge contains resolution status (`pending`, `resolved`, `errored`) and diagnostics accumulated during traversal.
- Graph nodes are consumed by the resolver to produce `ResolvedToken` objects containing the chosen value, provenance chain, and applied overrides.
- Cycle detection uses a depth-first traversal stack keyed by `{documentUri, pointer, overridePath}` tuples.

### Resolver output {#resolver-output}

- `DocumentResolver` consumes a `DocumentGraph`, override context map, and session options to evaluate tokens, aliases, and `$overrides` chains.
- Resolution results are exposed as `ResolvedToken` objects containing the computed value, originating pointer, applied overrides (including fallback entries), accumulated warnings, and a trace describing the traversal path.
- `resolver.resolve(pointer)` returns diagnostics when encountering cycles, unresolved pointers, external references, or type mismatches, allowing tooling to fail fast without throwing exceptions.

### Diagnostics {#diagnostics-model}

- `Diagnostic` contains `{ code: string; message: string; severity: "error" | "warning" | "info"; pointer?: JSONPointer; span?: SourceSpan; related?: RelatedInformation[]; }`.
- Codes follow a structured scheme (`DTIF0010` for schema failures, `DTIF1010` for resolution, etc.). Messages include actionable remediation hints.
- `DiagnosticBag` collects entries, supports filtering by severity, and serialises to JSON or formatted text for CLI output.

## API design {#api-design}

Public exports prioritise composability:

- `parseDocument(input, options?): Promise<ParseResult>` loads, validates, and returns `{ document: RawDocument; ast: DocumentAst; graph: DocumentGraph; diagnostics: DiagnosticBag; }`.
- `parseCollection(inputs, options?): Promise<ParseResult>` accepts arrays or async iterables of inputs for multi-document themes. It merges them according to layer order while maintaining individual diagnostics.
- `createSession(options?)` returns a long-lived `ParseSession` for repeated calls with shared caches and context overrides.
- `ResolvedToken` objects expose `.value`, `.type`, `.source`, `.overridesApplied`, and `.warnings` fields, plus `.toJSON()` to emit canonical JSON.
- CLI entry point reuses `parseCollection` and prints structured diagnostics using the same message formatters.

APIs follow the repository’s `type: module` conventions and ship `.d.ts` declarations for consumer tooling.

## Extensibility {#extensibility}

- **Document loaders:** Consumers may pass custom loader implementations to handle in-memory virtual files, encrypted stores, or alternative protocols. The default loader supports file paths and HTTPS with strict URL allow lists.
- **Override contexts:** `ParseSessionOptions` accepts a resolver that maps `$when` keys to boolean predicates. The parser evaluates overrides lazily using these providers.
- **Extension handlers:** Plugins register callbacks for namespaces inside `$extensions`. Handlers can validate or normalise data without affecting unrelated namespaces. `ParserPlugin` objects declared via session options surface their evaluations through `ParseResult.extensions` alongside any diagnostics the handler emits.
- **Result transforms:** Hooks receive resolved tokens for post-processing (for example automatically mapping to CSS variables) while preserving the canonical data. Transform outputs are collected on `ResolutionResult.transforms` so downstream tooling can inspect derived metadata without mutating canonical values.

## Implementation roadmap {#implementation-roadmap}

1. **Bootstrap package scaffolding**
   - Add a `parser` workspace with build scripts, TypeScript configuration, linting, and initial CLI entry point stub.
   - Wire the package into `scripts/build-packages.mjs`, `package.json` workspaces, and CI scripts.
2. **Diagnostics and utilities**
   - Implement `Diagnostic`, `DiagnosticBag`, pointer utilities, and source span helpers.
   - Establish shared constants for diagnostic codes and severity ordering.
3. **Loader and decoder**
   - Build the default `DocumentLoader`, encoding detection, and YAML/JSON decoding with source mapping.
   - Write unit tests covering BOMs, invalid UTF-8, YAML anchors, and mixed newline styles.
4. **Schema integration**
   - Integrate `@lapidist/dtif-schema` and `@lapidist/dtif-validator`, ensuring schema caching and consistent diagnostics.
   - Add integration tests using documents under `examples/` and intentionally malformed fixtures.
5. **AST and normalisation**
   - Define node types, normalise reserved members, and capture provenance metadata.
   - Validate invariants such as `$type` presence for aliases and correct `$extensions` structure.
6. **Graph construction and resolution**
   - Build the `DocumentGraph`, implement pointer indexing, and integrate asynchronous external fetches.
   - Implement override evaluation, fallback chains, and cycle detection per [Theming and overrides](../spec/theming-overrides.md#theming-and-overrides).
7. **Public API polish**
   - Finalise `parseDocument`, `parseCollection`, CLI output, and TypeScript declarations.
   - Document usage and publish examples verifying round-trip serialisation.
8. **Performance and resilience**
   - Profile large documents, add caching knobs, and document safe defaults for untrusted input.

Each milestone should land with accompanying documentation updates and tests before proceeding.

## Quality strategy {#quality-strategy}

- **Unit tests** target loaders, decoders, AST transforms, and resolver algorithms with fixture-based assertions.
- **Integration tests** parse the `examples/` corpus, compare resolved graphs against stored snapshots, and ensure diagnostics remain stable.
- **Property tests** (where feasible) generate random pointer graphs to stress cycle detection and fallback ordering.
- **Fuzzing hooks** allow external contributions to run against the decoder stage without executing downstream code.
- **Documentation** stays co-located with code through `docs/` updates and TSDoc comments exported in the package bundle.
- **Versioning** follows semver with `0.x` during incubation; once stable, breaking changes require major bumps coordinated via the registry change process.

## Implementation guidelines {#implementation-guidelines}

The architecture is intended to land incrementally so each stage remains reviewable and well tested. Contributors working on the parser should:

- Revisit this guide before starting a new milestone to confirm assumptions around the pipeline, data model, and public API surface.
- Survey the existing implementations in `schema/` and `validator/` to understand reusable utilities and schema assets.
- Choose the next unfinished milestone from the [implementation roadmap](#implementation-roadmap) and land it completely—including documentation and tests—before advancing.
- Capture a brief plan for significant changes covering intended behaviour, affected modules, and the validation strategy so reviews stay anchored to the architecture goals.
- Extend or create unit tests under `parser/tests/unit` for focused logic and complement them with integration coverage in `parser/tests/integration` when stages interact end to end.
- Prefer fixtures in `parser/tests/fixtures` for repeatable inputs and avoid network access or external side effects during tests.
- Run the relevant npm scripts (for example `npm test`, workspace-specific build commands, or `npm run lint:docs`) before opening a pull request to keep the package in a releasable state.
- Keep the repository tidy by applying the configured formatting, respecting `.editorconfig`, and ensuring `git status` is clean prior to submitting changes.

Questions or new discoveries that could influence the roadmap should be reflected back into this guide so future contributors inherit the additional context.
