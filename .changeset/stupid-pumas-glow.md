---
'@lapidist/dtif-parser': patch
---

Reject inline override and fallback values when they are incompatible with the target token type, and emit resolver type-mismatch diagnostics instead of silently applying invalid values.
