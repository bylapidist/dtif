---
title: Typography base tokens
description: A baseline typography style with family and size settings.
---

# Typography base tokens {#typography-base}

This example defines a baseline typography style with only a font family and size. It acts as the foundation for the layered typography fixtures.

See [`typography-base.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/typography-base.tokens.json) for the complete document.

## Sample tokens {#typography-base-sample}

```json dtif
{
  "$version": "1.0.0",
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
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
