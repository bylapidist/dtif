---
'@lapidist/dtif-parser': patch
---

Resolve external `$ref` targets in async parser flows by loading referenced documents, building graphs for them, and wiring the resolver to follow cross-document aliases with network dereferencing gated behind explicit opt-in.
