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

- **Collections instead of groups.** DTIF treats any object without a `$value` as a [collection](../spec/architecture-model.md#tokens-and-collections). DTCG groups may [declare a `$type` that applies to every nested token](https://www.designtokens.org/tr/drafts/format/#type-1), so copy inherited types onto each DTIF token because collections do not provide default typing.
- **Reserved member prefixes.** Both formats reserve `$`-prefixed keys. DTCG documents, groups, and tokens use `$description`, `$type`, and `$extensions` members and [forbid `{`, `}`, and `.` in names](https://www.designtokens.org/tr/drafts/format/#character-restrictions). DTIF keeps the prefix rules and adds document-level members such as [`$version`](../spec/architecture-model.md#versioning) and [`$overrides`](../spec/theming-overrides.md#theming-and-overrides), so migrate any group metadata into the corresponding collections and resolve naming conflicts before publishing.
- **Alias mechanics.** DTCG aliases rely on brace-delimited strings such as `"{button.background}"` described in the [alias section](https://www.designtokens.org/tr/drafts/format/#aliases-references). DTIF aliases use [`$ref` JSON Pointers](../spec/format-serialisation.md#ref) that start with `#` for local targets or include a URI fragment for external references. Convert each DTCG alias into a `$ref` and escape `/` or `~` characters as `~1` or `~0` per the pointer rules. DTIF additionally rejects directory traversal segments such as `../` or their percent-encoded form `%2E%2E`, so rewrite any exported DTCG file paths that rely on upward navigation before publishing.
- **Type identifiers.** DTCG `$type` strings often use short labels such as `"sizing"` or `"radius"`. DTIF [limits `$type` to the registry](../spec/format-serialisation.md#type) or to vendor-defined identifiers that follow a reverse-DNS pattern like `com.example.tokens.radius`. Map DTCG categories to the closest DTIF primitive (for example `"sizing"` → `"dimension"`, `"color"` stays `"color"`) or mint a namespaced identifier so the schema accepts the value and other tools know who owns it.

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
      "$value": "#006FFF",
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

### Normalise platform identifiers {#normalise-platform-identifiers}

Some DTCG exporters capitalise platform prefixes or reuse camel-cased API names when
serialising platform-specific identifiers. DTIF requires lower-case dot-separated
segments for these members so that [`cursorType`](../spec/token-types.md#cursor),
[`borderType`](../spec/token-types.md#border-tokens),
[`font.$value.fontType`](../spec/typography.md#font-face),
[`filterType`](../spec/token-types.md#filter-tokens),
[`opacityType`](../spec/token-types.md#opacity),
[`durationType`](../spec/token-types.md#duration),
[`zIndexType`](../spec/token-types.md#z-index),
[`motionType`](../spec/token-types.md#motion-tokens), and
[`easingFunction`](../spec/token-types.md#easing) map cleanly back to the CSS, UIKit,
and Android specifications. Normalise each segment to lower-case ASCII, replace camel
case with hyphenated words where needed, and join the segments with dots so validation
passes and downstream tooling can infer the platform context.

```json
// DTCG export
{
  "cursor": {
    "$type": "cursor",
    "$value": { "cursorType": "css.Cursor", "value": "pointer" }
  }
}

// DTIF conversion
{
  "cursor": {
    "$type": "cursor",
    "$value": { "cursorType": "css.cursor", "value": "pointer" }
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
      "background": { "$type": "color", "$value": "#006FFF" }
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
      "background": { "$type": "color", "$value": "#002255" }
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
      "$value": "#FFD600"
    },
    "caution": {
      "$description": "Preferred caution token",
      "$value": "#FFBB00"
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
      "hex": "#00000080"
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

## Convert composite tokens {#composite-tokens}

DTCG defines several composite types that combine multiple primitives. DTIF provides
richer schemas for these structures.

### Borders and stroke styles {#borders}

#### DTCG border

```json
{
  "color": {
    "focus": { "$type": "color", "$value": "#006FFF" }
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
        "dashArray": [4, 2],
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
        "dashArray": [4, 2],
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

### Shadows {#shadows}

#### DTCG shadow

```json
{
  "color": {
    "shadow": {
      "ambient": { "$type": "color", "$value": "#00000033" },
      "key": { "$type": "color", "$value": "#0000004d" }
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
  "gradient": {
    "hero-background": {
      "$type": "gradient",
      "$value": {
        "type": "linear",
        "angle": 45,
        "colorStops": [
          { "color": "#FF8A00", "position": 0 },
          { "color": "#ED19CA", "position": 1 }
        ]
      }
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

Normalise stop positions to percentages, map angles to CSS syntax, and mint shared
`color` tokens that gradient stops reference through `$ref` so palette aliases survive the
migration.

### Transitions and motion {#transitions}

#### DTCG transition

```json
{
  "transition": {
    "button": {
      "$type": "transition",
      "$value": {
        "property": "transform",
        "duration": { "value": 120, "unit": "ms" },
        "delay": { "value": 40, "unit": "ms" },
        "timingFunction": "{easing.standard}"
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
those tokens from a `motion` descriptor that names the target property.

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
    "background": { "$value": "#006FFF" },
    "text": { "$value": "#FFFFFF" }
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
