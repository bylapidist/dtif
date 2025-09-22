# @lapidist/dtif-validator changelog

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
