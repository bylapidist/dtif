---
title: Conformance
description: Producer, consumer, and validator obligations for the Design Token Interchange Format.
keywords:
  - conformance
  - dtif
  - requirements
  - error handling
outline: [2, 3]
---

# Conformance {#conformance}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

As well as sections marked non-normative, all authoring guidelines, diagrams, examples, and
notes in this specification are non-normative. Normative sections use the terms
_MUST_, _SHOULD_, and
_MAY_ as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Conformance classes {#conformance-classes}

- **Producer:** serialises token documents. Producers
  _MUST_ output UTF‑8 encoded JSON,
  _SHOULD_ include a `$version` member, and
  _MAY_ include `$schema`.
- **Consumer:** reads token documents. Consumers
  _MUST_ parse JSON, _MUST_ resolve
  `$ref` values, _MUST_ reject unrecognised reserved members
  beginning with `$` (outside schema-defined extension payloads), and _SHOULD_ warn on unknown
  `$type` values.
- **Validator:** evaluates token documents. Validators
  _MUST_ enforce this specification and
  _MAY_ offer corrective guidance.

## Error handling {#error-handling}

- Invalid JSON: Consumers _MUST_ reject the document.
- Unknown extension identifiers: Consumers _MAY_ ignore but
  _MUST_ preserve the associated extension payload when it appears under a valid `$extensions` namespace key.
- Unknown `$type`: Consumers _MAY_ ignore but
  _SHOULD_ warn.
- Invalid `$ref`: Consumers _MUST_ treat the token as
  invalid.
- Unsupported units: Consumers _MAY_ warn but
  _MUST NOT_ reject the token.
- Major `$version` mismatch: Consumers _SHOULD_ warn and
  _MAY_ ignore the document.

See [Architecture and model](./architecture-model.md#architecture-and-model) for structural constraints and [Format and serialisation](./format-serialisation.md#format-and-serialisation) together with [Token types](./token-types.md#value) for token member semantics referenced by these requirements.
