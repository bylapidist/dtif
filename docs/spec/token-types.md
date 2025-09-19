---
title: Token types
description: Value semantics and component definitions for DTIF tokens.
keywords:
  - dtif
  - token types
  - json
outline: [2, 3]
---

# Token types {#token-types}

> Sections marked as "Note" or "Example" are non-normative. Everything else is normative.

This chapter defines the value structures associated with each registered token type and references the authoritative platform specifications.

## Primitive tokens {#primitive-tokens}

### Shared `$value` semantics {#value}

`$value` expresses the design decision. Its JSON type depends on
`$type`.

To express computed results, `$value` _MAY_ be a
function object with string `fn` and array `parameters` members.
Parameters _MAY_ include literals, `$ref` aliases, or
nested function objects. Alias parameters _MUST_ be objects whose
only member is a `$ref` containing a valid DTIF pointer, and parameter lists
_MAY_ contain arrays to represent list-style arguments. Resolved
alias targets _MUST_ declare the same `$type` as the
token containing the function; consumers _MUST_ treat mismatched or
untyped targets as errors. The function's evaluation result
_MUST_ match the token's `$type`.

<!-- prettier-ignore -->
```json
{
  "$type": "dimension",
  "$value": {
    "fn": "calc",
    "parameters": [
      "100%",
      "-",
      { "$ref": "#/spacing/small" }
    ]
  }
}
```

Dynamic values express responsive or conditional results. Producers
_MAY_ use well-known functions such as `clamp` with
parameters representing minimum, viewport-based, and maximum values. Consumers
_SHOULD_ resolve these expressions prior to rendering so that
design decisions materialise predictably across platforms.

```json
{
  "$type": "dimension",
  "$value": {
    "fn": "clamp",
    "parameters": [
      { "dimensionType": "length", "value": 8, "unit": "px" },
      { "dimensionType": "length", "value": 2, "unit": "vw" },
      { "dimensionType": "length", "value": 16, "unit": "px" }
    ]
  }
}
```

The following subsections detail the primitive token types registered by this specification.

### `dimension` tokens {#dimension}

For the `dimension` type the value _MUST_ be an object
with string `dimensionType`, numeric `value`, and string
`unit` members:

```json
{
  "$type": "dimension",
  "$value": {
    "dimensionType": "length",
    "value": 12,
    "unit": "pt"
  }
}
```

The `dimensionType` clarifies the measurement category (`length`,
`angle`, `resolution`, or vendor-defined `custom`). The
`value` and `unit` members combine to express a measurement that
_MUST_ conform to the platform grammar associated with that
category:

- `length` dimensions _MUST_ conform to the
  `<length>` production defined
  in CSS Values and Units. When expressing
  percentages, the value _MUST_ conform to the
  `<percentage>` production from
  the same specification. Producers targeting iOS _MUST_ serialise
  points as defined in Apple's Human Interface Guidelines,
  and producers targeting Android _MUST_ serialise density- and
  scale-independent units as defined in
  Android's pixel density guidance when those platforms
  are the intended consumers.
- `angle` dimensions _MUST_ conform to the
  `<angle>` production defined
  in CSS Values and Units.
- `resolution` dimensions _MUST_ conform to the
  `<resolution>` production
  defined in CSS Values and Units.
- `custom` dimensions _MUST_ supply a reverse-DNS unit
  identifier such as `com.example.tokens.scale`. Producers
  _MUST_ document the semantics and consumers
  _MAY_ reject unrecognised identifiers.

Consumers _MUST_ reject tokens whose `unit` does not
match the declared `dimensionType`. A boolean `fontScale` member
_MAY_ indicate that a length participates in user font scaling, but
producers _MUST NOT_ include `fontScale` for non-
`length` dimensions. When `fontScale` is `true`,
consumers _MUST_ apply Dynamic Type behaviour on iOS as described
in Apple's typography guidance and scale-independent
pixel behaviour on Android as described in
Android's pixel density guidance. When
`fontScale` is `false`, consumers
_MUST_ treat the measurement as fixed in the platform-specific
units defined above. On the web, authors _MAY_ rely on relative CSS
units whose semantics are defined in
CSS Values and Units. When
`fontScale` is omitted, consumers _MAY_ apply platform
defaults.

The table below maps dimension-related members to their authoritative platform
specifications. Future revisions are expected to expand this matrix to cover additional
token types.

_Table: Normative references for dimension-related members._

| Property                                           | Normative references                                                                                               |
| :------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `dimension.$value` (`dimensionType: "length"`)     | `<length>`, `<percentage>`, Apple's layout guidance, Android's pixel density guidance                              |
| `dimension.$value` (`dimensionType: "angle"`)      | `<angle>`                                                                                                          |
| `dimension.$value` (`dimensionType: "resolution"`) | `<resolution>`                                                                                                     |
| `dimension.$value.fontScale`                       | Apple's typography guidance, Android's pixel density guidance                                                      |
| `font-dimension.$value`                            | `<length>`, `<percentage>`, Apple's layout guidance, Android's pixel density guidance                              |
| `typography.lineHeight` (dimension form)           | `<length>`, `<percentage>`, Apple's layout guidance, Apple's typography guidance, Android's pixel density guidance |

### `color` tokens {#color}

For the `color` type the value _MUST_ be an object with
string `colorSpace` and array `components` members. The
`colorSpace` member _MUST_ be an
`<ident>` naming a colour space
defined by
CSS Color Module Level 4 or
registered via
`@color-profile`. Producers targeting native platforms _MAY_ use identifiers that
correspond to colour spaces provided by
Core Graphics or
android.graphics.ColorSpace; such identifiers
_MUST_ resolve to the same profile definitions described by the CSS
specification. Producers introducing custom colour spaces via
`@color-profile`
_MUST_ deliver the corresponding profile definition alongside the
token document- for example through `$extensions` metadata or adjacent CSS- so
consumers can resolve the identifier.

The `components` array _MUST_ list channel values in the
order defined for the referenced colour space by
CSS Color Module Level 4. Authors
_MAY_ omit the optional alpha channel; when omitted consumers
_MUST_ treat alpha as `1`. Channel ranges, polar forms,
and percentage handling _MUST_ follow the grammar of the
corresponding CSS functions (for example
`color()`, `lab()`, `oklab()`, and `hwb()`). When component counts do not match the referenced grammar, consumers
_MUST_ treat the token as invalid. Values outside the rendering
gamut of a target platform _SHOULD_ trigger warnings and
_MAY_ be clamped per platform behaviour rather than rejected
outright.

Producers _MAY_ include a `hex` string to preserve a
CSS hexadecimal serialisation of an sRGB colour. The value
_MUST_ conform to the CSS
`#rgb`, `#rgba`, `#rrggbb`, or `#rrggbbaa`
forms defined by
CSS Color Module Level 4, and the
declared `colorSpace` _MUST_ be `srgb`. When a
serialisation omits an embedded alpha channel, producers
_MAY_ include an `alpha` number between `0` and `1` to mirror
the CSS `<alpha-value>` grammar. The `alpha`
member _MUST NOT_ appear without `hex`, and consumers
_SHOULD_ continue to derive rendering values from the
canonical `components` array.

Consumers _MUST_ convert the declared colour space using
CGColorSpace on iOS and
android.graphics.ColorSpace on Android before
sampling the supplied channel values, and _SHOULD_ preserve
precision when serialising to CSS as described in
CSS Color Module Level 4.
When consumers cannot resolve a colour-space identifier to CSS or native definitions, they
_SHOULD_ warn and _MAY_ fall back to a
well-defined default such as sRGB.

```json
{
  "$type": "color",
  "$value": {
    "colorSpace": "srgb",
    "components": [0.2, 0.6, 0.7, 0.9],
    "hex": "#3399b3e6"
  }
}
```

The table below maps colour-related members to their authoritative specifications.

_Table: Normative references for colour token members._

| Property                  | Normative references                                                                              |
| :------------------------ | :------------------------------------------------------------------------------------------------ |
| `color.$value.colorSpace` | CSS Color Module Level 4, `@color-profile`, Apple Core Graphics colour spaces, Android ColorSpace |
| `color.$value.components` | `color()`, `lab()`, `oklab()`, `oklch()`, `hwb()`                                                 |

### `font` tokens {#font}

For the `font` type the `$value` object
_MUST_ include string `fontType` and
`family` members. The `fontType` member identifies the asset source
using a dot-separated identifier whose leading segment names the platform context
(`css`, `ios`, or `android`). Identifiers
_MUST_ mirror the terminology published by the authoritative
specification for that platform so consumers defer to the canonical loading mechanism.

Canonical identifiers include:

- `css.font-face` for fonts delivered through
  `@font-face` `src`
  `url()` entries and `css.local` for fonts resolved with
  `local()` descriptors. When
  `fontType` begins with `css` the suffix
  _MUST_ correspond to the production names defined by
  CSS Fonts.
- `ios.system` for fonts exposed via
  UIFont system APIs and `ios.registered` for
  fonts installed with
  CTFontManagerRegisterFontsForURL.
- `android.system` for defaults provided by
  android.graphics.Typeface and
  `android.font-resource` for resources declared with
  Fonts in XML.

Producers _MAY_ register additional suffixes in the
[DTIF registry](https://github.com/bylapidist/dtif/blob/main/registry/README.md) when new platform mechanisms appear.
Consumers encountering an unknown prefix or suffix _SHOULD_ warn
and _MAY_ ignore the token to keep the canonical specifications as
the source of truth.

```json
{
  "$type": "font",
  "$value": {
    "fontType": "css.font-face",
    "family": "Brand Sans",
    "style": "oblique 12deg",
    "weight": 600
  }
}
```

The `family` member _MUST_ name the canonical family
recognised by the target runtime using the
`<family-name>` grammar
from CSS Fonts Module Level 4. Native platforms
_MUST_ match the registered names exposed via
Apple's font catalog APIs and
Android font resources; tooling
_MUST_ reject names that the platform cannot resolve.

The optional `style` member _MUST_ conform to the
`<font-style-absolute>`
production, including oblique angles expressed with the
`<angle>` grammar. iOS consumers
_MUST_ map the resolved style to
UIFontDescriptor.SymbolicTraits and related slant
traits described by UIFontDescriptor. Android
consumers _MUST_ apply the equivalent
FontVariationAxis or
Typeface.Builder#setFontVariationSettings
behaviour alongside italic flags.

The optional `weight` member _MUST_ conform to the
`<font-weight-absolute>`
or
`<font-weight-relative>`
productions from CSS Fonts. Numeric weights _MUST_ stay within the
`1`-`1000` range mandated by CSS; iOS consumers
_MUST_ map these values to
UIFont.Weight or the `wght` axis, and
Android consumers _MUST_ map them via
Typeface.Builder#setWeight.

Producers targeting oblique variation axes _MAY_ serialise the
requested slant using CSS grammar- such as `"oblique 14deg"`- while consumers
convert the angle to the platform-specific descriptor. Consumers encountering a
`style` or `weight` they cannot represent
_SHOULD_ emit diagnostics and fall back to the closest supported
font metrics.

The example below resolves `font.brand` with
`fontType: css.font-face` across CSS, iOS, and Android consumers.

To preserve portability, additional members _MUST NOT_ be supplied.
Consumers encountering unrecognised members _MUST_ treat the token
as invalid so the descriptor remains compatible with CSS and platform font APIs.

The table below maps font-related members to their authoritative specifications.

_Table: Normative references for font token members._

| Property               | Normative references                                                                                        |
| :--------------------- | :---------------------------------------------------------------------------------------------------------- |
| `font.$value.fontType` | `@font-face src`, UIFont, CTFontManagerRegisterFontsForURL, Fonts in XML, Typeface                          |
| `font.$value.family`   | `<family-name>`, Apple font catalog registration, Android font resources                                    |
| `font.$value.style`    | `font-style`, UIFontDescriptor.SymbolicTraits, FontVariationAxis, Typeface.Builder#setFontVariationSettings |
| `font.$value.weight`   | `font-weight`, UIFont.Weight, Typeface.Builder#setWeight                                                    |

> Example token documents demonstrating these patterns are available in
> [font.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/font.tokens.json).

### `opacity` tokens {#opacity}

For the `opacity` type the `$value` object
_MUST_ include a string `opacityType` member and a
`value` member. The `opacityType` _MUST_ be a
dot-separated identifier whose first segment names the platform (`css`,
`ios`, or `android`) and whose remaining segments correspond to
property identifiers defined by the platform specification- for example
`css.opacity` from
CSS Color Module Level 4,
`ios.uiview.alpha` from UIKit, or
`android.view.alpha` from
android.view.View. Producers targeting
CALayer _MAY_ use
`ios.layer.opacity` to align with Core Animation terminology.

The `value` member _MUST_ conform to the
`<alpha-value>`
production when expressed in CSS syntax and _MUST_ honour the
normalised range [0, 1] required by UIView.alpha and
View#setAlpha. Authors
_MAY_ encode opacity as a JSON number or as a string containing CSS
calculations such as `calc()`, `min()`, or `clamp()` provided the
expression evaluates to an
`<alpha-value>`. Consumers encountering syntactically invalid expressions
_MUST_ treat the token as invalid. Values that exceed a platform's
accepted range _SHOULD_ be clamped per the referenced specification
rather than rejected outright.

```json
{
  "$type": "opacity",
  "$value": {
    "opacityType": "css.opacity",
    "value": "calc(0.8 * var(--dt-layer-alpha))"
  }
}
```

The table below maps opacity-related members to their authoritative specifications.

_Table: Normative references for opacity token members._

| Property                     | Normative references                                                         |
| :--------------------------- | :--------------------------------------------------------------------------- |
| `opacity.$value.opacityType` | CSS opacity, UIKit UIView.alpha, CALayer.opacity, android.view.View#setAlpha |
| `opacity.$value.value`       | `<alpha-value>`, UIKit UIView.alpha, android.view.View#setAlpha              |

> Example token documents demonstrating these patterns are available in
> [opacity.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/opacity.tokens.json).

### `cursor` tokens {#cursor}

For the `cursor` type the `$value` object
_MUST_ include a string `cursorType` member and a
`value` member. The `cursorType` _MUST_ be a
dot-separated identifier whose leading segment names the platform (`css`,
`ios`, or `android`) and whose suffix mirrors the pointer API
defined by that platform- for example `css.cursor` from
CSS Basic User Interface,
`ios.uipointerstyle` from
UIKit UIPointerStyle, or
`android.pointer-icon` from
android.view.PointerIcon.

When `cursorType` begins with `css` the `value` member
_MUST_ be a string conforming to the
`<cursor>`
production so that URLs, fallbacks, and keywords continue to track the grammar published
by CSS. Native cursor implementations may require structured metadata- such as a beam
length or hotspot coordinates. In those cases `value`
_MAY_ be an object whose members map directly to the parameters
described by UIPointerStyle,
UIPointerShape, or
PointerIcon.

Optional `parameters` objects _MAY_ hold reusable
inputs- such as DTIF `dimension` tokens supplying a beam's preferred length or
hotspot coordinates- and _MUST_ reference the same platform
semantics described by UIPointerShape,
UIPointerInteraction, and
View#setPointerIcon.

```json
{
  "$type": "cursor",
  "$value": {
    "cursorType": "css.cursor",
    "value": "pointer, url('/cursors/link.svg') 8 0"
  }
}
```

The table below maps cursor-related members to their normative references.

_Table: Normative references for cursor token members._

| Property                   | Normative references                                       |
| :------------------------- | :--------------------------------------------------------- |
| `cursor.$value.cursorType` | CSS cursor, UIKit UIPointerStyle, android.view.PointerIcon |
| `cursor.$value.value`      | `<cursor>`, UIPointerStyle, UIPointerShape, PointerIcon    |
| `cursor.$value.parameters` | UIPointerShape, UIPointerInteraction, View#setPointerIcon  |

> Example token documents demonstrating these patterns are available in
> [cursor.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/cursor.tokens.json).

### `z-index` tokens {#z-index}

`z-index` tokens express stacking order. Their `$value` object
_MUST_ include a string `zIndexType` and numeric
`value`. The `zIndexType` _MUST_ be a
platform-qualified identifier whose suffix names the stacking primitive defined by the
referenced platform specification. Producers targeting CSS
_MUST_ reuse identifiers aligned with the
`z-index` property, such as
`css.z-index`. Native producers _MUST_ map identifiers
to documented APIs like CALayer.zPosition,
View#setZ, or
View#setTranslationZ so the namespace makes
platform scope explicit.

The `value` member _MUST_ conform to the numeric
expectations of the referenced platform. When `zIndexType` begins with
`css.` the value _MUST_ be an integer satisfying the
`<integer>` production used
by the `z-index` property.
iOS `zPosition` values and Android Z APIs accept floating-point inputs;
tokens targeting those platforms _MAY_ provide fractional
numbers, but consumers _MUST_ clamp or round them when exporting
to CSS so the resulting values continue to satisfy the CSS grammar.

Canonical
`zIndexType`
identifiers

| Identifier                  | Platform scope                 | Normative reference  |
| --------------------------- | ------------------------------ | -------------------- |
| `css.z-index`               | CSS stacking contexts          | `z-index`            |
| `ios.calayer.z-position`    | iOS Core Animation layers      | CALayer.zPosition    |
| `android.view.z`            | Android absolute Z position    | View#setZ            |
| `android.view.translationz` | Android relative Z translation | View#setTranslationZ |

Authoritative references for
`z-index`
members

| Member              | Normative references                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `$value.zIndexType` | `z-index`, CALayer.zPosition, View#setZ, View#setTranslationZ              |
| `$value.value`      | `<integer>`, `z-index`, CALayer.zPosition, View#setZ, View#setTranslationZ |

> Example token documents demonstrating these patterns are available in
> [z-index.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/z-index.tokens.json).

## Composite tokens {#composite-tokens}

`$value` _MAY_ contain nested objects and arrays to form composite tokens. The following sections describe each composite token type.

### `border` tokens {#border-tokens}

`border` tokens describe stroke and outline attributes. Their
`$value` object _MUST_ include a string
`borderType`, a `width` dimension, a `style` string,
and a `color`. Producers _MAY_ include an optional
`radius` member whose shape follows the
`border-radius`
grammar.

The `borderType` string identifies the rendering context and
_MUST_ match the terminology used by the target platform.
Producers _SHOULD_ use dot-separated identifiers such as
`css.border`, `css.border-top`, `css.outline`,
`ios.layer`, or `android.drawable.stroke`. These map
respectively to the
`border` shorthand and
longhands defined in
CSS Backgrounds & Borders, the
`outline` property in
CSS Basic User Interface, the
CALayer border APIs, and Android
GradientDrawable#setStroke.

| Member       | CSS grammar                                                | iOS mapping                                                                    | Android mapping                                                                               |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `borderType` | `border-*` shorthands and longhands, `outline`.            | CALayer border configuration (`borderWidth`, `borderColor`).                   | GradientDrawable#setStroke and related shape drawables.                                       |
| `width`      | `<line-width>` grammar.                                    | CALayer.borderWidth expressed in points.                                       | Width parameter of GradientDrawable#setStroke in pixels or density-independent units.         |
| `style`      | `<line-style>` keywords.                                   | Stroke styling via CAShapeLayer.lineDashPattern and `lineCap`/`lineJoin`.      | Dash patterns created with DashPathEffect and applied to GradientDrawable or `Paint` strokes. |
| `color`      | `border-color` using `<color>` values.                     | CALayer.borderColor (`CGColor`).                                               | Colour argument of GradientDrawable#setStroke.                                                |
| `radius`     | `border-radius` shorthand and `border-*-radius` longhands. | CALayer.cornerRadius and UIBezierPath rounded-rect paths for per-corner radii. | GradientDrawable#setCornerRadius and `setCornerRadii` arrays.                                 |

The `width` member _MUST_ use values that conform to
the
`<line-width>`
grammar. When expressed in `pt`, `dp`, or `sp`,
consumers _MUST_ apply the unit conversions defined in
Apple's layout guidance and
Android's pixel density guidance before drawing.

The `style` value _MUST_ match the
`<line-style>`
production. Native renderers _MUST_ map keywords such as
`solid`, `dashed`, `dotted`, `double`, and
`groove` to the closest platform stroke capabilities- for example by
configuring CAShapeLayer dash patterns or
DashPathEffect. When a style cannot be
realised exactly, implementations _MUST_ fall back to
`solid` and _SHOULD_ surface a diagnostic.

The `color` member _MUST_ be a DTIF
`color`
token conforming to the
`<color>` production.
Consumers _MUST_ convert it to `CGColor` or packed
Android colour integers before applying the stroke.

When provided, `radius` _MUST_ follow the
`border-radius`
semantics. A standalone dimension applies uniformly to all corners. When expressed as
an object, members _MUST_ be named `topLeft`,
`topRight`, `bottomRight`, `bottomLeft`,
`topStart`, `topEnd`, `bottomStart`, or
`bottomEnd`. Each entry _MUST_ provide one or two
`<length-percentage>`
measurements to describe horizontal and optional vertical radii. Percentages
_MUST_ resolve against the box dimensions before assigning
CALayer.cornerRadius,
UIBezierPath control points, or
GradientDrawable corner arrays. When the
vertical radius is omitted, consumers _MUST_ reuse the
horizontal value.

> Example token documents demonstrating these mappings are available in
> [border.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/border.tokens.json).

### `shadow` tokens {#shadow-tokens}

`shadow` tokens describe blurred occlusion or glow effects. Their
`$value` object _MUST_ include a string
`shadowType`, length-valued `offsetX`, `offsetY`, and
`blur` members, and a `color`. Producers
_MAY_ include an optional `spread` length matching
the final argument of the
`<shadow>` grammar.

The `shadowType` string identifies the rendering context and
_MUST_ match the terminology defined by the relevant platform
specification. Producers _SHOULD_ use dot-separated identifiers
such as `css.box-shadow`, `css.text-shadow`,
`css.filter.drop-shadow`, `ios.layer`, `ios.text`, or
`android.view.elevation`. These map respectively to the
`box-shadow` property, the
`text-shadow`
property, the
`drop-shadow()`
filter function, CALayer and
NSShadow APIs, and Android
View#setElevation or
Paint#setShadowLayer.

| Member               | CSS grammar                                                                                                              | iOS mapping                                                                                | Android mapping                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `shadowType`         | Context keywords from the `<shadow>` grammar, including the optional `inset` modifier and `drop-shadow()` function name. | Chooses between outer shadows provided by CALayer and text shadows provided by NSShadow.   | Selects View#setElevation based outlines or Paint#setShadowLayer for text and vector content.                                |
| `offsetX`, `offsetY` | The first two `<length>` components of a `<shadow>`.                                                                     | Map to the horizontal and vertical components of CALayer.shadowOffset expressed in points. | Supply the `dx` and `dy` parameters for Paint#setShadowLayer or inform the outline offset for View elevations.               |
| `blur`               | The third `<length>` in the `<shadow>` production describing blur radius.                                                | Sets CALayer.shadowRadius measured in points.                                              | Provides the `radius` argument to Paint#setShadowLayer or derives the umbra extent for View elevation rendering.             |
| `spread`             | Optional final `<length>` in `<shadow>`.                                                                                 | Consumers _MUST_ express spread by adjusting CALayer.shadowPath or related masks.          | Implemented via outline manipulation using ViewOutlineProvider or vector path inflation before calling Paint#setShadowLayer. |
| `color`              | `<color>` values inside `<shadow>`.                                                                                      | Converted to `CGColor` instances applied to CALayer.shadowColor or NSShadow.shadowColor.   | Packed into ARGB integers for Paint#setShadowLayer or elevation ambient/spot colours.                                        |

Offsets, blur radii, and spreads _MUST_ use values conforming
to the `<length>` production or
platform-native units such as iOS points defined in
Layout - Foundations - Human Interface Guidelines and
Android density-independent pixels defined in
Support different pixel densities.

> Example token documents demonstrating these patterns are available in
> [shadows.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/shadows.tokens.json).

### `gradient` tokens {#gradient-tokens}

`gradient` tokens describe multi-stop colour transitions. Their
`$value` object _MUST_ include a
`gradientType` string naming a gradient function defined in
CSS Images Module Level 4. Producers
targeting CSS map the identifier to
`linear-gradient()`,
`radial-gradient()`, or
`conic-gradient()`. Native renderers _MUST_ map the identifier to
CAGradientLayer.type on iOS and to the
corresponding Android shader class such as
LinearGradient,
RadialGradient, or
SweepGradient.

Additional members _MUST_ conform to the grammars and platform
APIs listed below to remain compatible across CSS, iOS, and Android implementations.

Gradient member references

| Member             | CSS grammar                                                                   | iOS mapping                                                                                                  | Android mapping                                                                                   |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `gradientType`     | Function name from `<gradient>` definitions.                                  | CAGradientLayer.type (`axial`, `radial`, or `conic`).                                                        | Constructors of LinearGradient, RadialGradient, or SweepGradient.                                 |
| `angle`            | Linear gradient line syntax accepting `<angle>` or `<side-or-corner>` tokens. | Converted to CAGradientLayer.startPoint and `endPoint` unit coordinates.                                     | Mapped to start and end coordinates supplied to LinearGradient or sweep angles for SweepGradient. |
| `center`           | `<position>` values for radial and conic gradients.                           | Uses unit-square coordinates for CAGradientLayer.startPoint / `endPoint` when `type == .radial` or `.conic`. | Populates the `cx`/`cy` arguments of RadialGradient or center parameters of SweepGradient.        |
| `shape`            | `<rg-ending-shape>` keywords for radial gradients.                            | Selects circle or ellipse semantics for CAGradientLayer radial gradients.                                    | Chooses between circular and elliptical radii when instantiating RadialGradient.                  |
| `stops[].position` | `<color-stop-length>` from the `<color-stop-list>` grammar.                   | Normalised offsets mapped to `locations` on CAGradientLayer.                                                 | Stop offsets supplied to shader position arrays for Android gradients.                            |
| `stops[].hint`     | Optional `<color-hint>` values.                                               | Drives midpoint interpolation when converting to CAGradientLayer animation keyframes.                        | Translates to intermediate offsets for Android shader stop arrays.                                |
| `stops[].color`    | `<color>` values.                                                             | Converted to `CGColor` instances on CAGradientLayer.                                                         | Packed into the colour arrays consumed by Android gradient shaders.                               |

When authors provide `angle`, `center`, `shape`,
`stops[].position`, or `stops[].hint` as strings they
_MUST_ conform to the CSS grammars identified above: the
linear-gradient line syntax,
`<position>`,
`<rg-ending-shape>`,
`<color-stop-length>`, and
`<color-hint>`
productions. Numeric `angle` values _MUST_ be
expressed in degrees before conversion to the unit-square coordinates used by
CAGradientLayer and the angle parameters passed
to SweepGradient. Numeric
`position`, `hint`, and `center` members
_MUST_ be normalised fractions between `0` and
`1` so they can be assigned directly to
CAGradientLayer.locations and the offset arrays
expected by LinearGradient and
RadialGradient.

Stop offsets _MUST_ respect the ordering rules of the
`<color-stop-list>`
grammar; when serialised as normalised numbers they _MUST_
increase monotonically between 0 and 1 to align with
CAGradientLayer.locations and the ordered stop
arrays used by Android shaders. Implementations _MAY_ supply
repeated positions to express hard colour transitions as permitted by CSS.

> Example token documents demonstrating these patterns are available in
> [gradients.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/gradients.tokens.json).

### `filter` tokens {#filter-tokens}

`filter` tokens describe ordered image-processing pipelines. Their
`$value` object _MUST_ include a string
`filterType` whose leading segment names the target platform context and
whose remaining segments identify the rendering surface. Producers
_MUST_ use identifiers such as `css.filter`,
`ios.cifilter`, or `android.render-effect` so consumers defer to
the `filter` property,
Core Image pipelines, or
RenderEffect APIs respectively.

An ordered `operations` array _MUST_ be supplied.
Each entry _MUST_ be an object with a string `fn`
member naming a function defined by the
`<filter-function>`
grammar and an optional `parameters` array. When the identifier matches a
CSS function, consumers _MUST_ interpret the parameters using
the grammar defined for that function- for example
`blur()` requires a
`<length>` and
`brightness()`
accepts a number. Native renderers _MUST_ map the function name
to the corresponding Core Image filter such as
CIGaussianBlur or
CIColorControls, or to
RenderEffect.createBlurEffect and
RenderEffect.createColorFilterEffect
on Android.

Parameters _MUST_ follow the grammar of the referenced function
and _MAY_ include token references using `$ref`. For
`drop-shadow` operations producers
_SHOULD_ reference a `shadow` token so the provided
blur, offset, and colour values align with the
`<shadow>`
production, CIDropShadow, and
RenderEffect.createDropShadowEffect.

Filter member references

| Member                    | CSS grammar                                                                                                                | iOS mapping                                                                                           | Android mapping                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `filterType`              | Context identifiers for the `filter` property.                                                                             | Distinguishes pipelines built from CIFilter subclasses.                                               | Selects chains of RenderEffect instances.                                                                                                  |
| `operations[].fn`         | Function names from the `<filter-function-list>` grammar.                                                                  | Maps to CIFilter class names such as CIGaussianBlur and CIColorControls.                              | Maps to RenderEffect factory methods such as createBlurEffect and createColorFilterEffect.                                                 |
| `operations[].parameters` | Arguments conforming to the grammar of the referenced function (for example `blur()`, `brightness()`, or `drop-shadow()`). | Supplies radius, brightness, and shadow inputs for CIGaussianBlur, CIColorControls, and CIDropShadow. | Provides the radius, colour matrix, and shadow arguments consumed by createBlurEffect, ColorMatrixColorFilter, and createDropShadowEffect. |

> Example token documents demonstrating these patterns are available in
> [filter.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/filter.tokens.json).

### `motion` tokens {#motion-tokens}

`motion` tokens encode transform instructions. Their
`$value.motionType` string _MUST_ be a platform-
qualified identifier whose suffix names a transform function defined by the target
platform. Producers targeting CSS _MUST_ reuse the function
identifiers from
CSS Transforms Module Level 2
(for example `css.translate3d`, `css.rotate`, or
`css.scale`). Native implementations _MUST_ align
identifiers with the documented Core Graphics/Core Animation APIs on iOS and the
property animator APIs on Android so that
`ios.cgaffinetransform.translate` maps to
CGAffineTransform helpers,
`ios.catransform3d.rotate` maps to
CATransform3D, and
`android.viewpropertyanimator.translationx` maps to
ViewPropertyAnimator.

Implementers _MUST_ select identifiers whose final segment
matches the transform primitive described by the cited specification. The following
table illustrates canonical mappings.

Motion transform references

| Category                                                                                                                       | CSS                                                                        | iOS                                                                                | Android                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Translation `css.translate`, `css.translate3d`, `ios.cgaffinetransform.translate`, `android.viewpropertyanimator.translationx` | `translate()` and `translate3d()` from the `<transform-function>` grammar. | CGAffineTransformTranslate and CATransform3DTranslate distance parameters.         | Delta setters on ViewPropertyAnimator.translationX/Y/Z.                               |
| Rotation `css.rotate`, `css.rotate3d`, `ios.catransform3d.rotate`, `android.viewpropertyanimator.rotation`                     | `rotate()`, `rotate3d()`, and related `<transform-function>` entries.      | Angle and axis arguments passed to CGAffineTransformRotate or CATransform3DRotate. | Rotation helpers such as ViewPropertyAnimator.rotation, `rotationX`, and `rotationY`. |
| Scale `css.scale`, `css.scale3d`, `ios.catransform3d.scale`, `android.viewpropertyanimator.scalex`                             | `scale()`, `scale3d()`, and related `<transform-function>` productions.    | Multipliers supplied to CGAffineTransformScale or CATransform3DScale.              | Factor setters on ViewPropertyAnimator.scaleX/scaleY.                                 |
| Path `css.offset-path`, `ios.cakeyframeanimation.path`, `android.objectanimator.path`                                          | Geometry supplied to `offset-path` via the `path()` function.              | CAKeyframeAnimation.path and UIBezierPath instances.                               | ObjectAnimator.ofFloat paths and android.graphics.Path geometries.                    |

Members of the `parameters` object _MUST_ conform to
the grammar for the referenced transform:

- Translation parameters `x`, `y`, and `z`
  _MUST_ be dimensions or `FunctionValue` nodes that
  resolve to
  `<length-percentage>`
  values. These map directly to the distance arguments accepted by
  CGAffineTransformTranslate,
  CATransform3DTranslate, and
  `ViewPropertyAnimator.translation*`
  setters.
- Rotation parameters _MUST_ include an `angle`
  conforming to
  `<angle>`. When an `axis` is present it _MUST_ be an
  object providing numeric `x`, `y`, and
  `z` components describing the rotation vector used by
  `rotate3d()` and the
  `CATransform3DRotate` axis arguments; at least one component
  _MUST_ be non-zero. The optional `origin` object
  _MUST_ express fractions between 0 and 1 that correspond to
  percentages in
  `transform-origin`
  and align with CALayer.anchorPoint plus
  View#setPivotX/Y.
- Scale parameters `x`, `y`, `z`, and
  `uniform` _MUST_ be non-negative numbers, matching the
  `scale()` and
  `scale3d()` argument
  grammar and the multiplicative factors used by
  CGAffineTransformScale,
  CATransform3DScale, and
  `ViewPropertyAnimator.scale*`; negative multipliers remain
  invalid.
- Path parameters _MUST_ supply a `points` array
  with at least two entries. Each point _MUST_ declare a
  `time` between 0 and 1, progressing monotonically from the first entry to
  the last so they can be mapped to
  CAKeyframeAnimation.keyTimes and the
  normalised fractions used by
  ObjectAnimator. Point
  `position` members _MUST_ resolve to
  `<length-percentage>`
  values that describe the coordinates sampled from the
  `path()`
  representation, UIBezierPath, or
  android.graphics.Path. Optional
  `easing` members _MUST_ reference an
  `easing` token.

> Example token documents demonstrating these mappings are available in
> [motion.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/motion.tokens.json).

### `elevation` tokens {#elevation-tokens}

`elevation` tokens describe single-axis drop shadows used to express
surface layering. Their `$value` object
_MUST_ include a string `elevationType` member
together with `offset`, `blur`, and `color` members.
Producers _MUST_ choose `elevationType` values that
identify the rendering context defined by
`<shadow>`
functions,
`drop-shadow()`, CALayer shadow properties, or Android
Paint#setShadowLayer and
View#setElevation APIs so consumers defer to
the authoritative platform specifications.

Identifiers _SHOULD_ follow a dot-separated scheme such as
`css.box-shadow.surface`, `ios.layer.overlay`, or
`android.paint.shadow-layer.raised` where the suffix encodes the design
system role (for example `surface` or `overlay`). Consumers
encountering an `elevationType` whose leading segments do not name a
supported platform context _MUST_ treat the token as
unsupported so that platform grammars remain the source of truth.

Authoritative references for
`elevation`
members

| Member          | CSS grammar                                                                                                                                   | iOS mapping                                                              | Android mapping                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `elevationType` | Context identifiers based on `<shadow>` functions and the `drop-shadow()` filter.                                                             | Distinguishes CALayer and NSShadow shadow properties.                    | Selects between Paint#setShadowLayer and View elevation APIs.                                                                                                |
| `offset`        | Second `<length>` in the `<shadow>` production describing the vertical displacement; horizontal offset _MUST_ be zero for elevation contexts. | Maps to the `height` component of CALayer.shadowOffset with `width = 0`. | Provides the `dy` argument to Paint#setShadowLayer and, when targeting View#setElevation, the converted elevation distance.                                  |
| `blur`          | Third `<length>` in the `<shadow>` grammar describing blur radius.                                                                            | Sets CALayer.shadowRadius in points.                                     | Supplies the `radius` argument to Paint#setShadowLayer; when using View#setElevation, it documents the expected ambient blur derived by the system renderer. |
| `color`         | `<color>` values inside `<shadow>`.                                                                                                           | Converted to `CGColor` for CALayer.shadowColor or NSShadow.shadowColor.  | Packed into ARGB integers for Paint#setShadowLayer and to inform elevation overlay colours.                                                                  |

Elevation offsets and blur radii _MUST_ use values conforming
to the `<length>` production or
platform-native units such as iOS points defined in
Layout - Foundations - Human Interface Guidelines and
Android density-independent pixels defined in
Support different pixel densities. When targeting
View#setElevation, consumers
_MUST_ convert the supplied offset to device pixels before
applying the API so that shadows follow the platform's depth model.

> Example token documents demonstrating these mappings are available in
> [elevation.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/elevation.tokens.json).

## Component tokens {#component-tokens}

Component tokens group related primitives for a UI component. Their
`$value` object _MUST_ contain a
`$slots` member that maps slot names to tokens defined elsewhere in this
specification. The `$slots` object _MUST_ include at
least one entry and slot names _MUST NOT_ begin with
`$`. Each slot _MUST_ be a valid non-component token
to keep the structure composed of primitives. Slots
_MAY_ reference existing tokens via `$ref` to promote
reuse. When slots use `$ref`, the reference
_MUST_ resolve to a token whose `$type` is not
`component` so slots remain primitive. A button
_MAY_ declare slots such as `background`,
`text`, and `border`.

See the [component token example](../examples/#component-token-example) for a
non-normative illustration of slot composition.

## Temporal tokens {#temporal-primitives}

Temporal tokens capture animation timing decisions that must remain consistent across
CSS, iOS, and Android renderers. Rather than duplicating keyword lists or units, DTIF
defers to the timing grammars defined by
`<time>` and
`<single-easing-function>`. Native platforms expose equivalent concepts through
Core Animation,
CAMediaTimingFunction,
UISpringTimingParameters,
ValueAnimator, and
TimeInterpolator.

### `duration` tokens {#duration}

Duration tokens describe the length of transitions and animations. The
`$value` object _MUST_ include string
`durationType`, numeric `value`, and string
`unit` members. `durationType` _MUST_ be
a dot-separated identifier whose leading segment is `css`,
`ios`, or `android` to name the platform primitive that defines
the grammar. Consumers encountering an identifier whose leading segment does not name
a supported platform context _MUST_ treat the token as
unsupported so authoritative specifications remain the source of truth.

Authoritative references for duration contexts

| Identifier                                                                           | CSS grammar                                                         | iOS mapping                                                                              | Android mapping                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `css.transition-duration`, `css.animation-duration`                                  | `<time>` as used by `transition-duration` and `animation-duration`. | Converted to seconds for CAAnimation.duration and UIViewPropertyAnimator.duration.       | Converted to milliseconds for ValueAnimator.setDuration and ObjectAnimator.setDuration.   |
| `ios.caanimation.duration`                                                           | `<time>` grammar shared with CSS for cross-platform tokens.         | CAAnimation.duration expressed in seconds.                                               | Converted to milliseconds for ValueAnimator.setDuration when reused by Android renderers. |
| `android.value-animator.duration`                                                    | `<time>` grammar shared with CSS for cross-platform tokens.         | Converted to seconds for CAAnimation.duration when interoperating with UIKit animations. | ValueAnimator.setDuration measured in milliseconds.                                       |
| `ios.cadisplaylink.frame-count`, `android.choreographer.frame-count`                 | Frame counts independent of CSS grammars.                           | Sampled against CADisplayLink refresh cadence.                                           | Sampled against Choreographer frame callbacks.                                            |
| `css.timeline.progress`, `ios.uianimation.fraction`, `android.animator-set.fraction` | `<percentage>` within keyframe selectors.                           | Mapped to UIViewAnimating.fractionComplete.                                              | Mapped to ValueAnimator.setCurrentFraction and related animator APIs.                     |

When `durationType` identifies a duration property ending in
`.duration`, the `value` _MUST_ be a
non-negative number and, together with `unit`,
_MUST_ serialise a
`<time>` as defined by
CSS Values and Units. Producers
_MUST_ emit the unit tokens defined by that grammar (for
example `s` or `ms`) and consumers
_MUST_ convert between the units required by
`transition-duration`,
`animation-duration`, CAAnimation.duration, and
ValueAnimator.setDuration.

When `durationType` identifies `.frame-count`, the
`value` _MUST_ be a non-negative integer counting
display refresh steps. Producers _MUST_ serialise
`unit` using the identifier required by the referenced timing API (for
CADisplayLink and
Choreographer this is `"frames"`),
and consumers _MUST_ resolve the count using the refresh
cadence published by those specifications.

When `durationType` identifies `.fraction` or
`.progress`, the `value` and `unit`
_MUST_ encode a
`<percentage>` per
CSS Values and Units. Native consumers
_MUST_ normalise the resulting percentage to the
`[0, 1]` range required by
UIViewAnimating.fractionComplete and
ValueAnimator.setCurrentFraction.

```json
{
  "$type": "duration",
  "$value": { "durationType": "css.transition-duration", "value": 0.2, "unit": "s" }
}
```

### `easing` tokens {#easing}

Easing tokens identify reusable timing curves. The `easingFunction`
_MUST_ be a string naming a
`<single-easing-function>`
from CSS Easing Functions or a documented native
analogue such as CAMediaTimingFunction,
UISpringTimingParameters,
TimeInterpolator, or
SpringForce. The optional
`parameters` array _MUST_ supply arguments matching
the referenced grammar when the function expects them, and producers
_MAY_ omit `parameters` when the referenced grammar
takes no arguments. Consumers _MUST_ treat an omitted
`parameters` member as an empty list.

- Functions serialised with the `cubic-bezier` identifier
  _MUST_ provide the four numeric arguments defined by the
  `cubic-bezier()`
  production, and the first and third arguments
  _MUST_ satisfy the domain constraints described in that
  specification.
- Functions serialised with the `steps` identifier
  _MUST_ follow the
  `steps()`
  grammar, including the optional
  `<step-position>`
  keywords defined by CSS.
- Keywords defined by the
  `<single-easing-function>`
  production (for example `linear`, `ease`, or
  `step-end`) _MUST NOT_ include parameters.
- Spring curves defined by native APIs _MUST_ provide the
  parameters documented by
  UISpringTimingParameters and
  SpringForce; the magnitude arguments
  _MUST_ be positive numbers and initial velocity
  _MAY_ be any real number.

```json
{
  "$type": "easing",
  "$value": { "easingFunction": "cubic-bezier", "parameters": [0.4, 0, 0.2, 1] }
}
```

Authoritative references for temporal tokens

| Temporal member                                                                                                        | Normative references                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `duration.$value` (`durationType: css.transition-duration`, `css.animation-duration`)                                  | `<time>`, `transition-duration`, `animation-duration`                                                        |
| `duration.$value` (`durationType: ios.caanimation.duration`)                                                           | CAAnimation.duration, UIViewPropertyAnimator.duration                                                        |
| `duration.$value` (`durationType: android.value-animator.duration`)                                                    | ValueAnimator.setDuration, ObjectAnimator.setDuration                                                        |
| `duration.$value` (`durationType: ios.cadisplaylink.frame-count`, `android.choreographer.frame-count`)                 | CADisplayLink, Choreographer                                                                                 |
| `duration.$value` (`durationType: css.timeline.progress`, `ios.uianimation.fraction`, `android.animator-set.fraction`) | `<percentage>` within keyframe selectors, UIViewAnimating.fractionComplete, ValueAnimator.setCurrentFraction |
| `easing.$value.easingFunction`                                                                                         | `<single-easing-function>`, CAMediaTimingFunction, TimeInterpolator, PathInterpolator                        |
| `easing.$value.parameters`                                                                                             | `cubic-bezier()`, `steps()`, UISpringTimingParameters, SpringForce                                           |

> Example token documents demonstrating these patterns are available in
> [animation.tokens.json](https://github.com/bylapidist/dtif/blob/main/examples/animation.tokens.json).
