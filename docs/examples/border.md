---
title: Border tokens
description: Cross-platform border strokes with per-corner radii and style metadata.
---

# Border tokens {#border}

This example maps card and focus borders onto CSS outlines, UIKit layers, and Android drawables. It demonstrates dotted, dashed, and solid styles while keeping per-corner radii aligned across platforms, and reuses `strokeStyle` tokens to share dash metadata between borders.

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
    "cardOutlineIos": {
      "$type": "border",
      "$value": {
        "borderType": "ios.layer",
        "color": {
          "colorSpace": "srgb",
          "components": [0.141, 0.286, 0.486, 1]
        },
        "radius": {
          "bottomLeft": {
            "x": {
              "dimensionType": "length",
              "value": 20,
              "unit": "pt"
            }
          },
          "topLeft": {
            "x": {
              "dimensionType": "length",
              "value": 12,
              "unit": "pt"
            },
            "y": {
              "dimensionType": "length",
              "value": 8,
              "unit": "pt"
            }
          },
          "topRight": {
            "x": {
              "dimensionType": "length",
              "value": 20,
              "unit": "pt"
            }
          }
        },
        "style": "dashed",
        "strokeStyle": { "$ref": "#/strokeStyle/cardDashed" },
        "width": {
          "dimensionType": "length",
          "value": 1.5,
          "unit": "pt"
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
        "strokeStyle": {
          "lineCap": "round"
        },
        "width": {
          "dimensionType": "length",
          "value": 2,
          "unit": "pt"
        }
      }
    }
  },
  "strokeStyle": {
    "cardDashed": {
      "$type": "strokeStyle",
      "$value": {
        "dashArray": [6, 3],
        "lineCap": "round",
        "lineJoin": "round"
      }
    }
  }
}
```
