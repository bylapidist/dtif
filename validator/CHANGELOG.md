# @lapidist/dtif-validator changelog

## 2.0.0

### Patch Changes

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce metadata and override reference type conformance in semantic validation, and stop misclassifying registered DTIF `$type` identifiers as unknown.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce DTIF semantic invariants in the validator by checking canonical ordering and reference resolution rules in addition to schema validation, and expose warning diagnostics for unknown `$type` values and future major `$version` declarations.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Align override and semantic validation behavior with the DTIF specification.
  - Schema now permits override entries that omit `$ref`/`$value`/`$fallback` or combine `$ref` with `$value`, so consumers can ignore those entries instead of rejecting entire documents.
  - Parser normalisation now ignores invalid override and fallback entries with warnings rather than parse-stopping errors.
  - Semantic validation no longer applies DTIF reference/ordering checks inside arbitrary `$extensions` payloads and ignored unknown typography properties.
  - Added conformance fixtures and parser regression tests covering ignored-invalid overrides and literal `$ref` members in extension/unknown-property payloads.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Reject absolute-path and schemeless network-path `$ref` values so only local pointers, relative document paths, and explicit HTTP(S) references are accepted.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Disallow unrecognised reserved `$*` members inside `typography.$value` while preserving unknown non-reserved properties for forward compatibility.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Reject token aliases whose `$ref` resolves to a token with a different `$type`, enforcing DTIF alias type compatibility in semantic validation.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Remove non-spec decimal precision rejection from conformance tooling and treat high-precision dimension values as valid, matching the specification’s guidance to preserve precision rather than invalidate values.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Block directory traversal attempts that use backslash separators or `%5C` encoded separators in `$ref` values.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Tighten motion conformance by requiring rotation axes to include `x`, `y`, and `z` with at least one non-zero component, and reject motion parameters that reference non-`dimension` tokens.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce additional DTIF semantic requirements in the validator by rejecting unsorted gradient stops, invalid motion path timelines (`start=0`, `end=1`, monotonic keyframe times), non-easing motion path easing references, and incompatible `dimension` function expressions (`calc` unit family mixing and `clamp` min/max inversion).

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Reject incompatible literal unit categories inside motion function parameters so rotation angles only accept angle units and translation/path coordinates only accept length units.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Permit external override `$token` pointers during semantic validation instead of incorrectly requiring local in-document targets.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Treat opt-in remote `$ref` values as invalid when they cannot be resolved, and package validator semantic helpers explicitly so published builds retain semantic conformance checks.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce DTIF conformance requirements across parser and validator:
  - Override matching now ignores unrecognised `$when` keys instead of treating them as hard failures.
  - `SchemaGuard` now uses the validator package's semantic checks, so unresolved `$ref` pointers are reported during validation.
  - Semantic reference validation now treats relative external pointers as local-document references (not network refs), while still enforcing HTTP(S)-only remote schemes and remote opt-in.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce motion dimension-category semantics by rejecting rotation angles that do not resolve to `dimensionType: angle` and translation/path coordinates that do not resolve to `dimensionType: length`.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Allow deferred remote reference resolution when both external-reference and remote-reference opt-ins are enabled. Default validation remains strict and continues to reject unresolved external references.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce stricter DTIF reference conformance by rejecting unresolved external references during validation unless explicit opt-in is provided. This update adds validator checks for unresolved relative and remote external refs by default, wires parser defaults to opt in to external-reference validation deferral when a loader is available, and adds regression coverage in conformance tooling.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Align validator conformance fixtures and type-compat checks with DTIF override semantics for external `$token` references.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce additional DTIF spec constraints across schema and validator.
  - restrict `dimension` length/angle/resolution units to spec-defined grammars
  - require `$deprecated.$replacement` to be a local JSON Pointer
  - enforce known CSS color-space component cardinality for `color` tokens
  - add regression fixtures for these invalid states and align parser schema-guard diagnostics tests

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Load known token types from the DTIF registry in addition to schema clauses so semantic type warnings follow registry-backed definitions.

- [#188](https://github.com/bylapidist/dtif/pull/188) [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add semantic conformance checks for override inline values, function parameter alias typing, and typography nested reference typing so spec-invalid documents are rejected by the validator.

- [#190](https://github.com/bylapidist/dtif/pull/190) [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Align fixture conformance tooling with motion token semantics by enforcing `dimensionType` category checks for motion rotation angles and translation/path coordinates.

- Updated dependencies [[`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`31b6f44`](https://github.com/bylapidist/dtif/commit/31b6f44a06680ce17c73718d2c58c1048b17c742), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559), [`10ca030`](https://github.com/bylapidist/dtif/commit/10ca0300937774e422f06e65eedc2dcb123e2559)]:
  - @lapidist/dtif-schema@2.0.0

## 1.0.6

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@1.0.6

## 1.0.5

### Patch Changes

- [#136](https://github.com/bylapidist/dtif/pull/136) [`896d74d`](https://github.com/bylapidist/dtif/commit/896d74d7630c2c02718954f6fee06438039dbdc5) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Share Ajv default options and format registration between validator and parser to keep validation configuration aligned.

- [#136](https://github.com/bylapidist/dtif/pull/136) [`896d74d`](https://github.com/bylapidist/dtif/commit/896d74d7630c2c02718954f6fee06438039dbdc5) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Declare Node.js 22+/npm 10+ support in workspace manifests and update docs to match the repository support policy.

- Updated dependencies [[`896d74d`](https://github.com/bylapidist/dtif/commit/896d74d7630c2c02718954f6fee06438039dbdc5)]:
  - @lapidist/dtif-schema@1.0.5

## 1.0.4

### Patch Changes

- [#128](https://github.com/bylapidist/dtif/pull/128) [`9e317da`](https://github.com/bylapidist/dtif/commit/9e317dab8aebf0cdb1f2fc17af151e671e4cb702) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Document support for Node.js 22 or newer across the DTIF packages.

- Updated dependencies [[`9e317da`](https://github.com/bylapidist/dtif/commit/9e317dab8aebf0cdb1f2fc17af151e671e4cb702)]:
  - @lapidist/dtif-schema@1.0.4

## 1.0.3

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [[`632f48e`](https://github.com/bylapidist/dtif/commit/632f48ed3fa2683e3d4e4808c52d9deaabd38af3)]:
  - @lapidist/dtif-schema@1.0.1

## 1.0.0

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@1.0.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@0.5.0

## 0.4.0

### Minor Changes

- [#79](https://github.com/bylapidist/dtif/pull/79) [`32ffb62`](https://github.com/bylapidist/dtif/commit/32ffb62bbece47047411cd7e1b52e43ba56906cb) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enable Ajv strict mode across the schema, validator, parser, and tooling.

### Patch Changes

- Updated dependencies [[`32ffb62`](https://github.com/bylapidist/dtif/commit/32ffb62bbece47047411cd7e1b52e43ba56906cb)]:
  - @lapidist/dtif-schema@0.4.0

## 0.3.4

### Patch Changes

- Updated dependencies []:
  - @lapidist/dtif-schema@0.3.4

## 0.3.3

### Patch Changes

- [#74](https://github.com/bylapidist/dtif/pull/74) [`c5af388`](https://github.com/bylapidist/dtif/commit/c5af38890d09da7360eb20c337a9ebcf1b58dcb3) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Document contributor workflow expectations in the repository-level agent guide.

- Updated dependencies [[`c5af388`](https://github.com/bylapidist/dtif/commit/c5af38890d09da7360eb20c337a9ebcf1b58dcb3)]:
  - @lapidist/dtif-schema@0.3.3

## 0.3.2

### Patch Changes

- [#71](https://github.com/bylapidist/dtif/pull/71) [`af99b1f`](https://github.com/bylapidist/dtif/commit/af99b1f5ed2f506788e45869b6c575521ab3a3bd) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Trigger a patch release for the DTIF packages.

- Updated dependencies [[`af99b1f`](https://github.com/bylapidist/dtif/commit/af99b1f5ed2f506788e45869b6c575521ab3a3bd)]:
  - @lapidist/dtif-schema@0.3.2

## 0.3.1

### Patch Changes

- [#66](https://github.com/bylapidist/dtif/pull/66) [`675271f`](https://github.com/bylapidist/dtif/commit/675271f8a75b8eb4b672822d09e1435cd4ba4033) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add the parser to the fixed release group and align package versions.

- Updated dependencies [[`675271f`](https://github.com/bylapidist/dtif/commit/675271f8a75b8eb4b672822d09e1435cd4ba4033)]:
  - @lapidist/dtif-schema@0.3.1

## 0.2.1

### Patch Changes

- [#60](https://github.com/bylapidist/dtif/pull/60) [`2732e67`](https://github.com/bylapidist/dtif/commit/2732e67888b5c83624a11dc086677790a4b51955) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Trigger a patch release.

- Updated dependencies [[`2732e67`](https://github.com/bylapidist/dtif/commit/2732e67888b5c83624a11dc086677790a4b51955)]:
  - @lapidist/dtif-schema@0.2.1

## 0.2.0

### Minor Changes

- Align the validator package version with the parser release so all DTIF
  packages publish together.
- Updated dependencies
  - @lapidist/dtif-schema@0.2.0

## 0.1.7

### Patch Changes

- [#49](https://github.com/bylapidist/dtif/pull/49) [`6edd6cb`](https://github.com/bylapidist/dtif/commit/6edd6cbc6c61279bdc8a0aae229fbd6a58f60224) Thanks [@brettdorrans](https://github.com/brettdorrans)! - - enforce CSS text-decoration shorthand and text-transform list grammar in typography tokens
  - add fixtures that cover valid combinations and pattern failures for textDecoration/textTransform
  - document the stricter validation for migrating DTCG exports
- Updated dependencies [[`6edd6cb`](https://github.com/bylapidist/dtif/commit/6edd6cbc6c61279bdc8a0aae229fbd6a58f60224)]:
  - @lapidist/dtif-schema@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies [[`e254786`](https://github.com/bylapidist/dtif/commit/e254786ab4998dbc7c3d07edac3f152fa0fe2bbe)]:
  - @lapidist/dtif-schema@0.1.6

## 0.1.5

### Patch Changes

- [#45](https://github.com/bylapidist/dtif/pull/45) [`8f94a29`](https://github.com/bylapidist/dtif/commit/8f94a2968d90941b2f7f8c2f881273c7799730e0) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Tighten font family validation to require CSS `<family-name>` strings across `font`, `fontFace`, and `typography` tokens while enforcing URI-safe `fontFace` source URLs.

- Updated dependencies [[`8f94a29`](https://github.com/bylapidist/dtif/commit/8f94a2968d90941b2f7f8c2f881273c7799730e0)]:
  - @lapidist/dtif-schema@0.1.5

## 0.1.4

### Patch Changes

- [#43](https://github.com/bylapidist/dtif/pull/43) [`e915ff3`](https://github.com/bylapidist/dtif/commit/e915ff3d8945280fe99eaefb82728872557c5678) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Enforce non-empty `$value` arrays even when tokens omit `$type` and constrain `gradientType` to the linear/radial/conic functions documented by Token types, updating migration guidance and regression tests.

- Updated dependencies [[`e915ff3`](https://github.com/bylapidist/dtif/commit/e915ff3d8945280fe99eaefb82728872557c5678)]:
  - @lapidist/dtif-schema@0.1.4

## 0.1.3

### Patch Changes

- [`08c6750`](https://github.com/bylapidist/dtif/commit/08c6750655ca8f5908e199b2fb4e0e9801be3788) Thanks [@brettdorrans](https://github.com/brettdorrans)! - force release

- Updated dependencies [[`08c6750`](https://github.com/bylapidist/dtif/commit/08c6750655ca8f5908e199b2fb4e0e9801be3788)]:
  - @lapidist/dtif-schema@0.1.3

## 0.1.2

### Patch Changes

- [`41257af`](https://github.com/bylapidist/dtif/commit/41257af19b8999d719fc56a5ae6d8ba3bda90362) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add sRGB hex color serialisation, strokeStyle token support, font fallback stacks, layered shadow handling, and composite token reuse safeguards while enforcing reverse-DNS identifiers and clarifying shadow fallbacks, collection guards, and migration docs

- Updated dependencies [[`41257af`](https://github.com/bylapidist/dtif/commit/41257af19b8999d719fc56a5ae6d8ba3bda90362)]:
  - @lapidist/dtif-schema@0.1.2

## 0.1.1

### Patch Changes

- [#38](https://github.com/bylapidist/dtif/pull/38) [`1333a3b`](https://github.com/bylapidist/dtif/commit/1333a3b8caa1532aa86cafc4b0399e1a19a1baaf) Thanks [@brettdorrans](https://github.com/brettdorrans)! - Add sRGB hex color serialisation, strokeStyle token support, font fallback stacks, layered shadow handling, and composite token reuse safeguards while enforcing reverse-DNS identifiers and clarifying shadow fallbacks, collection guards, and migration docs

- Updated dependencies [[`1333a3b`](https://github.com/bylapidist/dtif/commit/1333a3b8caa1532aa86cafc4b0399e1a19a1baaf)]:
  - @lapidist/dtif-schema@0.1.1

All notable changes to this project will be documented in this file.

## Unreleased

- No changes yet.
