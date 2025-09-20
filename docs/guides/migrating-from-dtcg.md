---
title: Migrating from the DTCG format
description: Practical guidance for porting Design Tokens Community Group documents to the Design Token Interchange Format.
outline: [2, 3]
---

# Migrating from the DTCG format {#migrating-from-dtcg}

This guide explains how to convert Design Tokens Community Group (DTCG) Format Module
files into the Design Token Interchange Format (DTIF). Follow the sections below to
translate the document structure, references, metadata, and token value payloads while
embracing the richer semantics provided by DTIF. Every DTIF example shown here is a
complete JSON document that can be validated with the schema in this repository (see the
files under `examples/dtcg-migration/`).

## Compare the data models {#compare-models}

DTCG and DTIF agree on storing tokens inside JSON documents but they diverge on several
core behaviours:

- **Collections instead of groups.** DTIF treats any object without a `$value` as a [collection](../spec/architecture-model.md#tokens-and-collections). DTCG groups may [declare a `$type` that applies to every nested token](https://www.designtokens.org/tr/drafts/format/#type-1), so copy inherited types onto each DTIF token because collections do not provide default typing. Collections may consist solely of metadata, so you can migrate group descriptions or governance fields without creating placeholder tokens. DTIF collections must omit `$type`, `$ref`, and `$value` entirely—those members belong to tokens—so strip inherited types or aliases from the container before validating.
- **Reserved member prefixes.** Both formats reserve `$`-prefixed keys. DTCG documents, groups, and tokens use `$description`, `$type`, and `$extensions` members and [forbid `{`, `}`, and `.` in names](https://www.designtokens.org/tr/drafts/format/#character-restrictions). DTIF keeps the prefix rules and adds document-level members such as [`$version`](../spec/architecture-model.md#versioning) and [`$overrides`](../spec/theming-overrides.md#theming-and-overrides), so migrate any group metadata into the corresponding collections and resolve naming conflicts before publishing. DTIF's schema now rejects unknown reserved members—any `$foo` fields that existed purely for tooling hints must move under `$extensions` with a vendor namespace so that validation succeeds.
- **Alias mechanics.** DTCG aliases rely on brace-delimited strings such as `"{button.background}"` described in the [alias section](https://www.designtokens.org/tr/drafts/format/#aliases-references). DTIF aliases use [`$ref` JSON Pointers](../spec/format-serialisation.md#ref) that start with `#` for local targets or include a URI fragment for external references. Convert each DTCG alias into a `$ref` and escape `/` or `~` characters as `~1` or `~0` per the pointer rules. DTIF additionally rejects directory traversal segments such as `../` or their percent-encoded form `%2E%2E`, so rewrite any exported DTCG file paths that rely on upward navigation before publishing. Partially encoded sequences like `%2E./`, `.%2E/`, or `..%2F` are also rejected, so normalise build scripts that previously masked traversal with mixed escaping.
- **CSS identifier escaping.** Fields such as `color.$value.colorSpace`, `gradient.$value.stops[].color`, and function names inside `$value.fn` follow the CSS `<ident>` and `<dashed-ident>` grammar. DTIF accepts the full Unicode range and CSS escape sequences, so identifiers beginning with digits or containing punctuation should be emitted using standard CSS escapes (for example `"\31 6px"`). Keeping identifiers within that grammar avoids migration surprises when tools round-trip colour spaces or platform identifiers.
- **Type identifiers.** DTCG `$type` strings often use short labels such as `"sizing"` or `"radius"`. DTIF [reserves a registry of built-in categories](../spec/format-serialisation.md#type) but also accepts vendor-defined identifiers composed of ASCII words separated by dots. Map DTCG categories to the closest DTIF primitive (for example `"sizing"` → `"dimension"`, `"color"` stays `"color"`). When you need bespoke semantics, mint a stable identifier—reverse-DNS prefixes like `com.example.tokens.radius` avoid collisions even though the schema only enforces the character set. Tokens that provide either `$value` or `$ref` should declare `$type` so automation can reason about the payload without resolving references; migrating tools ought to copy the original group type onto every token even when legacy exports omitted it.

DTCG export with vendor metadata in `$extensions`:

```json
{
  "palette": {
    "brand": {
      "primary": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.0, 0.435, 1.0],
          "hex": "#006FFF"
        }
      }
    }
  },
  "button": {
    "$type": "color",
    "$value": "{palette.brand.primary}",
    "$extensions": {
      "com.example.workflow": {
        "category": "actions"
      }
    }
  }
}
```

DTIF conversion that preserves the hint under `$extensions`:

```json
{
  "button": {
    "$type": "color",
    "$ref": "#/palette/brand/primary",
    "$extensions": {
      "org.example.workflow": {
        "category": "actions"
      }
    }
  }
}
```

Both formats reserve the `$` prefix, so rewrite any legacy DTCG exports that still
emit members such as `$category` to use `$extensions` before converting them to DTIF.

### Example: groups, tokens, and aliases {#example-data-model}

#### DTCG structure

```json
{
  "$description": "Marketing tokens exported from a DTCG tool.",
  "button": {
    "$type": "color",
    "$description": "Primary button colors",
    "background": {
      "$description": "Solid brand fill",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.435, 1.0],
        "hex": "#006FFF"
      },
      "$extensions": {
        "com.example.export": { "legacyHex": "#006FFF" }
      }
    },
    "text": {
      "$description": "Alias to the background color",
      "$value": "{button.background}"
    }
  }
}
```

#### DTIF structure (`examples/dtcg-migration/data-model.tokens.json`)

```json
{
  "$version": "1.0.0",
  "button": {
    "$description": "Primary button colors",
    "background": {
      "$type": "color",
      "$description": "Solid brand fill",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.435, 1.0]
      },
      "$extensions": {
        "org.example.export": { "legacyHex": "#006FFF" }
      }
    },
    "text": {
      "$type": "color",
      "$description": "Alias to the background color",
      "$ref": "#/button/background"
    }
  }
}
```

Copy the inherited `$type` onto every DTIF token, convert string aliases into `$ref`
pointers, and migrate any vendor extensions while keeping their reverse-DNS names.

### Model fallback chains {#value-fallbacks}

DTIF tokens may provide multiple candidates for a single design decision by
placing an array in `$value`. Each entry in the array must be either an inline
literal, a `$ref` alias object, or a function expression. Consumers evaluate the
entries in order and stop when a candidate resolves, so you can mix references
to other tokens with serialised fallbacks. Arrays must contain at least one
item.

This non-empty rule applies even when the source token omitted `$type`. Replace
placeholder arrays with real candidates or remove them entirely so the DTIF
schema does not reject empty fallback slots during validation.

```json
{
  "color": {
    "surface": {
      "$type": "color",
      "$value": [
        { "$ref": "#/color/brand" },
        {
          "colorSpace": "srgb",
          "components": [1, 1, 1, 1]
        }
      ]
    }
  }
}
```

This pattern keeps legacy fallbacks close to their primary token while letting
platform-specific implementations pick the first compatible entry. When you
need a simple alias that still participates in fallback evaluation, assign a
`$ref` object directly to `$value` instead of declaring a separate `$ref`
member.

Multi-layer tokens such as [`shadow`](../spec/token-types.md#shadow-tokens)
interpret arrays without `$ref` or `fn` entries as literal layer stacks. If you
intend to supply fallbacks for those tokens, include at least one alias or
function entry so the schema treats the array as an ordered fallback chain
rather than a single composite value.

### Translate computed values {#computed-values}

The DTCG Format Module only serialises literal measurements for primitives such
as `dimension`. When workflows need to preserve the formula behind a computed
value, they often store the original expression inside vendor `$extensions`
metadata. Migration scripts can promote those strings into DTIF function objects
that declare an `fn` keyword and optional `parameters` array as defined in
[Token types](../spec/token-types.md#value). Each argument or parameter may be a
literal, another function object, or a `$ref` alias that resolves to a token
declaring the same `$type`.

DTCG export recording a calc expression inside vendor metadata:

```json
{
  "spacing": {
    "side": {
      "$type": "dimension",
      "$value": { "value": 16, "unit": "px" },
      "$extensions": {
        "com.example.export": {
          "sourceExpression": "calc(100% - 1rem)"
        }
      }
    }
  }
}
```

DTIF conversion using an explicit function object:

```json
{
  "spacing": {
    "side": {
      "$type": "dimension",
      "$value": { "fn": "calc", "parameters": ["100%", "-", "1rem"] }
    }
  }
}
```

When the referenced grammar takes no arguments—such as vendor-specific
functions that behave like keywords—omit `parameters` entirely. The DTIF schema
treats a missing member the same as an empty array, so migrating scripts can
drop placeholder `[]` values instead of emitting redundant lists.

### Normalise platform identifiers {#normalise-platform-identifiers}

Some DTCG workflows annotate platform targets inside `$extensions` metadata or rely on
implicit naming conventions for `number` tokens. DTIF requires lower-case dot-separated
segments for the dedicated identifier members—such as
[`cursorType`](../spec/token-types.md#cursor),
[`borderType`](../spec/token-types.md#border-tokens),
[`font.$value.fontType`](../spec/typography.md#font-face),
[`filterType`](../spec/token-types.md#filter-tokens),
[`opacityType`](../spec/token-types.md#opacity),
[`durationType`](../spec/token-types.md#duration),
[`zIndexType`](../spec/token-types.md#z-index),
[`motionType`](../spec/token-types.md#motion-tokens), and
[`easingFunction`](../spec/token-types.md#easing)—so downstream tooling can infer the
target platform. Normalise each segment to lower-case ASCII, replace camel case with
hyphenated words where needed, and join the segments with dots when you move these
annotations into DTIF fields.

DTCG export:

```json
{
  "opacity": {
    "$type": "number",
    "$extensions": {
      "com.example.export": { "platform": "CSS.Opacity" }
    },
    "$value": 0.4
  }
}
```

DTIF conversion:

```json
{
  "opacity": {
    "$type": "opacity",
    "$value": { "opacityType": "css.opacity", "value": 0.4 }
  }
}
```

## Prepare the document shell {#document-shell}

1. **Declare a version.** DTCG files do not mandate document versioning. DTIF documents [SHOULD include a `$version`](../spec/architecture-model.md#versioning) that follows Semantic Versioning so consumers can evaluate compatibility.
2. **Copy document metadata.** DTCG groups may expose [`$description`](https://www.designtokens.org/tr/drafts/format/#description-0), [`$extensions`](https://www.designtokens.org/tr/drafts/format/#extensions-0), and `$deprecated`. Mirror those members on the new collections, carrying group-level `$deprecated` flags across as collection metadata and migrating any string explanations into `$description` or vendor extensions. When you need file-level governance details, place them inside the document's top-level `$extensions`; lifecycle fields such as `$lastModified` and `$author` remain token-scoped in DTIF.
3. **Decide on layering.** If the DTCG workflow produced separate files per theme or mode, DTIF lets you combine them by layering documents or by defining a [`$overrides` array](../spec/theming-overrides.md#theming-and-overrides) with explicit conditionals. Each override entry must supply at least one `$when` key; migrate any empty condition objects into concrete predicates so the schema can evaluate the override.
4. **Normalise names.** DTCG [forbids `{`, `}`, and `.` in token or group names](https://www.designtokens.org/tr/drafts/format/#character-restrictions) because of its alias syntax. DTIF references do not impose those limits, but JSON Pointer segments treat `/` and `~` as structural characters, so escape them as `~1` and `~0` when building `$ref` strings.

### Example: merging themed documents {#example-document-shell}

#### DTCG theme files (two documents)

```json
{
  "$description": "marketing.light",
  "$extensions": {
    "com.example.workflow": { "owner": "Design Systems" }
  },
  "color": {
    "brand": {
      "background": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.0, 0.435, 1.0],
          "hex": "#006FFF"
        }
      }
    }
  },
  "button": {
    "$type": "color",
    "background": { "$value": "{color.brand.background}" }
  }
}
```

```json
{
  "$description": "marketing.dark",
  "color": {
    "brand": {
      "background": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.0, 0.133, 0.333],
          "hex": "#002255"
        }
      }
    }
  },
  "button": {
    "$type": "color",
    "background": { "$value": "{color.brand.background}" }
  }
}
```

#### DTIF merged document (`examples/dtcg-migration/document-shell.tokens.json`)

```json
{
  "$version": "1.0.0",
  "$description": "Marketing theme converted from split DTCG files.",
  "$extensions": {
    "org.example.workflow": { "owner": "Design Systems" }
  },
  "$overrides": [
    {
      "$token": "#/button/background",
      "$when": { "prefers-color-scheme": "dark" },
      "$ref": "#/color/brand/dark"
    }
  ],
  "color": {
    "brand": {
      "light": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.0, 0.435, 1.0, 1.0]
        }
      },
      "dark": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.0, 0.133, 0.333, 1.0]
        }
      }
    }
  },
  "button": {
    "background": {
      "$type": "color",
      "$description": "Defaults to the light brand color",
      "$ref": "#/color/brand/light"
    }
  }
}
```

Combine split DTCG files into a single DTIF document, declare `$version`, and use
`$overrides` to handle conditional themes instead of duplicating documents.

## Migrate metadata {#metadata}

DTIF reuses familiar fields and introduces additional lifecycle tracking:

- **`$description`** remains a plain-text explanation that consumers _MAY_ display ([Format and serialisation](../spec/format-serialisation.md#description)).
- **`$extensions`** still hosts vendor data but DTIF requires reverse-DNS prefixes and preservation of unknown entries ([Format and serialisation](../spec/format-serialisation.md#extensions)).
- **`$deprecated`** accepts either a boolean or an object with a `$replacement` pointer to another token of the same `$type`. Convert DTCG boolean or string deprecation flags on tokens and groups into boolean metadata, move freeform explanations into `$description` or vendor namespaces, and add `$replacement` pointers for canonical successors. Collections _MAY_ carry the same metadata so inherited group defaults survive the migration ([Metadata](../spec/metadata.md#metadata)).
- **Lifecycle fields.** DTIF optionally records `$lastModified`, `$lastUsed`, `$usageCount`, `$author`, `$tags`, and `$hash`. Populate these from any analytics captured alongside the source tokens, keep `$lastUsed` paired with a positive `$usageCount`, and ensure `$lastUsed` is on or after `$lastModified`. When `$usageCount` is `0`, omit `$lastUsed`; the schema enforces these combinations and temporal ordering so telemetry imported from DTCG stays consistent ([Metadata](../spec/metadata.md#metadata)).

### Example: migrating status metadata {#example-metadata}

#### DTCG metadata

```json
{
  "status": {
    "$type": "color",
    "$description": "Status indicator colors",
    "$extensions": {
      "com.example.workflow": { "owner": "Design Systems" }
    },
    "warning": {
      "$description": "Legacy warning alias",
      "$deprecated": "Use caution instead",
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 0.839, 0.0],
        "hex": "#FFD600"
      }
    },
    "caution": {
      "$description": "Preferred caution token",
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 0.733, 0.0],
        "hex": "#FFBB00"
      }
    }
  }
}
```

#### DTIF metadata (`examples/dtcg-migration/metadata.tokens.json`)

```json
{
  "$version": "1.0.0",
  "status": {
    "$description": "Status indicator colors",
    "$extensions": {
      "org.example.workflow": { "owner": "Design Systems" }
    },
    "warning": {
      "$type": "color",
      "$description": "Legacy warning alias",
      "$deprecated": { "$replacement": "#/status/caution" },
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 0.839, 0.0]
      }
    },
    "caution": {
      "$type": "color",
      "$description": "Preferred caution token",
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 0.733, 0.0]
      }
    }
  }
}
```

Strings inside `$deprecated` become structured objects with `$replacement` pointers, and
vendor metadata keeps its reverse-DNS prefix.

## Convert primitive tokens {#primitive-tokens}

The table below summarises how the DTCG primitive types map to DTIF.

| DTCG type(s)               | DTIF target                                     | Migration notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :------------------------- | :---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`                    | `color`                                         | Move the optional DTCG `alpha` channel into the `components` array (as the fourth entry). DTIF accepts optional `hex` (and matching `alpha`) members for sRGB colours when you need to preserve CSS serialisations. DTIF colour spaces follow CSS Color Module Level 4 and expect channel counts that match the declared space. See the [DTCG color type](https://www.designtokens.org/tr/drafts/format/#color) and the [DTIF colour guidance](../spec/token-types.md#color).                                                       |
| `dimension`                | `dimension`                                     | Supply a `dimensionType` (for example `length`) and reuse the existing `value` and `unit`. DTCG only allows `px` or `rem`, whereas DTIF covers the CSS Values and Units grammar plus platform-specific units. Reference the [DTCG dimension type](https://www.designtokens.org/tr/drafts/format/#dimension) and the [DTIF dimension rules](../spec/token-types.md#dimension).                                                                                                                                                       |
| `duration`                 | `duration`                                      | Wrap the numeric payload with `durationType` (such as `css.transition-duration`) and keep `value`/`unit`. DTCG units are `ms` or `s`; DTIF adds CSS `<time>` keywords and platform identifiers like frame counts. See [DTCG duration](https://www.designtokens.org/tr/drafts/format/#duration) and [DTIF duration tokens](../spec/token-types.md#duration).                                                                                                                                                                         |
| `cubicBezier`              | `easing`                                        | Replace the bare four-number array with `{ "easingFunction": "cubic-bezier", "parameters": [...] }`. DTIF also supports `steps()` and native spring identifiers when migrating bespoke timing curves. Compare [DTCG cubic Bézier](https://www.designtokens.org/tr/drafts/format/#cubic-bezier) with [DTIF easing tokens](../spec/token-types.md#easing).                                                                                                                                                                            |
| `fontFamily`, `fontWeight` | `font` or `typography`                          | Consolidate DTCG font metadata—[`fontFamily`](https://www.designtokens.org/tr/drafts/format/#font-family) and [`fontWeight`](https://www.designtokens.org/tr/drafts/format/#font-weight)—into richer DTIF `font` tokens for assets and `typography` tokens for composed styles. Normalise string weights such as `"regular"` or `"bold"` to their numeric equivalents before assigning them to `font` or `typography` payloads (see [font tokens](../spec/token-types.md#font) and [typography](../spec/typography.md#typography)). |
| `number`                   | Contextual (`opacity`, `z-index`, `typography`) | DTCG `number` tokens cover gradient stops, line-height ratios, and other scalars. Map each value to a DTIF type that exposes the same semantics: opacity multipliers become [`opacity`](../spec/token-types.md#opacity), stacking contexts become [`z-index`](../spec/token-types.md#z-index), and typographic ratios move inside the [typography value](../spec/typography.md#typography) instead of remaining free-floating numbers (see the [DTCG number type](https://www.designtokens.org/tr/drafts/format/#number)).          |

### Colour tokens {#colour}

#### DTCG color token

```json
{
  "overlay": {
    "$type": "color",
    "$value": {
      "colorSpace": "srgb",
      "components": [0, 0, 0],
      "alpha": 0.5,
      "hex": "#000000"
    }
  }
}
```

#### DTIF color token (`examples/dtcg-migration/color.tokens.json`)

```json
{
  "$version": "1.0.0",
  "color": {
    "overlay": {
      "$type": "color",
      "$description": "Translucent overlay with legacy hex fallback",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.0, 0.0, 0.5],
        "hex": "#00000080"
      }
    }
  }
}
```

Move the `alpha` channel into the DTIF `components` array and reuse the native `hex`
field—plus the optional `alpha` number when the fallback omits embedded transparency—
to preserve CSS-oriented serialisations without `$extensions`.

### Dimension tokens {#dimension}

#### DTCG dimensions

```json
{
  "spacing-medium": {
    "$type": "dimension",
    "$value": { "value": 16, "unit": "px" }
  },
  "radius-pill": {
    "$type": "dimension",
    "$value": { "value": 1.5, "unit": "rem" }
  }
}
```

#### DTIF dimensions (`examples/dtcg-migration/dimension.tokens.json`)

```json
{
  "$version": "1.0.0",
  "dimension": {
    "spacing-medium": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 16,
        "unit": "px"
      }
    },
    "radius-pill": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 1.5,
        "unit": "rem"
      }
    }
  }
}
```

Add `dimensionType` to distinguish angles, resolutions, and platform-specific units while
keeping the numeric payloads intact.

### Temporal tokens {#temporal}

#### DTCG temporal tokens

```json
{
  "duration": {
    "button-press": {
      "$type": "duration",
      "$value": { "value": 120, "unit": "ms" }
    },
    "button-delay": {
      "$type": "duration",
      "$value": { "value": 40, "unit": "ms" }
    }
  },
  "easing": {
    "standard": {
      "$type": "cubicBezier",
      "$value": [0.4, 0.0, 0.2, 1.0]
    }
  }
}
```

#### DTIF temporal tokens (`examples/dtcg-migration/duration-easing.tokens.json`)

```json
{
  "$version": "1.0.0",
  "duration": {
    "button-press": {
      "$type": "duration",
      "$value": {
        "durationType": "css.transition-duration",
        "value": 120,
        "unit": "ms"
      }
    },
    "button-delay": {
      "$type": "duration",
      "$value": {
        "durationType": "css.transition-delay",
        "value": 40,
        "unit": "ms"
      }
    }
  },
  "easing": {
    "standard": {
      "$type": "easing",
      "$value": {
        "easingFunction": "cubic-bezier",
        "parameters": [0.4, 0.0, 0.2, 1.0]
      }
    }
  }
}
```

Wrap each duration with a `durationType` identifier and promote Bézier arrays to reusable
`easing` tokens.

#### Validate easing grammars

DTIF validates each easing function against the grammar defined in
[`Token types`](../spec/token-types.md#easing):

- `cubic-bezier` values **must** provide exactly four numbers. The first and third
  control points are clamped to the `[0, 1]` domain so CSS, UIKit, and Android renderers
  stay in sync.
- `steps` easings require a positive integer step count and, when the optional second
  argument is present, it **must** be one of the CSS `<step-position>` keywords such as
  `"start"`, `"jump-end"`, or `"jump-both"`.
- Spring identifiers like `spring`, `ios.spring`, or `android.spring-force` demand four
  numeric parameters: the first three are positive magnitudes published by
  `UISpringTimingParameters` and `SpringForce`, and the final value is the initial
  velocity, which may be any real number.

```json
{
  "easing": {
    "stagger": {
      "$type": "easing",
      "$value": { "easingFunction": "steps", "parameters": [4, "jump-end"] }
    },
    "spring": {
      "$type": "easing",
      "$value": { "easingFunction": "ios.spring", "parameters": [0.9, 12, 1.2, -0.4] }
    }
  }
}
```

Adjust any DTCG exports that rely on looser validation so they satisfy these grammars
before importing them into DTIF.

### Fonts and typography {#fonts}

#### DTCG typography

```json
{
  "fontFamily": {
    "body": { "$type": "fontFamily", "$value": ["Inter", "Arial", "sans-serif"] }
  },
  "fontWeight": {
    "regular": { "$type": "fontWeight", "$value": 400 }
  },
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "{fontFamily.body}",
        "fontWeight": "{fontWeight.regular}",
        "fontSize": { "value": 16, "unit": "px" },
        "letterSpacing": { "value": 0.5, "unit": "px" },
        "lineHeight": 1.5
      }
    }
  }
}
```

#### DTIF typography (`examples/dtcg-migration/typography.tokens.json`)

```json
{
  "$version": "1.0.0",
  "font": {
    "inter-regular": {
      "$type": "font",
      "$value": {
        "fontType": "css.font-face",
        "family": "Inter",
        "fallbacks": ["Arial", "sans-serif"],
        "style": "normal",
        "weight": 400
      }
    }
  },
  "dimension": {
    "shared": {
      "body-size": {
        "$type": "dimension",
        "$value": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        }
      },
      "body-letter-spacing": {
        "$type": "dimension",
        "$value": {
          "dimensionType": "length",
          "value": 0.5,
          "unit": "px"
        }
      },
      "body-line-height": {
        "$type": "dimension",
        "$value": {
          "dimensionType": "length",
          "value": 24,
          "unit": "px"
        }
      }
    },
    "typography": {
      "body-size": {
        "$type": "dimension",
        "$ref": "#/dimension/shared/body-size"
      },
      "body-letter-spacing": {
        "$type": "dimension",
        "$ref": "#/dimension/shared/body-letter-spacing"
      },
      "body-line-height": {
        "$type": "dimension",
        "$ref": "#/dimension/shared/body-line-height"
      }
    }
  },
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontWeight": 400,
        "fontSize": { "$ref": "#/dimension/typography/body-size" },
        "letterSpacing": { "$ref": "#/dimension/typography/body-letter-spacing" },
        "lineHeight": { "$ref": "#/dimension/typography/body-line-height" }
      }
    }
  }
}
```

Consolidate font metadata into a reusable `font` token, encode fallback stacks with the
`fallbacks` property, and promote repeated measurements to standalone `dimension` tokens.
Reference those measurements from `typography` tokens via `$ref`. Alias tokens can
forward to other dimension tokens, so nested pointers keep shared measurements in one
place while the typography composite stays well-typed.

DTIF also registers standalone `line-height` tokens for reusing baseline spacing
outside composite typography. DTCG exports that serialise line heights as strings such
as `"120%"` must be normalised into a unitless ratio (for example `1.2`) or a
`font-dimension` object during migration. The schema rejects other value types so that
line-height tokens resolve predictably on every platform and alias tokens continue to
declare matching `$type` metadata.

DTIF likewise narrows the accepted keywords for `wordSpacing`.
CSS allows values such as `normal`, `wide`, and `narrow`, and some DTCG pipelines
emit those strings directly. DTIF keeps only the `normal` keyword; all other spacing
adjustments must be converted into explicit `font-dimension` measurements or
references to `dimension` tokens whose `dimensionType` is `"length"`. This ensures
word spacing imports express concrete distances instead of relying on loosely defined
user-agent heuristics.

DTIF additionally validates every font family string using the CSS `<family-name>`
grammar described in [Token types §font](../spec/token-types.md#font) and
[Typography §font-face](../spec/typography.md#font-face). Trim leading and trailing
whitespace, quote identifiers that start with digits, and clean any DTCG
`$extensions` payloads that embed font metadata so the values you copy into DTIF
`font`, `fontFace`, or `typography` tokens already match the CSS naming rules.

#### Text decoration and transform strings {#text-decoration-transform}

The schema now validates the `textDecoration` and `textTransform` strings that
DTIF stores on `typography` values against the CSS grammar. DTCG tokens do not
define those members, so many pipelines stash decoration metadata in vendor
`$extensions` as free-form descriptions such as `"underline dashed red"` or
`"capitalize smallcaps"`. Normalise that metadata before copying it into DTIF so
tooling can translate the results directly into CSS, UIKit, and Android APIs
without guessing the author’s intent.

- **Decoration components.** Supply recognised line keywords (`none`,
  `underline`, `overline`, `line-through`, `spelling-error`, `grammar-error`),
  optional `<line-style>` keywords (`solid`, `dotted`, `dashed`, `double`,
  `wavy`), colour values (CSS named colours, system colours, `#rrggbb`,
  `color(...)`, or `var(...)`), and thickness tokens (`thin`, `medium`, `thick`,
  `from-font`, `auto`, or `<length-percentage>`). Remove informal descriptors
  such as `"bevelled"` and normalise vendor strings to the CSS keyword set.
- **Transform lists.** Provide whitespace-separated keywords such as `none`,
  `capitalize`, `uppercase`, `lowercase`, `full-width`, `full-size-kana`, or
  `math-auto`. When a custom property drives the value, wrap it in `var(...)`
  (`"var(--brand-transform)"`) instead of serialising plain text.

DTCG export with loose decoration metadata stored in `$extensions`:

```json
{
  "fontFamily": {
    "accent": {
      "$type": "fontFamily",
      "$value": ["Inter", "Arial", "sans-serif"]
    }
  },
  "typography": {
    "cta": {
      "$type": "typography",
      "$value": {
        "fontFamily": "{fontFamily.accent}",
        "fontWeight": 600,
        "fontSize": { "value": 16, "unit": "px" },
        "letterSpacing": { "value": 0, "unit": "px" },
        "lineHeight": 1.2
      },
      "$extensions": {
        "com.example.export": {
          "textDecoration": "underline bevelled 2",
          "textTransform": "capitalize smallcaps"
        }
      }
    }
  }
}
```

DTIF conversion honouring the CSS grammar:

```json
{
  "typography": {
    "cta": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontWeight": 600,
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" },
        "letterSpacing": { "dimensionType": "length", "value": 0, "unit": "px" },
        "lineHeight": 1.2,
        "textDecoration": "underline color-mix(in srgb, #ff6600 40%, white) from-font",
        "textTransform": "capitalize full-size-kana"
      }
    }
  }
}
```

Normalise DTCG strings before validation by lower-casing the CSS keywords, ensuring
named colours map to the CSS colour registry, and providing explicit units for
thickness measurements (`"2px"` instead of `"2"`). DTIF accepts system colour
keywords (`AccentColor`, `CanvasText`) and `var()` references so existing theme
hooks continue to work once their syntax matches the CSS specifications referenced
above.

DTCG export with loose font family strings in `$extensions`:

```json
{
  "fontFamily": {
    "accent": {
      "$type": "fontFamily",
      "$value": [" 1 Example", "Arial ", "sans-serif"],
      "$extensions": {
        "com.example.export": {
          "fontFace": {
            "fontFamily": " 1 Example ",
            "src": [
              { "local": " 1 Example " },
              { "url": "fonts/Accent Regular.woff2", "format": "woff2" }
            ]
          }
        }
      }
    }
  }
}
```

DTIF conversion quoting the name and encoding the URL:

```json
{
  "font": {
    "accent": {
      "$type": "font",
      "$value": {
        "family": "\"1 Example\"",
        "fallbacks": ["Arial", "sans-serif"]
      }
    }
  },
  "fontFace": {
    "accent": {
      "$type": "fontFace",
      "$value": {
        "fontFamily": "\"1 Example\"",
        "src": [
          { "local": "\"1 Example\"" },
          { "url": "fonts/Accent%20Regular.woff2", "format": "woff2" }
        ]
      }
    }
  }
}
```

In addition to quoting the family, percent-encode any whitespace inside
`fontFace.$value.src[].url` strings so they remain valid
[`uri-reference`](https://datatracker.ietf.org/doc/html/rfc3986#section-4.1) values.
DTIF rejects URLs containing raw spaces or other illegal characters, so update the
export pipeline to emit encoded paths before validating the converted document.

## Convert composite tokens {#composite-tokens}

DTCG defines several composite types that combine multiple primitives. DTIF provides
richer schemas for these structures.

### Borders and stroke styles {#borders}

#### DTCG border

```json
{
  "color": {
    "focus": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.435, 1.0],
        "hex": "#006FFF"
      }
    }
  },
  "dimension": {
    "focus-outline-width": {
      "$type": "dimension",
      "$value": { "value": 2, "unit": "px" }
    }
  },
  "strokeStyle": {
    "focus": {
      "$type": "strokeStyle",
      "$value": {
        "dashArray": [
          { "value": 4, "unit": "px" },
          { "value": 2, "unit": "px" }
        ],
        "lineCap": "round"
      }
    }
  },
  "border": {
    "focus-outline": {
      "$type": "border",
      "$value": {
        "color": "{color.focus}",
        "style": "solid",
        "width": "{dimension.focus-outline-width}"
      }
    }
  }
}
```

#### DTIF border (`examples/dtcg-migration/border.tokens.json`)

```json
{
  "$version": "1.0.0",
  "color": {
    "focus-outline": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.435, 1.0, 1.0]
      }
    }
  },
  "dimension": {
    "focus-outline-width": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 2,
        "unit": "px"
      }
    }
  },
  "strokeStyle": {
    "focus": {
      "$type": "strokeStyle",
      "$value": {
        "dashArray": [
          {
            "dimensionType": "length",
            "value": 4,
            "unit": "px"
          },
          {
            "dimensionType": "length",
            "value": 2,
            "unit": "px"
          }
        ],
        "lineCap": "round"
      }
    }
  },
  "border": {
    "focus-outline": {
      "$type": "border",
      "$value": {
        "borderType": "css.border",
        "color": { "$ref": "#/color/focus-outline" },
        "style": "solid",
        "strokeStyle": { "$ref": "#/strokeStyle/focus" },
        "width": { "$ref": "#/dimension/focus-outline-width" }
      }
    }
  }
}
```

The shared `color` and `dimension` entries become standalone DTIF tokens that
the border references through `$ref` pointers, preserving the original DTCG
aliases while exposing richer metadata.

DTIF `border` tokens capture the rendering context through `borderType`, reuse
stroke metadata via a first-class `strokeStyle` token, and avoid vendor
extensions for dash patterns.

When migrating custom border styles, rewrite proprietary keywords to the CSS
[`<line-style>`](../spec/token-types.md#border-tokens) values (`none`,
`hidden`, `dotted`, `dashed`, `solid`, `double`, `groove`, `ridge`, `inset`, or
`outset`). DTIF rejects unrecognised styles so normalising them up front keeps
validation noise-free.

### Shadows {#shadows}

#### DTCG shadow

```json
{
  "color": {
    "shadow": {
      "ambient": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.0, 0.0, 0.0],
          "alpha": 0.2,
          "hex": "#000000"
        }
      },
      "key": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.0, 0.0, 0.0],
          "alpha": 0.302,
          "hex": "#000000"
        }
      }
    }
  },
  "dimension": {
    "shadow": {
      "offset-large": {
        "$type": "dimension",
        "$value": { "value": 2, "unit": "px" }
      },
      "offset-small": {
        "$type": "dimension",
        "$value": { "value": 1, "unit": "px" }
      },
      "blur-large": {
        "$type": "dimension",
        "$value": { "value": 6, "unit": "px" }
      },
      "blur-small": {
        "$type": "dimension",
        "$value": { "value": 3, "unit": "px" }
      },
      "spread": {
        "$type": "dimension",
        "$value": { "value": 0, "unit": "px" }
      }
    }
  },
  "shadow": {
    "button-ambient": {
      "$type": "shadow",
      "$value": [
        {
          "color": "{color.shadow.ambient}",
          "offsetX": "{dimension.shadow.spread}",
          "offsetY": "{dimension.shadow.offset-large}",
          "blur": "{dimension.shadow.blur-large}",
          "spread": "{dimension.shadow.spread}"
        },
        {
          "color": "{color.shadow.key}",
          "offsetX": "{dimension.shadow.spread}",
          "offsetY": "{dimension.shadow.offset-small}",
          "blur": "{dimension.shadow.blur-small}",
          "spread": "{dimension.shadow.spread}"
        }
      ]
    }
  }
}
```

#### DTIF shadow (`examples/dtcg-migration/shadow.tokens.json`)

```json
{
  "$version": "1.0.0",
  "color": {
    "shadow-ambient": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.0, 0.0, 0.2]
      }
    },
    "shadow-key": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.0, 0.0, 0.3]
      }
    }
  },
  "dimension": {
    "shadow-offset-large": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 2,
        "unit": "px"
      }
    },
    "shadow-offset-small": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 1,
        "unit": "px"
      }
    },
    "shadow-blur-large": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 6,
        "unit": "px"
      }
    },
    "shadow-blur-small": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 3,
        "unit": "px"
      }
    },
    "shadow-spread": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 0,
        "unit": "px"
      }
    }
  },
  "shadow": {
    "button-ambient": {
      "$type": "shadow",
      "$value": [
        {
          "shadowType": "css.box-shadow",
          "offsetX": { "$ref": "#/dimension/shadow-spread" },
          "offsetY": { "$ref": "#/dimension/shadow-offset-large" },
          "blur": { "$ref": "#/dimension/shadow-blur-large" },
          "spread": { "$ref": "#/dimension/shadow-spread" },
          "color": { "$ref": "#/color/shadow-ambient" }
        },
        {
          "shadowType": "css.box-shadow",
          "offsetX": { "$ref": "#/dimension/shadow-spread" },
          "offsetY": { "$ref": "#/dimension/shadow-offset-small" },
          "blur": { "$ref": "#/dimension/shadow-blur-small" },
          "spread": { "$ref": "#/dimension/shadow-spread" },
          "color": { "$ref": "#/color/shadow-key" }
        }
      ]
    }
  }
}
```

Ensure every `blur` entry remains zero or positive. CSS `<shadow>` grammar and
DTIF's schema both disallow negative blur radii, so adjust any exports that used
sentinel values before validating the converted document.

Shared colour and dimension primitives become first-class DTIF tokens that
each shadow layer references via `$ref`, preserving the alias relationships
used in the source DTCG document.

Convert each DTCG layer into a DTIF shadow object with an explicit `shadowType` and
dimension wrappers. Tokens with multiple layers continue to use arrays whose ordering
matches the original DTCG payload.

### Gradients {#gradients}

#### DTCG gradient

```json
{
  "color": {
    "hero": {
      "start": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [1.0, 0.541, 0.0],
          "hex": "#FF8A00"
        }
      },
      "end": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.929, 0.098, 0.792],
          "hex": "#ED19CA"
        }
      }
    }
  },
  "gradient": {
    "hero-background": {
      "$type": "gradient",
      "$value": [
        { "color": "{color.hero.start}", "position": 0 },
        { "color": "{color.hero.end}", "position": 1 }
      ]
    }
  }
}
```

#### DTIF gradient (`examples/dtcg-migration/gradient.tokens.json`)

```json
{
  "$version": "1.0.0",
  "color": {
    "hero-start": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 0.541, 0.0, 1.0]
      }
    },
    "hero-end": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.929, 0.098, 0.792, 1.0]
      }
    }
  },
  "gradient": {
    "hero-background": {
      "$type": "gradient",
      "$value": {
        "gradientType": "linear",
        "angle": "to top right",
        "stops": [
          { "position": "0%", "color": { "$ref": "#/color/hero-start" } },
          { "position": "100%", "color": { "$ref": "#/color/hero-end" } }
        ]
      }
    }
  }
}
```

Convert fractional stop positions to percentage strings, add an explicit `gradientType`
(`linear`, `radial`, or `conic`) and CSS-formatted `angle` to describe the orientation,
and keep the palette tokens as
dedicated `color` entries that gradient stops reference through `$ref` so palette aliases
survive the migration.

- **Angles must include CSS units or keywords.** DTCG exports frequently write bare
  numbers such as `45` or `180` for gradient orientations. DTIF rejects those values;
  convert them to valid [CSS `<angle>`](../spec/token-types.md#gradient-tokens)
  strings such as `45deg`, `0.5turn`, or use the `to top right` keyword syntax.
- **Centre strings follow CSS `<position>`.** When DTCG serialises centre points as
  fractional pairs like `0.5 0.25`, translate them into CSS `<length-percentage>`
  values (`50% 25%`) or wrap calculations in `calc(...)` so that DTIF accepts the
  string. Identifiers such as `middle` are not part of the grammar and will fail
  validation.
- **Hints stay single `<length-percentage>` tokens.** DTCG gradients sometimes
  embed hint offsets as two-element arrays or space-separated pairs. DTIF follows
  the CSS `<color-hint>` production, so flatten those values into a single token
  (for example `"var(--midpoint)"` or `"calc(25% + 2px)"`). Supplying two
  tokens in the same string now fails validation because it implies a second stop
  rather than a midpoint.
- **Radial shapes only accept `circle` or `ellipse`.** Rename vendor-specific shape
  labels to the standard `<rg-ending-shape>` keywords defined by CSS Images Module
  Level 3 before validating with the DTIF schema.

DTCG gradient metadata stored in `$extensions`:

```json
{
  "color": {
    "hero": {
      "start": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [1.0, 0.541, 0.0],
          "hex": "#FF8A00"
        }
      },
      "end": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.929, 0.098, 0.792],
          "hex": "#ED19CA"
        }
      }
    }
  },
  "gradient": {
    "hero-background": {
      "$type": "gradient",
      "$value": [
        { "color": "{color.hero.start}", "position": 0 },
        { "color": "{color.hero.end}", "position": 1 }
      ],
      "$extensions": {
        "com.example.export": {
          "angle": 45,
          "center": [0.5, 0.25],
          "hint": [0.25, 0.75]
        }
      }
    }
  }
}
```

DTIF conversion with CSS-compliant strings:

```json
{
  "gradient": {
    "hero-background": {
      "$type": "gradient",
      "$value": {
        "gradientType": "linear",
        "angle": "45deg",
        "center": "50% 25%",
        "hints": ["calc(25% + 2px)"],
        "stops": [
          { "position": "0%", "color": { "$ref": "#/color/hero-start" } },
          { "position": "100%", "color": { "$ref": "#/color/hero-end" } }
        ]
      }
    }
  }
}
```

### Transitions and motion {#transitions}

#### DTCG transition

```json
{
  "transition": {
    "button": {
      "$type": "transition",
      "$value": {
        "duration": { "value": 120, "unit": "ms" },
        "delay": { "value": 40, "unit": "ms" },
        "timingFunction": "{easing.standard}"
      },
      "$extensions": {
        "com.example.export": { "property": "transform" }
      }
    }
  },
  "easing": {
    "standard": {
      "$type": "cubicBezier",
      "$value": [0.4, 0.0, 0.2, 1.0]
    }
  }
}
```

#### DTIF transition (`examples/dtcg-migration/transition.tokens.json`)

```json
{
  "$version": "1.0.0",
  "duration": {
    "button-press": {
      "$type": "duration",
      "$value": {
        "durationType": "css.transition-duration",
        "value": 120,
        "unit": "ms"
      }
    },
    "button-delay": {
      "$type": "duration",
      "$value": {
        "durationType": "css.transition-delay",
        "value": 40,
        "unit": "ms"
      }
    }
  },
  "easing": {
    "standard": {
      "$type": "easing",
      "$value": {
        "easingFunction": "cubic-bezier",
        "parameters": [0.4, 0.0, 0.2, 1.0]
      }
    }
  },
  "motion": {
    "button-transition": {
      "$type": "motion",
      "$value": {
        "motionType": "css.transition",
        "parameters": {
          "property": "transform",
          "duration": { "$ref": "#/duration/button-press" },
          "delay": { "$ref": "#/duration/button-delay" },
          "easing": { "$ref": "#/easing/standard" }
        }
      }
    }
  }
}
```

Break transition composites into reusable `duration` and `easing` tokens, then reference
those tokens from a `motion` descriptor that names the target property. Copy any property
hints stored under DTCG `$extensions` into the motion parameters so the animation applies
to the intended CSS attribute.

## Embrace DTIF features {#dtif-features}

Migrating is an opportunity to adopt DTIF-only capabilities:

- **Functions inside `$value`.** DTIF tokens may embed calculated values using [function objects](../spec/token-types.md#value) (for example `clamp` or `calc`) with nested `$ref` parameters to express responsive behaviour.
- **Component tokens.** Group related primitives (for example a button’s background, border, and typography) into DTIF [component tokens](../spec/token-types.md#component-tokens) with named slots to improve reuse and theming.
- **Conditional overrides.** Encode platform or preference-specific variants through [`$overrides`](../spec/theming-overrides.md#theming-and-overrides) rather than maintaining separate ad-hoc documents.

### Example: upgrading component structure {#example-components}

#### DTCG component grouping

```json
{
  "button": {
    "$type": "color",
    "background": {
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.435, 1.0],
        "hex": "#006FFF"
      }
    },
    "text": {
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 1.0, 1.0],
        "hex": "#FFFFFF"
      }
    }
  },
  "spacing": {
    "$type": "dimension",
    "padding": { "$value": { "value": 16, "unit": "px" } }
  }
}
```

#### DTIF component token (`examples/dtcg-migration/component.tokens.json`)

```json
{
  "$version": "1.0.0",
  "color": {
    "button-background": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.0, 0.435, 1.0]
      }
    },
    "button-text": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [1.0, 1.0, 1.0, 1.0]
      }
    }
  },
  "dimension": {
    "padding-min": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 8,
        "unit": "px"
      }
    },
    "padding-max": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 16,
        "unit": "px"
      }
    }
  },
  "component": {
    "button": {
      "$type": "component",
      "$value": {
        "$slots": {
          "background": {
            "$type": "color",
            "$ref": "#/color/button-background"
          },
          "text": {
            "$type": "color",
            "$ref": "#/color/button-text"
          },
          "padding": {
            "$type": "dimension",
            "$value": {
              "fn": "clamp",
              "parameters": [
                { "$ref": "#/dimension/padding-min" },
                {
                  "dimensionType": "length",
                  "value": 2,
                  "unit": "vw"
                },
                { "$ref": "#/dimension/padding-max" }
              ]
            }
          }
        }
      }
    }
  }
}
```

Component tokens gather related primitives behind named slots and allow `$value` functions
to express responsive behaviour that DTCG cannot model directly.

## Validate and iterate {#validate}

1. **Run the schema.** Validate each migrated file with the published schema or the validator package described in [Getting started](./getting-started.md#getting-started). Example using Ajv:

   ```bash
   npx --yes ajv-cli validate -s schema/core.json -d "examples/dtcg-migration/*.tokens.json"
   ```

2. **Adopt automated tests.** Integrate [`@lapidist/dtif-validator`](https://www.npmjs.com/package/@lapidist/dtif-validator) in your CI pipeline to catch regressions and enforce pointer resolution.
3. **Document extensions.** When you port proprietary extension data, follow the [extension naming guidelines](../spec/format-serialisation.md#extension-naming-guidelines) so collaborators can understand and validate the additional payloads.

Careful, incremental conversion—type by type and component by component—keeps migrated
artifacts testable and unlocks the richer interoperability guarantees provided by DTIF.
