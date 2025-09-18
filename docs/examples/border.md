---
title: Border tokens
description: Cross-platform border strokes with per-corner radii and style metadata.
---

# Border tokens {#border}

This example maps card and focus borders onto CSS outlines, UIKit layers, and Android drawables. It demonstrates dotted, dashed, and solid styles while keeping per-corner radii aligned across platforms.

See [`border.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/border.tokens.json) for the complete document.

## Sample tokens {#border-sample}

```json
{
  "border": {
    "cardOutlineAndroid": {
      "$type": "border",
      "$value": {
        "borderType": "android.drawable.stroke",
        "color": {
          "colorSpace": "srgb",
          "components": [0.109, 0.231, 0.4, 1]
        },
        "radius": {
          "bottomEnd": {
            "x": {
              "dimensionType": "length",
              "value": 18,
              "unit": "dp"
            }
          },
          "topStart": {
            "x": {
              "dimensionType": "length",
              "value": 14,
              "unit": "dp"
            },
            "y": {
              "dimensionType": "length",
              "value": 10,
              "unit": "dp"
            }
          }
        },
        "style": "dotted",
        "width": {
          "dimensionType": "length",
          "value": 1,
          "unit": "dp"
        }
      }
    },
    "focusRing": {
      "$type": "border",
      "$value": {
        "borderType": "css.border",
        "color": {
          "colorSpace": "srgb",
          "components": [0.231, 0.51, 0.964, 1]
        },
        "radius": {
          "dimensionType": "length",
          "value": 16,
          "unit": "pt"
        },
        "style": "solid",
        "width": {
          "dimensionType": "length",
          "value": 2,
          "unit": "pt"
        }
      }
    }
  }
}
```
