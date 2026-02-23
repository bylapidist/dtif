---
'@lapidist/dtif-schema': patch
'@lapidist/dtif-validator': patch
---

Reject absolute-path and schemeless network-path `$ref` values so only local pointers, relative document paths, and explicit HTTP(S) references are accepted.
