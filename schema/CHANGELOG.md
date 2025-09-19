# @lapidist/dtif-schema changelog

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
