---
title: Typography layer tokens
description: An additive typography layer that supplies weight and line height.
---

# Typography layer tokens {#typography-layer}

This example represents an additive layer that contributes typography weight and line height to the base style. It illustrates how layered tokens omit `$type` when merging with another document.

See [`typography-layer.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/typography-layer.tokens.json) for the complete document.

## Sample tokens {#typography-layer-sample}

```json
{
  "typography": {
    "body": {
      "$value": {
        "fontWeight": 700,
        "lineHeight": 1.5
      }
    }
  }
}
```
