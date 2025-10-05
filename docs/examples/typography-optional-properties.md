---
title: Typography optional property tokens
description: Typography descriptors covering variant, stretch, and line metrics.
---

# Typography optional property tokens {#typography-optional-properties}

This example highlights optional typography descriptors such as variant, stretch, and underline metrics. It keeps related spacing values together to demonstrate richer styles.

See [`typography-optional-properties.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/typography-optional-properties.tokens.json) for the complete document.

## Sample tokens {#typography-optional-properties-sample}

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontVariant": "small-caps",
        "fontStretch": "condensed",
        "fontFeatures": ["smcp"],
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "overlineOffset": {
          "dimensionType": "length",
          "value": 5,
          "unit": "px"
        },
        "overlineThickness": {
          "dimensionType": "length",
          "value": 1,
          "unit": "px"
        },
        "underlineOffset": {
          "dimensionType": "length",
          "value": 2,
          "unit": "px"
        },
        "underlineThickness": {
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
    }
  }
}
```
