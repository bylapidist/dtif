---
title: Font scale tokens
description: Dimensions that toggle the fontScale flag for scalable values.
---

# Font scale tokens {#font-scale}

This example highlights `fontScale` flags on dimension tokens to show which values respond to user text sizing. It pairs fixed `dp` spacing with scalable `sp` values.

See [`font-scale.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/font-scale.tokens.json) for the complete document.

## Sample tokens {#font-scale-sample}

```json
{
  "spacing": {
    "fixed": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 16,
        "unit": "dp",
        "fontScale": false
      }
    },
    "scaled": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 16,
        "unit": "sp",
        "fontScale": true
      }
    }
  }
}
```
