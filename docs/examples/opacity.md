---
title: Opacity tokens
description: Overlay and scrim opacities with aliases and expression values.
---

# Opacity tokens {#opacity}

This example covers overlay and scrim opacities for CSS, iOS, and Android while demonstrating aliasing and expression-based values. It shows percentage, numeric, and referenced entries living side by side.

See [`opacity.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/opacity.tokens.json) for the complete document.

## Sample tokens {#opacity-sample}

```json dtif
{
  "$version": "1.0.0",
  "opacity": {
    "layer": {
      "$type": "opacity",
      "$value": {
        "opacityType": "ios.layer.opacity",
        "value": 0.72
      }
    },
    "overlay": {
      "$type": "opacity",
      "$value": {
        "opacityType": "css.opacity",
        "value": "calc(0.8 * var(--dt-layer-alpha))"
      }
    },
    "overlay-alias": {
      "$type": "opacity",
      "$ref": "#/opacity/overlay"
    },
    "scrim": {
      "$type": "opacity",
      "$value": {
        "opacityType": "android.view.alpha",
        "value": "72%"
      }
    }
  }
}
```
