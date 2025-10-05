---
title: Shadow tokens
description: Shadow styles for CSS, Android, and iOS surface treatments.
---

# Shadow tokens {#shadows}

This example defines drop shadows tailored to CSS, Android, and iOS shadow models. It mixes point, pixel, and dp units while sharing colors and spreads.

See [`shadows.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/shadows.tokens.json) for the complete document.

## Sample tokens {#shadows-sample}

```json dtif
{
  "$version": "1.0.0",
  "shadow": {
    "card": {
      "$type": "shadow",
      "$value": {
        "shadowType": "css.box-shadow",
        "blur": {
          "dimensionType": "length",
          "value": 48,
          "unit": "pt"
        },
        "color": {
          "colorSpace": "srgb",
          "components": [0.059, 0.09, 0.165, 0.32]
        },
        "offsetX": {
          "dimensionType": "length",
          "value": 0,
          "unit": "pt"
        },
        "offsetY": {
          "dimensionType": "length",
          "value": 16,
          "unit": "pt"
        },
        "spread": {
          "dimensionType": "length",
          "value": -12,
          "unit": "pt"
        }
      }
    },
    "headline-android": {
      "$type": "shadow",
      "$value": {
        "shadowType": "android.paint.shadow-layer",
        "blur": {
          "dimensionType": "length",
          "value": 4,
          "unit": "dp"
        },
        "color": {
          "colorSpace": "srgb",
          "components": [0, 0, 0, 0.45]
        },
        "offsetX": {
          "dimensionType": "length",
          "value": 0,
          "unit": "dp"
        },
        "offsetY": {
          "dimensionType": "length",
          "value": 2,
          "unit": "dp"
        }
      }
    },
    "panel-ios": {
      "$type": "shadow",
      "$value": {
        "shadowType": "ios.layer",
        "blur": {
          "dimensionType": "length",
          "value": 32,
          "unit": "pt"
        },
        "color": {
          "colorSpace": "display-p3",
          "components": [0.1, 0.12, 0.18, 0.28]
        },
        "offsetX": {
          "dimensionType": "length",
          "value": 0,
          "unit": "pt"
        },
        "offsetY": {
          "dimensionType": "length",
          "value": 12,
          "unit": "pt"
        },
        "spread": {
          "dimensionType": "length",
          "value": -8,
          "unit": "pt"
        }
      }
    }
  }
}
```
