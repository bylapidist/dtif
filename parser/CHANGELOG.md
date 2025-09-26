# @lapidist/dtif-parser changelog

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
