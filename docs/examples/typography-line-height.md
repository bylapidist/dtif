---
title: Typography line-height tokens
description: Line heights expressed as ratios, pixels, ems, and scaled points.
---

# Typography line-height tokens {#typography-line-height}

This example compares ratio-based line heights with explicit lengths such as pixels, ems, and scaled points. It also includes an inherited style to show how omissions fall back to context.

See [`typography-line-height.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/typography-line-height.tokens.json) for the complete document.

## Sample tokens {#typography-line-height-sample}

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "absolutePx": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Example",
        "textTransform": "uppercase",
        "fontFeatures": ["liga", "kern"],
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "letterSpacing": {
          "dimensionType": "length",
          "value": 1,
          "unit": "sp",
          "fontScale": true
        },
        "lineHeight": {
          "dimensionType": "length",
          "value": 24,
          "unit": "px"
        },
        "wordSpacing": {
          "dimensionType": "length",
          "value": 2,
          "unit": "dp",
          "fontScale": false
        }
      }
    },
    "ratio": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Example",
        "lineHeight": 1.5,
        "textDecoration": "underline",
        "color": {
          "colorSpace": "srgb",
          "components": [0.2, 0.25, 0.3, 1]
        },
        "fontFeatures": ["smcp"],
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "letterSpacing": {
          "dimensionType": "length",
          "value": 1,
          "unit": "px"
        },
        "wordSpacing": {
          "dimensionType": "length",
          "value": 2,
          "unit": "px"
        }
      }
    },
    "scaledSp": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Example",
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "letterSpacing": {
          "dimensionType": "length",
          "value": 1,
          "unit": "sp",
          "fontScale": true
        },
        "lineHeight": {
          "dimensionType": "length",
          "value": 16,
          "unit": "sp",
          "fontScale": true
        }
      }
    }
  }
}
```
