# @lapidist/dtif-schema changelog

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
