---
'@lapidist/dtif-parser': patch
---

- Consolidate document-request normalization behind a shared factory and reuse it across session and token entry points.
- Move inline document handle and decoder helpers into the application layer so ingestion adapters no longer depend on token utilities.
- Route the CLI through the shared parse-document use case so it no longer depends on the legacy session orchestration.
