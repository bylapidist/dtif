---
title: Introduction
description: Abstract, scope, and reading order for the Design Token Interchange Format core specification.
keywords:
  - dtif
  - design tokens
  - specification
  - scope
outline: [2, 3]
---

# Introduction {#introduction}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

This chapter summarises the DTIF scope and guides readers through the remaining chapters.

## Abstract {#abstract}

The Design Token Interchange Format (DTIF) defines a JSON-based carrier for design tokens.
It enables tools to exchange design decisions such as colour, typography, and spacing in a
consistent and extensible manner.

## Scope {#scope}

DTIF is a vendor-neutral interchange format. It does not define authoring interfaces,
storage mechanisms, or platform-specific representations.

## Specification structure {#specification-structure}

This chapter organises the normative content into the following sections:

- [Terminology](./terminology.md#terminology) - Definitions for key terms such as token document, collection, and namespace.
- [Architecture and model](./architecture-model.md#architecture-and-model) - Token document structure, collections, encoding, and versioning guarantees.
- [Format and serialisation](./format-serialisation.md#format-and-serialisation) - Reserved members and aliasing behaviour.
- [Token types](./token-types.md#value) - Value semantics for registered primitives and composites.
- [Typography](./typography.md#typography) - Composition rules, font metrics, and related colour guidance.
- [Theming and overrides](./theming-overrides.md#theming-and-overrides) - Layering model and conditional overrides for token documents.
- [Metadata](./metadata.md#metadata) - Accessibility, semantic intent, and lifecycle metadata carried by tokens.
- [Extensibility](./extensibility.md#extensibility) - Extension model and namespace registration expectations.
- [Conformance](./conformance.md#conformance) - Requirements for producers, consumers, and validators, including error handling expectations.
- [Security, privacy, and related considerations](./security-privacy.md#security-privacy) - Accessibility, internationalisation, security, privacy, and performance requirements.
- [Normative references](./references.md#normative-references) - Authoritative specifications referenced throughout the document.
- [Change management](./changes.md#change-management) - Compatibility guidance for evolving token sets.

Additional supporting materials include the [registry](https://github.com/bylapidist/dtif/blob/main/registry/README.md) and the [governance section](/governance/).
