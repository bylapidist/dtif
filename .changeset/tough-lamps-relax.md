---
'@lapidist/dtif-schema': patch
'@lapidist/dtif-validator': patch
'@lapidist/dtif-parser': patch
---

Enforce additional DTIF spec constraints across schema and validator.

- restrict `dimension` length/angle/resolution units to spec-defined grammars
- require `$deprecated.$replacement` to be a local JSON Pointer
- enforce known CSS color-space component cardinality for `color` tokens
- add regression fixtures for these invalid states and align parser schema-guard diagnostics tests
