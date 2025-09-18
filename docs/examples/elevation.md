---
title: Elevation tokens
description: Surface elevations for CSS, UIKit, and Android shadow models.
---

# Elevation tokens {#elevation}

This example defines surface elevations that share blur radii, offsets, and colors across Android, CSS, and iOS. It keeps the platform-specific units in sync while varying the elevation type.

See [`elevation.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/elevation.tokens.json) for the complete document.

## Sample tokens {#elevation-sample}

```json
{
  "elevation": {
    "surface-android": {
      "$type": "elevation",
      "$value": {
        "elevationType": "android.paint.shadow-layer.surface",
        "blur": {
          "dimensionType": "length",
          "value": 24,
          "unit": "dp"
        },
        "color": {
          "colorSpace": "srgb",
          "components": [0.059, 0.09, 0.165, 0.18]
        },
        "offset": {
          "dimensionType": "length",
          "value": 8,
          "unit": "dp"
        }
      }
    },
    "surface-css": {
      "$type": "elevation",
      "$value": {
        "elevationType": "css.box-shadow.surface",
        "blur": {
          "dimensionType": "length",
          "value": 24,
          "unit": "px"
        },
        "color": {
          "colorSpace": "srgb",
          "components": [0.059, 0.09, 0.165, 0.18]
        },
        "offset": {
          "dimensionType": "length",
          "value": 8,
          "unit": "px"
        }
      }
    },
    "surface-ios": {
      "$type": "elevation",
      "$value": {
        "elevationType": "ios.layer.surface",
        "blur": {
          "dimensionType": "length",
          "value": 24,
          "unit": "pt"
        },
        "color": {
          "colorSpace": "srgb",
          "components": [0.059, 0.09, 0.165, 0.18]
        },
        "offset": {
          "dimensionType": "length",
          "value": 8,
          "unit": "pt"
        }
      }
    }
  }
}
```
