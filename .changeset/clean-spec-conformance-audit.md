---
"@lapidist/dtif-schema": patch
"@lapidist/dtif-validator": patch
"@lapidist/dtif-parser": patch
---

Align override and semantic validation behavior with the DTIF specification.

- Schema now permits override entries that omit `$ref`/`$value`/`$fallback` or combine `$ref` with `$value`, so consumers can ignore those entries instead of rejecting entire documents.
- Parser normalisation now ignores invalid override and fallback entries with warnings rather than parse-stopping errors.
- Semantic validation no longer applies DTIF reference/ordering checks inside arbitrary `$extensions` payloads and ignored unknown typography properties.
- Added conformance fixtures and parser regression tests covering ignored-invalid overrides and literal `$ref` members in extension/unknown-property payloads.
