---
"@lapidist/dtif-parser": minor
---

Refactor parser architecture for maintainability by centralizing parse-input contracts and inline content sniffing, extracting external graph loading into a dedicated resolver provider, introducing a shared runtime composition helper for session/CLI/token APIs, tightening `parseTokensSync` option contracts, removing internal type import cycles, and adding local architecture documentation.
