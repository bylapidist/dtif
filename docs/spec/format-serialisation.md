---
title: Format and serialisation
description: Reserved members and serialisation rules for DTIF token documents.
keywords:
  - dtif
  - format
  - serialisation
  - references
outline: [2, 3]
---

# Format and serialisation {#format-and-serialisation}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

This chapter lists the reserved members available to every token document and outlines how references resolve across files.

## `$type` {#type}

`$type` classifies the semantics of a token’s `$value`. The registry
maintained by the specification editor defines the following well‑known categories:

- **Primitives:** `color`, `dimension`,
  `font`, `opacity`, `duration`, `easing`,
  `z-index`
- **Composite:** `typography`, `shadow`,
  `gradient`, `filter`, `motion`, `elevation`

Vendors _MAY_ introduce custom types by registering them or by
using `$extensions`. Consumers encountering an unknown `$type`
_SHOULD_ warn but _MUST NOT_ fail, and
_MUST_ preserve the token and all of its fields.

See [Token types](./token-types.md#value) for detailed value semantics associated with each registered category.

## `$ref` {#ref}

`$ref` provides an alias to another token. Its value
_MUST_ be a JSON Pointer as defined in
[RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) or a URI
containing a fragment that is a JSON Pointer.

Reference strings _MUST_ include a `#` fragment
containing the JSON Pointer. Local aliases therefore _MUST_ start
with `#`, while external references _MUST_ append
`#` and the pointer to a relative path or an HTTP(S) URI. Pointer segments
_MUST_ escape `~` and `/` characters as
`~0` and `~1` respectively.

Tokens that declare `$ref` without `$value`
_MUST_ also declare `$type` so that tooling can reason
about the referenced semantics without resolving the pointer. Alias tokens
_MUST NOT_ include `$value`.

Consumers _MUST_ resolve `$ref` using the following
algorithm:

1. If the string contains directory traversal segments such as
   `../` or `%2e%2e`, the token _MUST_ be
   treated as invalid.
2. Interpret the string as a URI-reference.
3. If the reference has a network scheme, it
   _MUST NOT_ be dereferenced without explicit user opt‑in; absent
   such opt‑in the token is invalid.
4. If the reference has no scheme, resolve it against the location of the document
   containing the reference.
5. If the resolved reference has a fragment, interpret it as a JSON Pointer and evaluate it
   against the referenced document.
6. If the referenced token contains `$ref`, resolve it recursively.
7. Maintain a set of visited references; if a reference recurs, the token
   _MUST_ be treated as invalid. This detection
   _MUST_ include references traversed while evaluating
   `$overrides` and their `$fallback` chains. When override
   resolution re-enters a previously visited target, consumers
   _MUST_ report a circular dependency error.
8. If evaluation fails to yield a value, the token is invalid.

Consumers _MAY_ cache dereferenced documents. Resolution order is
local tokens before external documents.

## `$description` {#description}

Human-readable description. Tools _MAY_ display it but
_MUST NOT_ require it.

## `$extensions` {#extensions}

`$extensions` _MUST_ be an object mapping extension
identifiers to arbitrary JSON values. Keys _MUST_ use lower-case
reverse domain name notation with at least two labels, such as `com.example`,
to avoid collisions. A registry of well-known namespaces is maintained by the
specification editor. Consumers encountering a non-object `$extensions` member
_MUST_ treat the token as invalid.

Consumers _MUST_ preserve unrecognised extensions.

### Extension naming guidelines {#extension-naming-guidelines}

Producers _MUST_ scope proprietary data stored in
`$extensions` using a stable prefix such as a reverse-DNS identifier (for
example `org.example.typography`). To keep ecosystems interoperable, follow
these practices:

- Reuse namespaces listed in the [DTIF registry](https://github.com/bylapidist/dtif/blob/main/registry/README.md)
  before inventing new prefixes; submit additions when no suitable namespace exists.
- Publish contact information and a canonical specification URL for each namespace so
  tools can resolve semantics and ask questions about versioning.
- Provide namespace documentation alongside shared token payloads, especially when
  tokens leave the originating organisation.
- Avoid overloading a namespace with unrelated features; define new subdomains when
  semantics diverge to prevent collisions.

Consumers _MUST_ ignore unrecognised namespaces to maintain
interoperability while surfacing warnings where helpful.
