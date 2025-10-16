# @lapidist/dtif-parser changelog

## 1.0.2

### Patch Changes

- [#105](https://github.com/bylapidist/dtif/pull/105) [`fdc1005`](https://github.com/bylapidist/dtif/commit/fdc10058dd584e89c389c325b91fc0e30b454b58) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Ensure lifecycle metadata timestamps are validated and pruned when inconsistent.

- Updated dependencies []:
  - @lapidist/dtif-schema@1.0.2
  - @lapidist/dtif-validator@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [[`632f48e`](https://github.com/bylapidist/dtif/commit/632f48ed3fa2683e3d4e4808c52d9deaabd38af3)]:
  - @lapidist/dtif-schema@1.0.1
  - @lapidist/dtif-validator@1.0.1

## 1.0.0

### Major Changes

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Remove the legacy `DiagnosticBag` helper in favour of working directly with domain `DiagnosticEvent` arrays and update the CLI
  summary utilities accordingly.

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Replace the legacy document cache interface with the domain-level cache port so session options and helpers consume
  `RawDocumentIdentity` aware caches directly.

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - - Replace token parsing diagnostics with domain-level `DiagnosticEvent` objects so `parseTokens` and `parseTokensSync` surface the same structured events as `parseDocument`.
  - Remove the token diagnostic helpers in favour of a shared `formatDiagnostic` utility and update the Node adapter to emit domain diagnostics.

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Rename the session `cache` option to `documentCache` and update token helpers to
  forward document caches through the base session options. Update your
  integrations to pass `documentCache` when supplying custom document caches.

### Minor Changes

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Promote the domain token cache primitives by removing the legacy `ParseCache` adapter, renaming the public API to `TokenCache`,
  and updating the parser documentation to describe the new `tokenCache` option alongside the domain-first plugin infrastructure.

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Introduce application-layer use cases that orchestrate the new domain services and adapters so synchronous and asynchronous
  pipelines can share the same flow, adopt the document/token orchestration inside the async parseTokens entrypoint, and port
  parseTokensSync onto the same use case with dedicated inline ingestion/decoding adapters to eliminate duplicated parsing
  logic while reshaping token cache key derivation to depend on domain-level configuration instead of resolved session
  options.

  Centralize token cache variant derivation inside the shared ParseTokens use case so cache keys always reflect the same
  flatten/include configuration regardless of entrypoint.

  Expose the application-level parse result shape directly from `parseDocument`, `parseCollection`, and the CLI so
  consumers receive domain diagnostics alongside graph/resolution snapshots without the legacy compatibility wrapper.

  Remove the legacy document compatibility layer so parse sessions and token helpers operate on the domain raw document
  model directly, simplifying caching, diagnostics, and downstream adapters.

  Retire the CLI diagnostic shim by teaching the command to consume domain diagnostic events directly, allowing the shared
  bag/serialization utilities to operate without converting back to the legacy diagnostic shape.

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Refine override evaluation to route diagnostics through the shared collector so resolver internals no longer manage ad-hoc arrays.

### Patch Changes

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Fix token flattening generics and inline ingestion utilities so the parser build
  and lint suites succeed under the new domain-first pipeline.

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - - Preserve token flattener diagnostics in cached snapshots so warm parses continue reporting them.

- [#92](https://github.com/bylapidist/dtif/pull/92) [`3bbe4e6`](https://github.com/bylapidist/dtif/commit/3bbe4e65974380b36a90834e79273c815f1f04e8) Thanks [@brettdorrans](https://github.com/brettdorrans)! - - Consolidate document-request normalization behind a shared factory and reuse it across session and token entry points.
  - Move inline document handle and decoder helpers into the application layer so ingestion adapters no longer depend on token utilities.
  - Route the CLI through the shared parse-document use case so it no longer depends on the legacy session orchestration.
- Updated dependencies []:
  - @lapidist/dtif-schema@1.0.0
  - @lapidist/dtif-validator@1.0.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@0.5.0
  - @lapidist/dtif-validator@0.5.0

## 0.4.0

### Minor Changes

- [#79](https://github.com/bylapidist/dtif/pull/79) [`32ffb62`](https://github.com/bylapidist/dtif/commit/32ffb62bbece47047411cd7e1b52e43ba56906cb) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enable Ajv strict mode across the schema, validator, parser, and tooling.

### Patch Changes

- Updated dependencies [[`32ffb62`](https://github.com/bylapidist/dtif/commit/32ffb62bbece47047411cd7e1b52e43ba56906cb)]:
  - @lapidist/dtif-schema@0.4.0
  - @lapidist/dtif-validator@0.4.0

## 0.3.4

### Patch Changes

- [#76](https://github.com/bylapidist/dtif/pull/76) [`7cd863d`](https://github.com/bylapidist/dtif/commit/7cd863dd0a6cdb4b405764e456adab6f7bd18260) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Improve async iterable detection so collections handle `Symbol.asyncIterator` getters correctly.

- Updated dependencies []:
  - @lapidist/dtif-schema@0.3.4
  - @lapidist/dtif-validator@0.3.4

## 0.3.3

### Patch Changes

- [#74](https://github.com/bylapidist/dtif/pull/74) [`c5af388`](https://github.com/bylapidist/dtif/commit/c5af38890d09da7360eb20c337a9ebcf1b58dcb3) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Document contributor workflow expectations in the repository-level agent guide.

- Updated dependencies [[`c5af388`](https://github.com/bylapidist/dtif/commit/c5af38890d09da7360eb20c337a9ebcf1b58dcb3)]:
  - @lapidist/dtif-schema@0.3.3
  - @lapidist/dtif-validator@0.3.3

## 0.3.2

### Patch Changes

- [#71](https://github.com/bylapidist/dtif/pull/71) [`af99b1f`](https://github.com/bylapidist/dtif/commit/af99b1f5ed2f506788e45869b6c575521ab3a3bd) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Trigger a patch release for the DTIF packages.

- Updated dependencies [[`af99b1f`](https://github.com/bylapidist/dtif/commit/af99b1f5ed2f506788e45869b6c575521ab3a3bd)]:
  - @lapidist/dtif-schema@0.3.2
  - @lapidist/dtif-validator@0.3.2

## 0.3.1

### Patch Changes

- [#66](https://github.com/bylapidist/dtif/pull/66) [`675271f`](https://github.com/bylapidist/dtif/commit/675271f8a75b8eb4b672822d09e1435cd4ba4033) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add the parser to the fixed release group and align package versions.

- Updated dependencies [[`675271f`](https://github.com/bylapidist/dtif/commit/675271f8a75b8eb4b672822d09e1435cd4ba4033)]:
  - @lapidist/dtif-schema@0.3.1
  - @lapidist/dtif-validator@0.3.1

## 0.3.0

### Minor Changes

- [#64](https://github.com/bylapidist/dtif/pull/64) [`b8ff611`](https://github.com/bylapidist/dtif/commit/b8ff611a17394bd9bdc6822cc01f28f15ddd129b) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Expose the `parseTokens` helpers, metadata and resolution snapshots, diagnostic formatters, caching utilities, and a Node adapter surface for DTIF token parsing.

## 0.2.1

### Patch Changes

- [#60](https://github.com/bylapidist/dtif/pull/60) [`2732e67`](https://github.com/bylapidist/dtif/commit/2732e67888b5c83624a11dc086677790a4b51955) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Trigger a patch release.

- Updated dependencies [[`2732e67`](https://github.com/bylapidist/dtif/commit/2732e67888b5c83624a11dc086677790a4b51955)]:
  - @lapidist/dtif-schema@0.2.1
  - @lapidist/dtif-validator@0.2.1

## 0.2.0

### Minor Changes

- [#55](https://github.com/bylapidist/dtif/pull/55) [`df44ed8`](https://github.com/bylapidist/dtif/commit/df44ed8cc76d22e6780b6b4b4e6965ff42c76130) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Introduce the canonical DTIF parser package with the full pipeline from loading
  and decoding through schema validation, normalisation, graph construction, and
  resolution. Ship the `dtif-parse` CLI, document and cache integrations,
  configurable resolver depth limits, and plugin hooks that surface extension
  results and resolved-token transforms alongside structured diagnostics.
- Align dependencies on @lapidist/dtif-schema and @lapidist/dtif-validator to
  version 0.2.0 so all packages publish together.

All notable changes to this project will be documented in this file.

Release notes are generated from Changesets during publishing.
