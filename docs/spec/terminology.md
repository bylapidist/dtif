---
title: Terminology
description: Definitions of key terms used throughout the Design Token Interchange Format specification.
keywords:
  - glossary
  - terminology
  - dtif
outline: [2, 3]
---

# Terminology {#terminology}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

This glossary defines the normative vocabulary used across the specification.

## Terms {#terms}

### Token document {#token-document}

JSON object conforming to this specification.

### Document version {#document-version}

Semantic Versioning 2.0.0 string identifying the revision of a token document.

### Token {#token}

Object whose members include either `$value` or `$ref`. Tokens
_SHOULD_ declare `$type` so their semantics remain
explicit even when metadata is copied independently of parent collections.

### Collection {#collection}

Object whose members are tokens or other collections.

### Extension identifier {#extension-identifier}

Lower-case reverse domain name with at least one dot used as a key in
`$extensions`.

### Alias {#alias}

Token that resolves to another token via `$ref`. Alias tokens
_MUST_ declare `$type` and
_MUST NOT_ include `$value`.

### Producer {#producer}

Implementation that serialises token documents.

### Consumer {#consumer}

Implementation that reads token documents.

### Validator {#validator}

Implementation that reports conformance results.

### Namespace {#namespace}

Prefix used in extension identifiers to avoid collisions.

### Theme {#theme}

Ordered layer of token overrides identified by name.

### Variant {#variant}

Collection of tokens applied conditionally to a theme.
