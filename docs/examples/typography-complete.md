---
title: Typography complete tokens
description: The fully merged typography style produced after layering.
---

# Typography complete tokens {#typography-complete}

This example shows the fully merged typography style once additional weight and line height information are applied. It represents the end result of layering base and supplemental styles.

See [`typography-complete.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/typography-complete.tokens.json) for the complete document.

## Sample tokens {#typography-complete-sample}

```json
{
  "typography": {
    "body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontWeight": 700,
        "lineHeight": 1.5,
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
