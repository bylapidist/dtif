---
'@lapidist/dtif-parser': patch
'@lapidist/dtif-validator': patch
---

Enforce DTIF conformance requirements across parser and validator:

- Override matching now ignores unrecognised `$when` keys instead of treating them as hard failures.
- `SchemaGuard` now uses the validator package's semantic checks, so unresolved `$ref` pointers are reported during validation.
- Semantic reference validation now treats relative external pointers as local-document references (not network refs), while still enforcing HTTP(S)-only remote schemes and remote opt-in.
