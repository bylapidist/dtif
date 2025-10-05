---
title: Light theme tokens
description: The light theme brand color used throughout the fixtures.
---

# Light theme tokens {#light}

This example supplies the light theme brand color that pairs with the dark palette. It shares the same structure so theming systems can swap documents without extra mapping.

See [`light.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/light.tokens.json) for the complete document.

## Sample tokens {#light-sample}

```json dtif
{
  "$version": "1.0.0",
  "color": {
    "brand": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [1, 0.2, 0.2]
      }
    }
  }
}
```
