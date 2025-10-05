---
title: Override tokens
description: Conditional overrides with fallbacks tied to prefers-color-scheme.
---

# Override tokens {#overrides}

This example demonstrates the `$overrides` array for swapping colors when `prefers-color-scheme` is dark. It pairs conditional references with fallback chains and shows the base button tokens they modify.

See [`overrides.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/overrides.tokens.json) for the complete document.

## Sample tokens {#overrides-sample}

```json dtif
{
  "$version": "1.0.0",
  "$overrides": [
    {
      "$token": "#/button/bg",
      "$when": {
        "prefers-color-scheme": "dark"
      },
      "$ref": "#/color/brand/dark",
      "$fallback": {
        "$ref": "#/color/brand/mid"
      }
    },
    {
      "$token": "#/button/text",
      "$when": {
        "prefers-color-scheme": "dark"
      },
      "$value": {
        "colorSpace": "srgb",
        "components": [1, 1, 1, 1]
      },
      "$fallback": [
        {
          "$ref": "#/color/brand/mid"
        },
        {
          "$value": {
            "colorSpace": "srgb",
            "components": [0, 0, 0, 1]
          }
        }
      ]
    }
  ],
  "button": {
    "bg": {
      "$type": "color",
      "$ref": "#/color/brand/light"
    },
    "text": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0, 0, 0, 1]
      }
    }
  }
}
```
