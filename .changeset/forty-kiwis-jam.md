---
'@lapidist/dtif-schema': patch
'@lapidist/dtif-validator': patch
---

Tighten motion conformance by requiring rotation axes to include `x`, `y`, and `z` with at least one non-zero component, and reject motion parameters that reference non-`dimension` tokens.
