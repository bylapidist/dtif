---
title: Font face tokens
description: A downloadable fontFace token linked to a typography style.
---

# Font face tokens {#font-face}

This example links a downloadable `fontFace` token to a referencing typography style. It captures `src` descriptors, Unicode ranges, and a `$ref` that keeps the typography family aligned.

See [`font-face.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/font-face.tokens.json) for the complete document.

## Sample tokens {#font-face-sample}

```json
{
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
          {
            "local": "Brand Sans"
          },
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
        "lineHeight": 1.5,
        "color": {
          "colorSpace": "srgb",
          "components": [0.1, 0.12, 0.18, 1]
        },
        "fontFamily": {
          "$ref": "#/fontFace/brand/$value/fontFamily"
        },
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        }
      }
    }
  }
}
```
