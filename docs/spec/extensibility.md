---
title: Extensibility
description: Forward-compatibility requirements and extension registration guidance for DTIF.
keywords:
  - extensibility
  - dtif
  - extensions
outline: [2, 3]
---

# Extensibility {#extensibility}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

This chapter explains how extensions remain interoperable and where governance processes handle registration.

Future extensions _MAY_ introduce new `$type` identifiers
or members beginning with `$`. Implementations
_MUST_ ignore unknown members to ensure forward compatibility.

## Governance {#governance}

Proposals for new `$type` values or extension namespaces
_SHOULD_ be submitted to the specification editor for registration.
See the [governance stream](/governance/) for processes and timelines.
