---
'@lapidist/dtif-parser': patch
---

Refactor parser architecture and maintainability hotspots by:

- fixing loader diagnostic mapping so host allow-list failures and size-limit failures emit distinct diagnostics,
- centralizing loader diagnostic mapping for resolver and adapter paths,
- removing the input/decoder layering cycle for inline YAML helpers,
- deduplicating parse-tokens result assembly across API surfaces,
- reducing application-layer coupling to session/token cache types via runtime-option and token-cache contracts,
- moving token use-case factory responsibilities into the tokens package.
