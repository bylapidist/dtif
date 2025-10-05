---
'@lapidist/dtif-parser': major
---

- Replace token parsing diagnostics with domain-level `DiagnosticEvent` objects so `parseTokens` and `parseTokensSync` surface the same structured events as `parseDocument`.
- Remove the token diagnostic helpers in favour of a shared `formatDiagnostic` utility and update the Node adapter to emit domain diagnostics.
