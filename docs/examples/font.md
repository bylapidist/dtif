---
title: Font tokens
description: Font declarations spanning CSS, iOS system, and local families.
---

# Font tokens {#font}

This example bundles CSS font-face, iOS system font, and local font declarations under the `font` token type. It captures weights, styles, and family names for each platform.

See [`font.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/font.tokens.json) for the complete document.

## Sample tokens {#font-sample}

```json dtif
{
  "$version": "1.0.0",
  "font": {
    "brand": {
      "$type": "font",
      "$value": {
        "fontType": "css.font-face",
        "family": "Brand Sans",
        "style": "oblique 12deg",
        "weight": 600
      }
    },
    "system": {
      "$type": "font",
      "$value": {
        "fontType": "ios.system",
        "family": "SF Pro Text"
      }
    },
    "web": {
      "$type": "font",
      "$value": {
        "fontType": "css.local",
        "family": "Example Display",
        "style": "italic",
        "weight": "bold"
      }
    }
  }
}
```
