# @lapidist/dtif-language-server

## 0.5.0

### Minor Changes

- [#82](https://github.com/bylapidist/dtif/pull/82) [`2edeea4`](https://github.com/bylapidist/dtif/commit/2edeea4958b8ed303053636536f6f3cf371623ca) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add contextual completions for `$type`, measurement `unit` values, and `$extensions` namespaces when editing DTIF documents.

- [#82](https://github.com/bylapidist/dtif/pull/82) [`2edeea4`](https://github.com/bylapidist/dtif/commit/2edeea4958b8ed303053636536f6f3cf371623ca) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add jump-to-definition support for local JSON pointer references such as `$ref` and override `token`/`ref` fields.

- [#82](https://github.com/bylapidist/dtif/pull/82) [`2edeea4`](https://github.com/bylapidist/dtif/commit/2edeea4958b8ed303053636536f6f3cf371623ca) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add pointer hover support that surfaces token metadata and a formatted JSON preview for the referenced pointer.

- [#82](https://github.com/bylapidist/dtif/pull/82) [`2edeea4`](https://github.com/bylapidist/dtif/commit/2edeea4958b8ed303053636536f6f3cf371623ca) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add the DTIF language server workspace with lifecycle wiring, a baseline LSP handshake, and CI/build integration.

- [#82](https://github.com/bylapidist/dtif/pull/82) [`2edeea4`](https://github.com/bylapidist/dtif/commit/2edeea4958b8ed303053636536f6f3cf371623ca) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add workspace configuration for schema diagnostics and telemetry with guarded logging around validation, indexing, and settings refreshes.

- [#82](https://github.com/bylapidist/dtif/pull/82) [`2edeea4`](https://github.com/bylapidist/dtif/commit/2edeea4958b8ed303053636536f6f3cf371623ca) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add JSON parsing and schema-driven diagnostics so the language server reports DTIF schema violations with precise ranges.

- [#82](https://github.com/bylapidist/dtif/pull/82) [`2edeea4`](https://github.com/bylapidist/dtif/commit/2edeea4958b8ed303053636536f6f3cf371623ca) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add pointer rename refactors that update definitions and references alongside quick fixes for missing `$type` and `$ref` schema diagnostics.

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@0.5.0
  - @lapidist/dtif-validator@0.5.0
  - @lapidist/dtif-parser@0.5.0

All notable changes to this project will be documented in this file.

## 0.4.0

- Added JSON parsing and schema validation diagnostics that refresh as DTIF documents change.
- Implemented jump-to-definition for local JSON pointers referenced via `$ref`, override `token`, and `ref` fields.
- Added pointer hover responses that summarise target token metadata and render a JSON preview.
- Delivered rename refactors that update pointer definitions alongside all `$ref` usages across open documents.
- Introduced quick fixes for missing `$type` and `$ref` properties reported by the schema validator.
- Added contextual completions for `$type` identifiers, measurement `unit` values, and `$extensions` namespaces.
- Added workspace configuration for toggling schema diagnostics.
