---
title: Metadata
description: Accessibility, semantic intent, and lifecycle metadata associated with DTIF tokens.
keywords:
  - metadata
  - accessibility
  - dtif
  - semantic intent
outline: [2, 3]
---

# Metadata {#metadata}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

Tokens and collections _MAY_ include the optional members listed in the table below.

_Table: Optional metadata members and their intent._

| Member          | Purpose                                                                                                                                                                                                |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$description`  | Human‑readable explanation; tools _MAY_ display it but _MUST NOT_ require it.                                                                                                                          |
| `$deprecated`   | Either a boolean or an object with a `$replacement` JSON Pointer that _MUST_ resolve to an existing token declaring the same `$type`; consumers _SHOULD_ warn and _MAY_ follow the replacement.        |
| `$lastModified` | _MUST_ be an RFC 3339 `date-time` string recording governance actions and establishes the lower bound for `$lastUsed`.                                                                                 |
| `$lastUsed`     | _MUST_ be an RFC 3339 `date-time` string for usage telemetry, _MUST NOT_ precede `$lastModified`, and _MUST_ be accompanied by a `$usageCount` greater than zero.                                      |
| `$usageCount`   | _MUST_ be a non‑negative integer tracking adoption. Values greater than zero _MUST_ appear with `$lastUsed`, while zero indicates no recorded usage and _MUST NOT_ have a companion `$lastUsed` field. |
| `$author`       | _MUST_ be a non-empty string naming the contributor without leading or trailing whitespace.                                                                                                            |
| `$tags`         | _MUST_ be an array of unique classification strings, each free of leading or trailing whitespace.                                                                                                      |
| `$hash`         | _MUST_ be a non-empty stable identifier for change tracking and _MUST NOT_ contain whitespace.                                                                                                         |

Consumers encountering a metadata member whose value violates these requirements
_MUST_ treat the member as absent.

## Accessibility metadata {#accessibility-metadata}

Tokens _MAY_ include accessibility hints such as WCAG contrast
ratios or user preference qualifiers (for example `prefers-reduced-motion`).
Tools _SHOULD_ use these hints to enforce inclusive design while
continuing to honour the underlying token semantics.

```json
{
  "link-color": {
    "$type": "color",
    "$value": { "colorSpace": "srgb", "components": [0, 0, 1] },
    "$extensions": { "org.example.a11y": { "wcagContrast": 4.5 } }
  },
  "fade-duration": {
    "$type": "duration",
    "$value": {
      "durationType": "css.transition-duration",
      "value": 200,
      "unit": "ms"
    },
    "$extensions": { "org.example.a11y": { "prefers-reduced-motion": true } }
  }
}
```

## Semantic intent metadata {#semantic-intent-metadata}

Extensions _MAY_ attach intent descriptors to tokens (for example
`primary action` or `neutral surface`) so that automation and
machine-learning systems can reason about design intent.

```json
{
  "$type": "color",
  "$value": { "colorSpace": "srgb", "components": [0, 0.5, 1] },
  "$extensions": { "org.example.ai": { "intent": "primary action" } }
}
```

::: info
For lifecycle planning guidance, see [Changes](./changes.md#change-management).
:::
