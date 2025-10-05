---
title: Color space tokens
description: Color tokens expressed with sRGB, Display-P3, and OKLCH values.
---

# Color space tokens {#color-spaces}

This example shows how DTIF captures colors in sRGB, Display-P3, and OKLCH to preserve brand hues across wide-gamut displays. Each value demonstrates how color space metadata travels with the components.

See [`color-spaces.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/color-spaces.tokens.json) for the complete document.

## Sample tokens {#color-spaces-sample}

```json dtif
{
  "$version": "1.0.0",
  "color": {
    "accent": {
      "$type": "color",
      "$value": {
        "colorSpace": "display-p3",
        "components": [0.2, 0.45, 0.7, 0.9]
      }
    },
    "surface": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.82, 0.04, 262]
      }
    },
    "text": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.1, 0.1, 0.12]
      }
    }
  }
}
```
