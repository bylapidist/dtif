---
'@lapidist/dtif-parser': patch
---

Enforce two DTIF conformance requirements in the parser:

- Override matching now ignores unrecognised `$when` keys instead of treating them as hard failures.
- `SchemaGuard` now uses the validator package's semantic checks, so unresolved `$ref` pointers are reported during validation.
