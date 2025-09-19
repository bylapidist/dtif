# Example Tokens

These examples accompany the DTIF technical report.

## Colour spaces

`color-spaces.tokens.json` supplies tokens that use CSS Color Module Level 4 colour space identifiers
such as `display-p3` and `oklch`. The samples mirror Core Graphics `CGColorSpace.displayP3` and
Android `ColorSpace.Named.DISPLAY_P3`, making it straightforward to verify conversions against CSS,
iOS, and Android rendering APIs.

## Gradient transitions

`gradients.tokens.json` captures linear and radial gradients expressed with CSS
`linear-gradient()`/`radial-gradient()` syntax, iOS `CAGradientLayer` unit-square
coordinates, and Android shader stop arrays. The fixture exercises CSS
`<color-stop-list>` constructs such as double positions, `<color-hint>` midpoints,
and `<position>` keywords so implementers can confirm that the same token feeds
browser, UIKit, and Android graphics pipelines without duplicating keyword or
unit lists.

## Shadow contexts

`shadows.tokens.json` defines drop, inner, and text shadows that defer to the CSS
`<shadow>` grammar, UIKit `CALayer` and `NSShadow`, and Android `View` elevation
and `Paint#setShadowLayer`. The tokens mix `pt` and `dp` units so teams can test
conversion paths between CSS `<length>` values, iOS points, and Android density
metrics while exercising optional spread radii implemented via `shadowPath` and
`ViewOutlineProvider`.

## Border strokes

`border.tokens.json` demonstrates CSS `border` and `outline` shorthands alongside
UIKit `CALayer` borders and Android `GradientDrawable#setStroke`. The fixture
mixes `px`, `pt`, and `dp` widths, exercises `solid`, `dashed`, and `dotted`
styles, reuses dedicated `strokeStyle` tokens for dash patterns, and encodes
per-corner radii using the `border-radius` grammar so teams can verify
conversions to `CAShapeLayer.lineDashPattern` and `GradientDrawable#setCornerRadii`
without copying keyword lists.

## Elevation layers

`elevation.tokens.json` captures single-axis surface elevations keyed to CSS
`<shadow>` functions, UIKit `CALayer.shadowOffset`/`shadowRadius`, and Android
`Paint#setShadowLayer` as well as `View#setElevation`. The fixture keeps horizontal
offsets at zero while pairing CSS `px` values with native `pt` and `dp` units so
implementers can confirm that shared offsets, blur radii, and colours remain valid
across platforms without duplicating keyword lists.

## Filter pipelines

`filter.tokens.json` strings together blur, brightness, and drop-shadow steps
using the CSS `<filter-function-list>` grammar while mapping to Core Image
`CIFilter` pipelines and Android `RenderEffect` chains. The sample reuses
`shadow` tokens via `$ref` so the same blur radius, offsets, and colours satisfy
CSS `<shadow>`, `CIDropShadow`, and `RenderEffect.createDropShadowEffect`
without duplicating enumerations. Brightness adjustments demonstrate numeric
parameters on CSS and Core Image alongside a `ColorMatrixColorFilter` payload on
Android. Implementers can replay the fixture in browser styles, `CIFilter`
pipelines, and `RenderEffect.createChainEffect` calls to verify that ordered
operations and parameter lists remain portable across platforms.

## Opacity ramps

`opacity.tokens.json` provides overlay and scrim opacities keyed by `css.opacity`,
`ios.uiview.alpha`, and `android.view.alpha`. Each token encodes a CSS
`<alpha-value>` expression- mixing numbers, percentages, and `calc()`- so
implementers can confirm that the same JSON number or expression feeds CSS
`opacity`, UIKit `UIView.alpha`, `CALayer.opacity`, and Android `View#setAlpha`
without duplicating keyword or range checks. The fixture also includes an alias
that reuses a base token across platforms to mirror design system layering.

## Pointer interactions

`cursor.tokens.json` captures pointer affordances that defer to the CSS
`<cursor>` grammar, UIKit `UIPointerStyle`/`UIPointerInteraction`, and Android
`PointerIcon` APIs. The sample pairs a CSS string with URL fallbacks, an iOS
beam cursor whose preferred length is expressed as a `dimension` token in
points, and an Android pointer icon accompanied by hotspot coordinates in
`dp`. The fixture demonstrates how DTIF keeps cursor keywords, beam metadata,
and hotspot units aligned with their authoritative specifications without
replicating platform keyword lists.

## Stacking order

`z-index.tokens.json` demonstrates stacking contexts across CSS, iOS, and
Android. Tokens reuse the CSS `z-index` property grammar, Core Animation
`CALayer.zPosition`, and Android `View` Z APIs (`setZ`/`setTranslationZ`) without
duplicating keyword lists. The sample shows a modal dialog, an iOS layer raised
above a scrim, and an Android floating action button with `translationZ` so
implementers can validate that the same numeric payloads satisfy the referenced
platform specifications.

## Line-height ratios

The baseline distance between successive text lines is obtained by multiplying a unitless
`lineHeight` by the `fontSize`.

```text
fontSize: 16px
lineHeight: 1.2 -> baseline distance 19.2px
lineHeight: 1.5 -> baseline distance 24px
lineHeight: 2   -> baseline distance 32px
```

Ratios below `1` yield a baseline distance smaller than the font size. Such values remain valid
but some tools may flag them for accessibility or readability concerns.

`typography-line-height.tokens.json` expands on this by showing:

- A token with a ratio (`1.5`).
- Tokens with explicit units (`24px`, `1.4em`, `16sp`).
- A token that omits `lineHeight` to inherit from context.

These examples also include related properties such as `letterSpacing`,
`wordSpacing`, `color`, `textDecoration`, `textTransform`, and
`fontFeatures` to illustrate richer typography tokens.

Implementers should validate these fixtures on target platforms to ensure
unit conversions and `fontScale` behaviour match expectations. Including
ratio, absolute, and inherited `lineHeight` samples in cross-platform test
suites helps catch inconsistencies early.

## Typography layering

`typography-base.tokens.json` defines a minimal typography token. Additional properties in
`typography-layer.tokens.json` merge to produce the complete style shown in
`typography-complete.tokens.json`.

## Font face linkage

`font-face.tokens.json` pairs a downloadable `fontFace` token with a referencing typography token.
The example mixes `local()` and `url()` sources so implementers can validate CSS
`@font-face src` parsing alongside iOS `CTFontManagerRegisterFontsForURL` registration and Android
`Font.Builder` usage. Format and technology hints demonstrate how DTIF defers to the CSS
`format()`/`tech()` grammar without duplicating keyword lists, while `unicodeRange` and
`fontDisplay` show how optional descriptors flow through to native font descriptors. The typography
token keeps `fontFamily` synchronized via `$ref`, making it easy to confirm that schema coverage for
camel-cased `$type` values matches the prose specification and that reference resolution propagates
metadata from font faces into typography tokens.

## Font sources

`font.tokens.json` exercises the `font` token type across system, local, and web sources. The
fixture encodes CSS `<family-name>`, `<font-style-absolute>`, and `<font-weight-absolute>` grammar
while mapping to UIKit `UIFontDescriptor` traits and Android `Typeface.Builder` weight/slant APIs.
It includes an oblique `Brand Sans` example that demonstrates how a CSS angle translates to native
descriptor attributes plus keyword and numeric weights so implementers can verify that CSS, iOS,
and Android resolve the same family consistently.

## Font scaling

`font-scale.tokens.json` contains dimension tokens that demonstrate the
`fontScale` flag. The `sp` example with `fontScale: true` represents a value
that should scale with user text settings (for example Android's scaled
pixels). The `dp` example sets `fontScale: false` to remain fixed. Web
consumers can map scalable values to relative units such as `rem`, while iOS
consumers may apply `UIFontMetrics` when the flag is `true`.

## Unit examples

`typography-units.tokens.json` and `typography-line-height.tokens.json`
illustrate common units such as `px`, `em`, `%`, `sp`, and `dp`. Values using
`sp` typically set `fontScale: true` so they participate in user font scaling,
while `dp` and `px` values set `fontScale: false` to remain fixed. Relative
units like `em` or `%` adapt to their context and may also scale with user
preferences.

## Typography grammars

`typography-grammars.tokens.json` exercises keyword and shorthand values from
CSS Fonts, CSS Text, and CSS Text Decoration. The `cssGrammar` token demonstrates
`fontStyle: "oblique 14deg"`, `textDecoration: "underline dotted 0.12em"`, and
multi-keyword `textTransform` values so implementers can validate parsing
against browser engines. The `variableAxis` token combines a numeric
`fontWeight` (`575`) with platform units such as `sp` to show how DTIF defers to
variable font axes on Android (`Typeface.Builder#setWeight`) and iOS
(`UIFont.Weight`). Rendering the fixtures on the web, iOS, and Android verifies
that CSS grammars, points, and density-independent pixels resolve consistently.

## Animation timing

`animation.tokens.json` demonstrates duration and easing tokens that defer to CSS
`<time>` and `<single-easing-function>` productions while serialising to iOS and
Android animation APIs. The fixture includes:

- `css.transition-duration` and `android.value-animator.duration` entries that
  share the CSS `<time>` grammar while mapping to
  `CAAnimation.duration`/`UIViewPropertyAnimator.duration` and
  `ValueAnimator.setDuration`.
- Frame-based timings keyed by `ios.cadisplaylink.frame-count` so refresh
  cadence stays aligned with `CADisplayLink` and `Choreographer`.
- Timeline offsets expressed through `css.timeline.progress`, which native
  consumers convert to `UIViewAnimating.fractionComplete` and
  `ValueAnimator.setCurrentFraction`.
- Easing functions such as `cubic-bezier`, keyword shorthands like `ease`, and
  a platform spring curve whose parameters mirror `UISpringTimingParameters`
  and `SpringForce`.

Consumers can load the fixture to verify that CSS easing keywords resolve to
the expected cubic Bézier curves and that spring parameters interpolate
consistently between native runtimes.

## Motion transforms

`motion.tokens.json` captures cross-platform transforms without duplicating
platform-specific keyword lists. The sample tokens map:

- CSS identifiers such as `css.translate3d` and `css.rotate3d` to the
  `<transform-function>` grammar defined by CSS Transforms Module Level&nbsp;2.
- iOS values such as `ios.catransform3d.scale` and
  `ios.cakeyframeanimation.path` to `CATransform3D` helpers and
  `CAKeyframeAnimation.path` geometry expressed with `UIBezierPath`.
- Android identifiers such as `android.viewpropertyanimator.translationz` to
  `ViewPropertyAnimator` setters and path-based `ObjectAnimator` animations.

Each token mirrors the `$value.parameters` constraints described in the DTIF
specification: translation distances use `<length-percentage>` values, rotation
vectors provide numeric `x/y/z` components, scale factors stay positive, and
path timelines run from 0 to 1 with optional easing references. Implementers
can replay the JSON on CSS, UIKit/Core Animation, and Android runtime APIs to
confirm that shared identifiers and units resolve consistently without bespoke
validation logic.
