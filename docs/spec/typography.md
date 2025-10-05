---
title: Typography
description: Typography composition rules, font metrics, and related guidance for DTIF.
keywords:
  - typography
  - font
  - dtif
  - tokens
outline: [2, 3]
---

# Typography {#typography}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

Typography tokens group font-related metrics such as font family and size.

Consumers _MUST_ ignore unrecognised properties within a typography
value.

Future revisions _MAY_ introduce additional typography
sub-properties. Producers _SHOULD_ isolate experimental fields within
`$extensions` using a unique prefix, and consumers _MUST_
continue ignoring unknown members to preserve forward compatibility.

Typography tokens _MAY_ include a
`typographyType` property to classify intended usage. Canonical values include
`body`, `heading`, and `caption`. Vendors
_MAY_ register additional types or use identifiers matching the
pattern `^[a-zA-Z][\w-]*$`. Unregistered values are outside compatibility
guarantees and consumers _MUST_ treat them as vendor-specific. When
omitted, consumers _SHOULD_ infer usage from context.

::: info
See [Token types](./token-types.md#value) for shared `$value` requirements that apply to typography tokens.
:::

## Composition {#composition}

Minimal typography tokens define only `fontFamily` and `fontSize`.
Additional properties _MAY_ be layered to build complete styles.

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" }
      }
    }
  }
}
```

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "body": {
      "$value": { "fontWeight": 700, "lineHeight": 1.5 }
    }
  }
}
```

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontWeight": 700,
        "lineHeight": 1.5,
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" }
      }
    }
  }
}
```

Later layers override earlier properties for matching JSON Pointer paths. Example
documents are available in the `examples` directory:
[base](https://github.com/bylapidist/dtif/blob/main/examples/typography-base.tokens.json),
[layer](https://github.com/bylapidist/dtif/blob/main/examples/typography-layer.tokens.json), and
[merged](https://github.com/bylapidist/dtif/blob/main/examples/typography-complete.tokens.json).

Only `fontFamily` and `fontSize` _MUST_ be
supplied. All other members, including `lineHeight`, are optional and inherit
from the surrounding context when omitted. Implementations
_SHOULD_ fall back to platform defaults when a property is not
provided.

Common optional properties defer to platform specifications as follows:

- `wordSpacing` - `dimension` or keyword `normal`
  conforming to the
  `word-spacing` grammar.
- `color` - `color` tokens referencing
  CSS colour spaces or the native
  colour APIs cited in the [colour section](#color).
- `textDecoration` - keyword or shorthand lists matching the
  `text-decoration`
  grammar.
- `textTransform` - keyword sequences that satisfy the
  `text-transform`
  grammar.
- `fontFeatures` - array of OpenType feature tags registered in
  OpenType Feature Tag Registry.
- `fontVariant` - keywords from the
  `font-variant` grammar.
- `fontStretch` - keywords from the
  `font-stretch` grammar.
- `underlineThickness` - `font-dimension`.
- `underlineOffset` - `font-dimension`.
- `overlineThickness` - `font-dimension`.
- `overlineOffset` - `font-dimension`.

Typography values _MAY_ reuse shared tokens via alias objects whose only member is
`$ref`. The pointer _MAY_ resolve through additional aliases before reaching the source
measurement; consumers _MUST_ follow the chain until a concrete token is located.
Each `$ref` _MUST_ ultimately resolve to a token declaring the expected `$type`: `fontSize`,
`letterSpacing`, `wordSpacing`, and `lineHeight` references _MUST_ terminate at `dimension`
tokens whose `$value.dimensionType` is `"length"`, while `color` references _MUST_ resolve to
`color` tokens. Consumers _MUST_ reject `$ref` targets that do not meet these
requirements so typography tokens remain well-typed composites.

```json dtif
{
  "$version": "1.0.0",
  "dimension": {
    "shared": {
      "body-size": {
        "$type": "dimension",
        "$value": { "dimensionType": "length", "value": 16, "unit": "px" }
      },
      "body-letter-spacing": {
        "$type": "dimension",
        "$value": { "dimensionType": "length", "value": -0.5, "unit": "px" }
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
      }
    }
  },
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": { "$ref": "#/dimension/typography/body-size" },
        "letterSpacing": { "$ref": "#/dimension/typography/body-letter-spacing" }
      }
    }
  }
}
```

The table below maps typography members to their authoritative references.

_Table: Normative references for typography members._

| Typography member | Normative references                                                                                                                                   |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fontFamily`      | `font-family`, iOS font registration, Android font resources                                                                                           |
| `fontWeight`      | `font-weight`, UIFont.Weight, Typeface.Builder#setWeight                                                                                               |
| `fontStyle`       | `font-style`, UIFontDescriptor.SymbolicTraits, UIFontDescriptor.AttributeName.variations, FontVariationAxis, Typeface.Builder#setFontVariationSettings |
| `letterSpacing`   | `letter-spacing`, NSAttributedString.Key.kern, TextView#setLetterSpacing                                                                               |
| `wordSpacing`     | `word-spacing`                                                                                                                                         |
| `textDecoration`  | `text-decoration`, NSUnderlineStyle, Paint underline flags                                                                                             |
| `textTransform`   | `text-transform`, NSStringTransform, Java String case conversion                                                                                       |
| `fontFeatures`    | `font-feature-settings`, OpenType feature registry                                                                                                     |

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" },
        "lineHeight": 1.5,
        "letterSpacing": { "dimensionType": "length", "value": 0.5, "unit": "px" },
        "wordSpacing": { "dimensionType": "length", "value": 2, "unit": "px" },
        "color": { "colorSpace": "srgb", "components": [0.2, 0.25, 0.3, 1] },
        "textDecoration": "underline",
        "textTransform": "uppercase",
        "fontFeatures": ["smcp", "liga"]
      }
    }
  }
}
```

Vendors _MAY_ define additional typography members. Consumers
_MUST_ ignore unrecognised properties to maintain interoperability.
Producers adding experimental members _SHOULD_ follow the
[extension naming guidelines](./format-serialisation.md#extension-naming-guidelines)
(reverse-DNS prefixes, registry reuse, and published documentation) to avoid collisions
and clarify proprietary semantics.

## Font fallbacks {#font-fallbacks}

Font tokens record the canonical family in `family` and _MAY_ supply
an ordered `fallbacks` array. The `fallbacks` member _MUST_ contain one or
more trimmed strings that satisfy the `<family-name>` grammar or the
generic-family keywords defined in CSS Fonts Module Level 4. Consumers
_MUST_ preserve the supplied order when generating CSS `font-family`
lists or native descriptors so the stack mirrors DTCG semantics.

When migrating DTCG `fontFamily` arrays, producers _MUST_ assign the
first entry to `family` and the remaining entries to `fallbacks`. Typography
tokens that reference a `font` token—either by string name or `$ref`
pointer—_MUST_ surface the same ordered stack when emitting CSS or
native descriptors. Typography tokens serialised with only a string
`fontFamily` carry no additional fallback data beyond the primary
family name.

## Font dimensions {#font-dimensions}

A `font-dimension` is a constrained dimension object. The
`dimensionType` _MUST_ be `"length"`, the
`value` _MUST_ be numeric, and the resulting measurement
_MUST_ conform to the
`<length>` or
`<percentage>` productions
defined in CSS Values and Units. Native consumers
_MUST_ interpret points per
Apple's layout guidance and density- or scale-independent
units per Android's pixel density guidance. Negative
values remain valid so designers can intentionally tighten spacing. Producers
_MAY_ include `fontScale` to indicate whether the value
participates in user-controlled font scaling.

A `font-dimension` _MAY_ also be expressed as an alias object whose only member is
`$ref`. Such aliases _MUST_ resolve to tokens declaring `$type` `"dimension"` and a
`$value.dimensionType` of `"length"`. Alias chains _MAY_ include additional
`dimension` tokens that themselves forward to shared measurements; consumers _MUST_
resolve the chain until a concrete measurement is found.

Typography members such as `lineHeight`, `letterSpacing`, and
underline metrics reuse `font-dimension` so that consumers can apply consistent
conversions. Consumers _MUST_ reject
`font-dimension` objects whose `dimensionType` is not
`"length"` or whose units do not satisfy the grammars cited above. When
`fontScale` is present, consumers _MUST_ apply the
platform scaling behaviour referenced for `dimension` tokens.

## Line height {#line-height}

`lineHeight` _MAY_ be expressed as a unitless number or
a `font-dimension`.

Unitless numbers represent ratios and inherit as raw numbers so descendants scale with
their own `fontSize`. Font-dimension values provide an explicit height and
inherit as absolute lengths. When `lineHeight` is expressed as a
`font-dimension`, the measurement _MUST_ conform to the
`<length>` or
`<percentage>` productions in
CSS Values and Units and
_MUST_ observe the point and density-scaling semantics defined in
Apple's layout guidance,
Apple's typography guidance, and
Android's pixel density guidance.

- Web consumers _MUST_ multiply ratios by the computed
  `font-size` and interpret lengths per
  CSS Values and Units.
- Android consumers _MUST_ map ratios to
  `setLineSpacing` and honour the scaling behaviour for density- and
  scale-independent units described in
  Android's pixel density guidance when
  `fontScale` is `true`.
- iOS consumers _MUST_ map ratios to
  `lineHeightMultiple`, treat absolute points per
  Apple's layout guidance, and apply Dynamic Type behaviour
  per Apple's typography guidance when
  `fontScale` is `true`.

The `lineHeight` value _MUST_ represent the
baseline-to-baseline distance between lines of text. Additional leading above or below
this region is not part of the measurement.

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" },
        "lineHeight": 1.5
      }
    }
  }
}
```

The example above yields a baseline distance of `24px`.

The value _MUST_ be non‑negative. Consumers
_MUST_ treat strings or negative numbers as invalid. When
`lineHeight` is omitted, consumers _MAY_ derive a
default or inherit from context. Implementations _MAY_ fall back to
platform defaults, commonly about `1.2 × fontSize` on the web.
Authors should use unitless numbers when the baseline distance ought to scale with
`fontSize`, and dimension objects when a fixed baseline distance is required
(for example to align to a baseline grid). This union of types preserves compatibility in
the core specification. A future revision may adopt a dedicated
`lineHeight` object with members such as `value`, `unit`,
and `isRelative` to unify these representations and reduce ambiguity for
implementers.

Omitting `lineHeight` signals that consumers should inherit baseline spacing
from the surrounding context. Authors _SHOULD_ prefer omission over
copying resolved platform defaults when native typography metrics are desired.

When multiple representations of `lineHeight` are supplied through document
layering or overrides, consumers _MUST_ resolve them as follows:

1. If a `font-dimension` value is present, convert it to the consumer's internal
   unit and use it.
2. Otherwise, if a unitless number is present, multiply it by
   `fontSize` to obtain an absolute length in the unit of `fontSize`.
3. Discard any additional `lineHeight` values.

Consumers _MUST_ normalise `lineHeight`
`font-dimension` values using standard CSS unit conversion rules prior to
comparison or inheritance.

Misinterpreting `fontScale`, providing unsupported units, or relying on
platform-specific defaults can yield inconsistent line spacing. Implementers
_SHOULD_ test tokens on target platforms and verify that values
marked with `fontScale: true` respond to user settings. Cross-platform test
suites _SHOULD_ include ratio, absolute, and inherited
`lineHeight` examples to confirm interoperability.

## Letter spacing {#letter-spacing}

`letterSpacing` _MAY_ be expressed as the keyword
`normal` or a `font-dimension` measurement.

When `letterSpacing` is `normal`, the value
_MUST_ conform to the
`letter-spacing` grammar
defined in CSS Text. When a `font-dimension` is
supplied, the measurement _MUST_ conform to the
`<length>` production in
CSS Values and Units and
_MUST_ honour the point and density semantics defined in
Apple's layout guidance and
Android's pixel density guidance.

Native consumers _MUST_ map absolute adjustments using
NSAttributedString.Key.kern (points) and
TextView#setLetterSpacing (em space deltas).
Android implementations _MUST_ divide the resolved absolute length
by the computed `fontSize` to obtain the em delta expected by the platform API.
Negative values remain valid on all platforms.

When provided, the optional `fontScale` flag continues to describe whether the
spacing participates in user-controlled font scaling, following the conversion rules
defined for `font-dimension`.

## Word spacing {#word-spacing}

`wordSpacing` _MAY_ be expressed as the keyword
`normal` or a `dimension` matching the
`word-spacing` grammar.

The value _MUST_ conform to the
`<length-percentage>`
production. When a length is supplied, the measurement
_MUST_ follow the
`<length>` grammar. When a
percentage is supplied, consumers _MUST_ resolve it against the
current `fontSize` per CSS Text. Native
implementations _MUST_ reuse the unit conversions defined for
`dimension` tokens so that `pt`, `dp`, and
`sp` map to the platform units defined in
Apple's layout guidance and
Android's pixel density guidance.

Platforms without a dedicated word-spacing API _MAY_ approximate
the behaviour by adjusting letter spacing or by emitting a warning and preserving the
authored text. When `fontScale` appears on a
`wordSpacing` dimension, consumers _MUST_ adopt the same
scaling rules as `font-dimension`
values.

## Font weight {#font-weight}

`fontWeight` _MAY_ encode keywords, numbers, or axis
values defined by the
`font-weight` grammar.

The value _MUST_ conform to the
`<font-weight-absolute>`
or
`<font-weight-relative>`
productions. Numeric weights _MUST_ fall within the
`1`-`1000` range defined by CSS Fonts, and consumers
_MUST_ treat negative numbers as invalid. Relative keywords such as
`bolder` and `lighter` _MUST_ resolve using
the algorithm defined in CSS Fonts.

iOS consumers _MUST_ map the resolved weight to
UIFont.Weight or the `wght` variation axis.
Android consumers _MUST_ map weights to
Typeface.Builder#setWeight, clamping to the
platform's `1`-`1000` range when necessary. Web consumers
_MUST_ apply the CSS weight resolution algorithm when cascading
values through the DOM.

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "heading": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" },
        "fontWeight": 700
      }
    }
  }
}
```

## Font style {#font-style}

`fontStyle` _MUST_ be serialised as a string matching
the `font-style` grammar defined
by CSS Fonts. Producers _MAY_ supply
the keywords `normal` and `italic` or the
`oblique`
form with an explicit angle. Any angle _MUST_ conform to the
`<angle>` production so that CSS and
native consumers interpret the token consistently.

When the resolved value is `italic` or `oblique` without an explicit
angle, consumers _MUST_ toggle the italic traits documented for
UIFontDescriptor.SymbolicTraits and legacy Android
style enums exposed alongside FontVariationAxis.
When an angle is provided, consumers _MUST_ normalise the CSS
`<angle>` to degrees before passing it to the `slnt` variation
axis defined by
UIFontDescriptor.AttributeName.variations and
Typeface.Builder#setFontVariationSettings. Fonts
that omit a `slnt` axis _MAY_ fall back to italic traits
while preserving the authored angle for downstream consumers.

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "italic": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" },
        "fontStyle": "oblique -12deg"
      }
    }
  }
}
```

## Text decoration {#text-decoration}

`textDecoration` _MAY_ encode the shorthand defined for
the
`text-decoration`
property, including line, style, colour, and thickness components.

Values _MUST_ conform to the
`<text-decoration-line>`,
`<text-decoration-style>`, and
`<text-decoration-thickness>`
productions when present. CSS colour values _MUST_ reuse the colour
token guidance in this specification. iOS consumers _MUST_ map
resolved decorations to NSUnderlineStyle, while
Android consumers _MUST_ apply the appropriate
Paint underline and strike-through flags and
interpret thickness using the same conversion rules as `font-dimension`.

## Text transform {#text-transform}

`textTransform` _MAY_ encode sequences defined by the
`text-transform` grammar,
including multiple keywords and language-sensitive casing rules.

Values _MUST_ conform to the
`<text-transform-list>`
production. Consumers _MUST_ apply keywords in source order using
the algorithms defined in CSS Text. Native implementations
_MUST_ rely on platform casing APIs such as
NSStringTransform and
Java String case conversion to preserve locale
awareness. When a platform lacks direct support for a requested transform, consumers
_SHOULD_ emit a warning and fall back to the closest available
behaviour.

## Color {#color}

`color` _MAY_ specify a colour value for the text.

When omitted, consumers _MAY_ derive a default from context.

## Font features {#font-features}

`fontFeatures` _MAY_ provide an array matching the
`font-feature-settings`
property, where each string _MUST_ be a registered OpenType feature
tag from the OpenType Feature Tag Registry or a
vendor tag defined by the referenced font.

Consumers _MUST_ ignore tags they do not recognise and
_MUST_ forward axis settings to the underlying font subsystem on
web and native platforms.

## Maturity roadmap {#maturity-roadmap}

All properties described in this section are part of the stable core specification.

## Font face {#font-face}

Font face tokens describe downloadable or local font resources so multiple typography tokens
can reference a shared family. The `$value` object
_MUST_ provide a `fontFamily` that conforms to the
`<family-name>` production
defined by CSS Fonts and
_MUST_ include a `src` array describing one or more
sources from the
`src` descriptor.

Each `src` entry _MUST_ be either a
`url()`-style record that references font data or a `local()` record
naming an installed font. URL entries _MUST_ resolve to the same font
file a browser would load for the
`@font-face`
`src` list and _MUST_ be registered with the native font
catalog- using CTFontManagerRegisterFontsForURL or the
process described in
Apple's font registration guidance on iOS, and
font-family XML or
Font.Builder on Android- before creating a font
instance. Local entries _MUST_ use the
`<family-name>` grammar and
_MUST_ reference families that the target platform exposes through
UIFontDescriptor or
Typeface lookups.

Optional hints on URL entries such as `format` and `tech`
_MUST_ mirror the
`format()` and
`tech()` functions from the CSS
`src` grammar. Platform consumers _MAY_ ignore unsupported
hints but _MUST_ respect them when the platform provides equivalent
capability checks.

Additional descriptors reuse CSS Fonts productions: `fontWeight`
_MUST_ follow the
`<font-weight-absolute>`
grammar, `fontStyle` the
`font-style` grammar (including
the `<angle>` production for
oblique slants), and `fontStretch` the
`<font-stretch-absolute>`
grammar. The `unicodeRange` descriptor _MUST_ conform to
the `unicode-range` syntax, and
`fontDisplay` _MUST_ use keywords defined by
`font-display`. Native platforms treat these descriptors as metadata for
UIFontDescriptor traits and
Typeface.Builder configuration.

Typography tokens _MAY_ reference font faces using
`$ref` so that `fontFamily` values, variation descriptors, and
registration metadata stay aligned across CSS, iOS, and Android implementations.

| Font face member               | Normative references                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fontFace.$value.fontFamily`   | `<family-name>`, Apple font registration, Android font resources                                                                                       |
| `fontFace.$value.src[].url`    | `@font-face src`, CTFontManagerRegisterFontsForURL, Font.Builder                                                                                       |
| `fontFace.$value.src[].local`  | `local()`, UIFontDescriptor, Typeface                                                                                                                  |
| `fontFace.$value.src[].format` | `format()`                                                                                                                                             |
| `fontFace.$value.src[].tech`   | `tech()`                                                                                                                                               |
| `fontFace.$value.fontWeight`   | `font-weight`, UIFont.Weight, Typeface.Builder#setWeight                                                                                               |
| `fontFace.$value.fontStyle`    | `font-style`, UIFontDescriptor.SymbolicTraits, UIFontDescriptor.AttributeName.variations, FontVariationAxis, Typeface.Builder#setFontVariationSettings |
| `fontFace.$value.fontStretch`  | `<font-stretch-absolute>`                                                                                                                              |
| `fontFace.$value.unicodeRange` | `unicode-range`                                                                                                                                        |
| `fontFace.$value.fontDisplay`  | `font-display`                                                                                                                                         |

```json dtif
{
  "$version": "1.0.0",
  "fontFace": {
    "brand": {
      "$type": "fontFace",
      "$value": {
        "fontFamily": "Brand Sans",
        "fontWeight": 400,
        "fontStyle": "normal",
        "fontStretch": "semi-expanded",
        "unicodeRange": "U+000-5FF, U+13A0-13F5",
        "fontDisplay": "swap",
        "src": [
          { "local": "Brand Sans" },
          {
            "url": "https://cdn.example.com/fonts/BrandSans-Regular.woff2",
            "format": ["woff2"],
            "tech": ["variations"]
          },
          {
            "url": "https://cdn.example.com/fonts/BrandSans-Regular.ttf",
            "format": ["truetype"]
          }
        ]
      }
    }
  },
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "typographyType": "body",
        "fontFamily": { "$ref": "#/fontFace/brand/$value/fontFamily" },
        "fontSize": { "dimensionType": "length", "value": 16, "unit": "px" },
        "lineHeight": 1.5
      }
    }
  }
}
```

A complete example document is available at
[font-face.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/font-face.tokens.json).
