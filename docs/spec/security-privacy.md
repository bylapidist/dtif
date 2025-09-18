---
title: Security, privacy, and related considerations
description: Accessibility, internationalisation, security, privacy, and performance requirements for DTIF.
outline: [2, 3]
---

# Security, privacy, and related considerations {#security-privacy}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

## Accessibility considerations {#accessibility-considerations}

Token metadata such as `$description` and `$tags`
_SHOULD_ be written so that assistive tools can present tokens
effectively. Consumers _MUST_ preserve these text alternatives.

## Internationalisation considerations {#internationalisation-considerations}

Token names and descriptions _MAY_ use any Unicode characters.
Consumers _MUST_ preserve text as authored and
_SHOULD_ support right-to-left scripts.

## Security considerations {#security-considerations}

Token documents _MUST NOT_ execute arbitrary code. Consumers
_MUST_ reject `$ref` values that attempt directory
traversal such as `../` and _MUST NOT_ dereference remote
references without explicit user opt‑in. Implementations
_SHOULD_ limit the size of retrieved resources. Test fixtures at
`tests/fixtures/negative/security/path-traversal` and
`tests/fixtures/negative/security/remote-scheme` illustrate these restrictions.

## Privacy considerations {#privacy-considerations}

Token documents _MAY_ include authorship and usage metadata.
Producers _SHOULD_ avoid embedding personally identifiable
information, and consumers handling such data _MUST_ comply with
applicable privacy regulations.

## Performance considerations {#performance-considerations}

Producers _SHOULD_ keep token documents small enough for static
analysis and _MAY_ split large systems into multiple files. Consumers
_SHOULD_ support streaming or incremental parsing and
_MAY_ cache resolved references to minimise network traffic.

See [Platform guidance](../guides/platform-guidance.md#platform-guidance) for the non-normative ecosystem advice that accompanied these requirements.
