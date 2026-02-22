---
title: Architecture and model
description: Core concepts for DTIF token documents including structure, encoding, and versioning.
keywords:
  - data model
  - dtif
  - token document
  - versioning
outline: [2, 3]
---

# Architecture and model {#architecture-and-model}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

This chapter defines the structural foundations for token documents and builds on the [terminology](./terminology.md#terminology) definitions.

## Document structure {#document-structure}

A [token document](./terminology.md#token-document) _MUST_ be a JSON object. Members whose names do
not begin with `$` _MUST_ be treated as tokens or
collections. Members beginning with `$` are reserved for this specification.

Property names are case-sensitive and _MAY_ contain any Unicode
characters.

Documents _MAY_ contain a top-level `$extensions` member
for metadata that applies to the entire document.

## Tokens and collections {#tokens-and-collections}

A [token](./terminology.md#token) is an object with exactly one of `$value` or `$ref`. A [collection](./terminology.md#collection) is an object without
either `$value` or `$ref` whose properties are tokens or collections.

Collections and tokens _MAY_ be nested arbitrarily.

Consumers _MUST NOT_ execute code when processing token documents.

## UTF-8 encoding {#utf-8-encoding}

Token documents _MUST_ be encoded in UTF‑8.
`$description` values _MAY_ contain text in any natural
language and _MUST_ follow the [Unicode Standard](https://unicode.org/versions/latest/).

## Versioning {#versioning}

Token documents _SHOULD_ provide a `$version` member that
_MUST_ conform to
[Semantic Versioning 2.0.0](https://semver.org/). Consumers encountering a
future major version _SHOULD_ warn and _MAY_
treat the document as incompatible. Consumers encountering a future
minor or patch version _MAY_ continue processing.

See [Format and serialisation](./format-serialisation.md#format-and-serialisation) and [Token types](./token-types.md#value) for the normative definition of reserved members and [Change management](./changes.md#change-management) for guidance on versioning strategies.
