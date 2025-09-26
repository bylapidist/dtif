# @lapidist/dtif-language-server

All notable changes to this project will be documented in this file.

## 0.4.0

- Added JSON parsing and schema validation diagnostics that refresh as DTIF documents change.
- Implemented jump-to-definition for local JSON pointers referenced via `$ref`, override `token`, and `ref` fields.
- Added pointer hover responses that summarise target token metadata and render a JSON preview.
- Delivered rename refactors that update pointer definitions alongside all `$ref` usages across open documents.
- Introduced quick fixes for missing `$type` and `$ref` properties reported by the schema validator.
- Added contextual completions for `$type` identifiers, measurement `unit` values, and `$extensions` namespaces.
- Added workspace configuration for toggling schema diagnostics.
