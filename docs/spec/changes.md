---
title: Change management
description: Compatibility expectations for evolving DTIF token documents.
keywords:
  - change management
  - compatibility
  - dtif
outline: [2, 3]
---

# Change management {#change-management}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

Collections of tokens- including the document root and nested groups-
_SHOULD_ list their non-`$` members in lexicographic order
so diffs remain stable. Within typed value objects this specification defines canonical
property sequences (for example `dimensionType`, `value`,
`unit`) and those canonical orders _SHOULD_ take precedence
over naive lexical sorting. Collections _MAY_ be versioned using
Semantic Versioning at the document level. Tools _SHOULD_ compute
`$hash` values and lint and validate documents in continuous integration
pipelines.
