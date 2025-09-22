# @lapidist/dtif-parser changelog

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
