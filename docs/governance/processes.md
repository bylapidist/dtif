---
title: Governance processes
description: Governance conformance expectations, change-control workflow, registries, and compatibility commitments.
keywords:
  - governance
  - change control
  - registry
  - compatibility
outline: [2, 3]
---

# Governance processes {#governance-processes}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

As well as sections marked non-normative, all authoring guidelines, diagrams, examples, and notes in this specification are non-normative. Normative sections use the terms _MUST_, _SHOULD_, and _MAY_ as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

This chapter documents the change-control workflow and registry stewardship obligations for the specification.

## Change control process {#change-control-process}

Proposals for new features or `$type` identifiers _MUST_ be filed as GitHub issues. The specification editor reviews proposals and records decisions. Deprecated features remain supported for at least two revision cycles.

## Registries {#registries}

The specification editor maintains registries for `$type` values and extension namespaces. Each entry records the owner, contact information, and specification reference.

## Backward compatibility {#backward-compatibility}

Breaking changes increment the major version. Implementations _SHOULD_ support the previous major version for a grace period of twelve months.
