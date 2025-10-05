---
'@lapidist/dtif-parser': minor
---

Introduce application-layer use cases that orchestrate the new domain services and adapters so synchronous and asynchronous
pipelines can share the same flow, adopt the document/token orchestration inside the async parseTokens entrypoint, and port
parseTokensSync onto the same use case with dedicated inline ingestion/decoding adapters to eliminate duplicated parsing
logic while reshaping token cache key derivation to depend on domain-level configuration instead of resolved session
options.

Centralize token cache variant derivation inside the shared ParseTokens use case so cache keys always reflect the same
flatten/include configuration regardless of entrypoint.

Expose the application-level parse result shape directly from `parseDocument`, `parseCollection`, and the CLI so
consumers receive domain diagnostics alongside graph/resolution snapshots without the legacy compatibility wrapper.

Remove the legacy document compatibility layer so parse sessions and token helpers operate on the domain raw document
model directly, simplifying caching, diagnostics, and downstream adapters.

Retire the CLI diagnostic shim by teaching the command to consume domain diagnostic events directly, allowing the shared
bag/serialization utilities to operate without converting back to the legacy diagnostic shape.
