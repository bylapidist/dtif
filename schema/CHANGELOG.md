# @lapidist/dtif-schema changelog

## 2.0.0

### Patch Changes

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Clarify the architecture model token definition to match the schema: tokens declare exactly one of `$value` or `$ref`, while collections declare neither.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Allow reverse-DNS extension identifiers with hyphenated labels (for example `com.example-ui.tokens`) so schema validation matches DTIF extension namespace rules.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Align override and semantic validation behavior with the DTIF specification.
  - Schema now permits override entries that omit `$ref`/`$value`/`$fallback` or combine `$ref` with `$value`, so consumers can ignore those entries instead of rejecting entire documents.
  - Parser normalisation now ignores invalid override and fallback entries with warnings rather than parse-stopping errors.
  - Semantic validation no longer applies DTIF reference/ordering checks inside arbitrary `$extensions` payloads and ignored unknown typography properties.
  - Added conformance fixtures and parser regression tests covering ignored-invalid overrides and literal `$ref` members in extension/unknown-property payloads.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Reject absolute-path and schemeless network-path `$ref` values so only local pointers, relative document paths, and explicit HTTP(S) references are accepted.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Disallow unrecognised reserved `$*` members inside `typography.$value` while preserving unknown non-reserved properties for forward compatibility.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Clarify conformance wording so non-object `$extensions` members invalidate tokens, matching schema validation behavior.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Block directory traversal attempts that use backslash separators or `%5C` encoded separators in `$ref` values.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Reject unrecognised reserved (`$*`) members in component values, cursor object payloads, cursor parameters, and function-parameter object literals to align with conformance and extensibility rules.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Fix the repository README release-history section by removing the non-existent root CHANGELOG link and listing changelogs for all published workspaces.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Tighten motion conformance by requiring rotation axes to include `x`, `y`, and `z` with at least one non-zero component, and reject motion parameters that reference non-`dimension` tokens.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce `$overrides` resolution-source exclusivity so each override uses exactly one of `$ref`, `$value`, or `$fallback`, matching the DTIF theming specification.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Clarify metadata conformance text so invalid metadata members make the containing token invalid, matching current schema enforcement.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Adjust change-management wording so key-order requirements are documented as interoperability guidance enforced by lint/tooling rather than core schema validation.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Restore normative ordering requirements in the change-management specification by reverting accidental downgrades from MUST to SHOULD.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce additional DTIF spec constraints across schema and validator.
  - restrict `dimension` length/angle/resolution units to spec-defined grammars
  - require `$deprecated.$replacement` to be a local JSON Pointer
  - enforce known CSS color-space component cardinality for `color` tokens
  - add regression fixtures for these invalid states and align parser schema-guard diagnostics tests

## 1.0.6

## 1.0.5

### Patch Changes

- [#136](https://github.com/bylapidist/dtif/pull/136) [`896d74d`](https://github.com/bylapidist/dtif/commit/896d74d7630c2c02718954f6fee06438039dbdc5) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Declare Node.js 22+/npm 10+ support in workspace manifests and update docs to match the repository support policy.

## 1.0.4

### Patch Changes

- [#128](https://github.com/bylapidist/dtif/pull/128) [`9e317da`](https://github.com/bylapidist/dtif/commit/9e317dab8aebf0cdb1f2fc17af151e671e4cb702) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Document support for Node.js 22 or newer across the DTIF packages.

## 1.0.3

## 1.0.2

## 1.0.1

### Patch Changes

- [#98](https://github.com/bylapidist/dtif/pull/98) [`632f48e`](https://github.com/bylapidist/dtif/commit/632f48ed3fa2683e3d4e4808c52d9deaabd38af3) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Fix the DesignTokenInterchangeFormat declarations so $-prefixed metadata fields no longer conflict with token map entries under strict TypeScript.

## 1.0.0

## 0.5.0

## 0.4.0

### Minor Changes

- [#79](https://github.com/bylapidist/dtif/pull/79) [`32ffb62`](https://github.com/bylapidist/dtif/commit/32ffb62bbece47047411cd7e1b52e43ba56906cb) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enable Ajv strict mode across the schema, validator, parser, and tooling.

## 0.3.4

## 0.3.3

### Patch Changes

- [#74](https://github.com/bylapidist/dtif/pull/74) [`c5af388`](https://github.com/bylapidist/dtif/commit/c5af38890d09da7360eb20c337a9ebcf1b58dcb3) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Document contributor workflow expectations in the repository-level agent guide.

## 0.3.2

### Patch Changes

- [#71](https://github.com/bylapidist/dtif/pull/71) [`af99b1f`](https://github.com/bylapidist/dtif/commit/af99b1f5ed2f506788e45869b6c575521ab3a3bd) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Trigger a patch release for the DTIF packages.

## 0.3.1

### Patch Changes

- [#66](https://github.com/bylapidist/dtif/pull/66) [`675271f`](https://github.com/bylapidist/dtif/commit/675271f8a75b8eb4b672822d09e1435cd4ba4033) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add the parser to the fixed release group and align package versions.

## 0.2.1

### Patch Changes

- [#60](https://github.com/bylapidist/dtif/pull/60) [`2732e67`](https://github.com/bylapidist/dtif/commit/2732e67888b5c83624a11dc086677790a4b51955) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Trigger a patch release.

## 0.2.0

### Minor Changes

- Align the schema package version with the parser release so all DTIF packages
  publish together.

## 0.1.7

### Patch Changes

- [#49](https://github.com/bylapidist/dtif/pull/49) [`6edd6cb`](https://github.com/bylapidist/dtif/commit/6edd6cbc6c61279bdc8a0aae229fbd6a58f60224) Thanks [@brettdorrans](https://github.com/brettdorrans)! - - enforce CSS text-decoration shorthand and text-transform list grammar in typography tokens
  - add fixtures that cover valid combinations and pattern failures for textDecoration/textTransform
  - document the stricter validation for migrating DTCG exports

## 0.1.6

### Patch Changes

- [#47](https://github.com/bylapidist/dtif/pull/47) [`e254786`](https://github.com/bylapidist/dtif/commit/e254786ab4998dbc7c3d07edac3f152fa0fe2bbe) Thanks [@brettdorrans](https://github.com/brettdorrans)! - - tighten gradient hint validation to require a single `<length-percentage>` token while allowing top-level `var()`/`env()` functions and document the migration path for DTCG exports with paired hints

## 0.1.5

### Patch Changes

- [#45](https://github.com/bylapidist/dtif/pull/45) [`8f94a29`](https://github.com/bylapidist/dtif/commit/8f94a2968d90941b2f7f8c2f881273c7799730e0) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Tighten font family validation to require CSS `<family-name>` strings across `font`, `fontFace`, and `typography` tokens while enforcing URI-safe `fontFace` source URLs.

## 0.1.4

### Patch Changes

- [#43](https://github.com/bylapidist/dtif/pull/43) [`e915ff3`](https://github.com/bylapidist/dtif/commit/e915ff3d8945280fe99eaefb82728872557c5678) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce non-empty `$value` arrays even when tokens omit `$type` and constrain `gradientType` to the linear/radial/conic functions documented by Token types, updating migration guidance and regression tests.

## 0.1.3

### Patch Changes

- [`08c6750`](https://github.com/bylapidist/dtif/commit/08c6750655ca8f5908e199b2fb4e0e9801be3788) Thanks [@brettdorrans](https://github.com/brettdorrans)! - force release

## 0.1.2

### Patch Changes

- [`41257af`](https://github.com/bylapidist/dtif/commit/41257af19b8999d719fc56a5ae6d8ba3bda90362) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add sRGB hex color serialisation, strokeStyle token support, font fallback stacks, layered shadow handling, and composite token reuse safeguards while enforcing reverse-DNS identifiers and clarifying shadow fallbacks, collection guards, and migration docs

## 0.1.1

### Patch Changes

- [#38](https://github.com/bylapidist/dtif/pull/38) [`1333a3b`](https://github.com/bylapidist/dtif/commit/1333a3b8caa1532aa86cafc4b0399e1a19a1baaf) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add sRGB hex color serialisation, strokeStyle token support, font fallback stacks, layered shadow handling, and composite token reuse safeguards while enforcing reverse-DNS identifiers and clarifying shadow fallbacks, collection guards, and migration docs

All notable changes to this project will be documented in this file.

## Unreleased

- Allow `$value` entries to provide ordered fallback arrays that mix inline
  literals, `$ref` aliases, and functions while enforcing non-empty sequences.
- Permit collections that contain only metadata to validate so DTCG group
  metadata can migrate without introducing placeholder tokens.
- Centralise css/ios/android identifier and function-name validation through
  reusable `$defs`, improving diagnostics for cursor, border, duration, motion,
  and filter members.
- Disambiguate `shadow` `$value` arrays so literal layer stacks remain valid
  while fallback arrays must include an alias or function, and surface clear
  errors when collections attempt to declare `$type` or `$ref`.
