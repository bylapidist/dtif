---
title: Theming and overrides
description: Layered token documents and conditional override behaviour in DTIF.
keywords:
  - theming
  - overrides
  - dtif
  - design tokens
outline: [2, 3]
---

# Theming and overrides {#theming-and-overrides}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

This chapter defines how layered documents evaluate overrides and resolve context-specific variants.

## Layered documents {#layered-documents}

Token documents _MAY_ be layered to create themes. When multiple
documents are merged, later documents _MUST_ override earlier ones
for identical JSON Pointer paths. Theme identifiers _SHOULD_ use
human‑readable names such as `light` and `dark`. Conditional
variants _MAY_ be expressed using `$extensions`.

## `$overrides` {#overrides}

A token document _MAY_ include a `$overrides` array at
the document root. Each override maps contextual conditions to an alternate token
reference or value. Overrides are evaluated sequentially. Consumers
_MUST_ process overrides in array order, evaluating each entry
against the current context. When multiple matching entries target the same
`$token`, the last matching entry _MUST_ take effect and
earlier matches _MUST_ be ignored.

An override object _MUST_ contain a `$token` field whose
value is a JSON Pointer to the token being overridden and a `$when` object
describing the matching context. It _MUST_ provide either a
`$ref` field pointing to an existing token, an inline
`$value` field, or a `$fallback` field supplying one or more
alternatives. `$ref` and `$value`
_MUST NOT_ both appear. The token addressed by `$token`
_MUST_ declare a base `$value` or `$ref` so
resolution can fall back to the original definition when no override applies. The override
target _MUST_ be a token object that declares `$type`;
pointers resolving to collections or untyped nodes _MUST_ be
reported as errors.

Override `$token`, `$ref`, and `$fallback` entries share
the same lexical rules as token aliases: each string _MUST_ contain
a `#` fragment encoding the JSON Pointer using `/`-delimited
segments with `~0`/`~1` escapes and
_MUST_ either start with `#` or prefix the pointer with
a relative path or HTTP(S) URI.

Inline values within overrides- including those nested inside
`$fallback` chains- _MUST_ satisfy the schema for the
target token's declared `$type`. Referenced tokens
_MUST_ resolve to the same `$type`. An override that
omits all of `$ref`, `$value`, and `$fallback`, or that
specifies both `$ref` and `$value`, is invalid and
_MUST_ be ignored.

The `$fallback` field _MAY_ be a single object
containing `$ref` or `$value` and its own `$fallback`, or
it _MAY_ be an array of such objects evaluated in order. Consumers
apply the first entry that resolves; subsequent entries act as fallbacks in case earlier
ones cannot be resolved.

The `$token` pointer for an override _MUST_ resolve to
an existing token. When evaluating `$ref` entries- including those nested inside
`$fallback` chains- consumers _MUST_ ensure that every
pointer they dereference resolves. If override evaluation exhausts its candidates without
producing a resolved pointer, consumers _MUST_ treat the unresolved
pointer as an error rather than silently ignoring the override.

When resolving overrides- including nested `$fallback` chains- consumers
_MUST_ detect circular dependencies. Implementations
_MUST_ track visited override targets during resolution and report
an error if evaluation returns to a previously visited target.

This specification does not define the structure of the `$when` object;
producers and consumers _MAY_ agree on arbitrary keys (for example
`prefers-color-scheme` or `platform`). Consumers encountering
`$when` keys they do not recognise _MUST_ ignore those
keys. When no recognised keys match the current context, the override does not apply and
the base token value _MUST_ be used.

Overrides do not replace the referenced tokens; they redirect aliases based on context.
Tokens for each variant _MUST_ be declared separately to preserve
explicitness.

```json
{
  "$overrides": [
    {
      "$token": "#/button/bg",
      "$when": { "prefers-color-scheme": "dark" },
      "$ref": "#/color/brand/dark"
    }
  ]
}
```

```json
{
  "$overrides": [
    {
      "$token": "#/button/text",
      "$when": { "prefers-color-scheme": "dark" },
      "$value": { "colorSpace": "srgb", "components": [1, 1, 1, 1] }
    }
  ]
}
```

```json
{
  "$overrides": [
    {
      "$token": "#/button/text",
      "$when": { "prefers-color-scheme": "dark" },
      "$fallback": [
        { "$ref": "#/color/brand/dark" },
        { "$value": { "colorSpace": "srgb", "components": [1, 1, 1, 1] } }
      ]
    }
  ]
}
```

A complete document demonstrating override mechanics is available at
[examples/overrides.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/overrides.tokens.json).

## Common condition keys {#common-condition-keys}

Producers and consumers _MAY_ support a shared vocabulary of
`$when` keys to express contextual overrides. Common examples include:

`prefers-color-scheme`
: User colour scheme preferences such as `light` or `dark`.

`prefers-reduced-motion`
: User preference indicating reduced or standard motion effects.

`prefers-contrast`
: User preference for contrast levels like `more`, `less`, or
`no-preference`.

`platform`
: Target runtime or operating system such as `android`, `ios`, or
`web`.

`locale`
: Language or regional settings influencing typography or content direction.

`reduced-data`
: Network data-saver state signalling whether high-bandwidth resources should be avoided.

::: info
Metadata-driven context keys are described in [Metadata](./metadata.md#metadata).
:::
