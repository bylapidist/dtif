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
- **Alias mechanics.** DTCG aliases rely on brace-delimited strings such as `"{button.background}"` described in the [alias section](https://www.designtokens.org/tr/drafts/format/#aliases-references). DTIF aliases use [`$ref` JSON Pointers](../spec/format-serialisation.md#ref) that start with `#` for local targets or include a URI fragment for external references. Convert each DTCG alias into a `$ref` and escape `/` or `~` characters as `~1` or `~0` per the pointer rules.

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

## Prepare the document shell {#document-shell}

1. **Declare a version.** DTCG files do not mandate document versioning. DTIF documents [SHOULD include a `$version`](../spec/architecture-model.md#versioning) that follows Semantic Versioning so consumers can evaluate compatibility.
2. **Copy document metadata.** DTCG groups may expose [`$description`](https://www.designtokens.org/tr/drafts/format/#description-0), [`$extensions`](https://www.designtokens.org/tr/drafts/format/#extensions-0), and `$deprecated`. Mirror those members on the new collections, carrying group-level `$deprecated` flags across as collection metadata and migrating any string explanations into `$description` or vendor extensions. When you need file-level governance details, place them inside the document's top-level `$extensions`; lifecycle fields such as `$lastModified` and `$author` remain token-scoped in DTIF.
3. **Decide on layering.** If the DTCG workflow produced separate files per theme or mode, DTIF lets you combine them by layering documents or by defining a [`$overrides` array](../spec/theming-overrides.md#theming-and-overrides) with explicit conditionals.
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
- **Lifecycle fields.** DTIF optionally records `$lastModified`, `$lastUsed`, `$usageCount`, `$author`, `$tags`, and `$hash`. Populate these from any analytics captured alongside the source tokens ([Metadata](../spec/metadata.md#metadata)).

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
        "style": "normal",
        "weight": 400
      },
      "$extensions": {
        "org.example.fonts": {
          "fallbacks": ["Arial", "sans-serif"]
        }
      }
    }
  },
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontWeight": 400,
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "letterSpacing": {
          "dimensionType": "length",
          "value": 0.5,
          "unit": "px"
        },
        "lineHeight": 1.5
      }
    }
  }
}
```

Consolidate font metadata into a reusable `font` token, keep fallback stacks in extensions,
and replace `{token.reference}` strings with `$ref` pointers wherever DTIF expects nested
objects such as shared dimensions or colours.

## Convert composite tokens {#composite-tokens}

DTCG defines several composite types that combine multiple primitives. DTIF provides
richer schemas for these structures.

### Borders and stroke styles {#borders}

#### DTCG border

```json
{
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
        "color": "#006FFF",
        "style": "solid",
        "width": { "value": 2, "unit": "px" }
      }
    }
  }
}
```

#### DTIF border (`examples/dtcg-migration/border.tokens.json`)

```json
{
  "$version": "1.0.0",
  "border": {
    "focus-outline": {
      "$type": "border",
      "$value": {
        "borderType": "css.border",
        "color": {
          "colorSpace": "srgb",
          "components": [0.0, 0.435, 1.0, 1.0]
        },
        "style": "solid",
        "width": {
          "dimensionType": "length",
          "value": 2,
          "unit": "px"
        }
      },
      "$extensions": {
        "org.example.stroke": {
          "dashArray": [4, 2],
          "lineCap": "round"
        }
      }
    }
  }
}
```

DTIF `border` tokens capture the rendering context through `borderType` and store
platform-specific stroke details inside vendor extensions.

### Shadows {#shadows}

#### DTCG shadow

```json
{
  "shadow": {
    "button-ambient": {
      "$type": "shadow",
      "$value": [
        {
          "color": "#00000080",
          "offsetX": { "value": 0, "unit": "px" },
          "offsetY": { "value": 2, "unit": "px" },
          "blur": { "value": 6, "unit": "px" },
          "spread": { "value": 0, "unit": "px" }
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
  "shadow": {
    "button-ambient": {
      "$type": "shadow",
      "$value": {
        "shadowType": "css.box-shadow",
        "offsetX": {
          "dimensionType": "length",
          "value": 0,
          "unit": "px"
        },
        "offsetY": {
          "dimensionType": "length",
          "value": 2,
          "unit": "px"
        },
        "blur": {
          "dimensionType": "length",
          "value": 6,
          "unit": "px"
        },
        "spread": {
          "dimensionType": "length",
          "value": 0,
          "unit": "px"
        },
        "color": {
          "colorSpace": "srgb",
          "components": [0.0, 0.0, 0.0, 0.2]
        }
      }
    }
  }
}
```

Convert shadow arrays into DTIF objects with explicit `shadowType` strings and dimension
wrappers for each offset.

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
  "gradient": {
    "hero-background": {
      "$type": "gradient",
      "$value": {
        "gradientType": "linear",
        "angle": "to top right",
        "stops": [
          {
            "position": "0%",
            "color": {
              "colorSpace": "srgb",
              "components": [1.0, 0.541, 0.0, 1.0]
            }
          },
          {
            "position": "100%",
            "color": {
              "colorSpace": "srgb",
              "components": [0.929, 0.098, 0.792, 1.0]
            }
          }
        ]
      }
    }
  }
}
```

Normalise stop positions to percentages, map angles to CSS syntax, and encode each colour
using DTIF's colour structure.

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
