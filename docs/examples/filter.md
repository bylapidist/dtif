---
title: Filter tokens
description: Filter pipelines that reuse shared shadow tokens across platforms.
---

# Filter tokens {#filter}

This example strings blur, brightness, and drop-shadow operations together for CSS filters, Core Image, and Android render effects. It reuses shared shadow tokens via `$ref` so a single definition feeds each platform.

See [`filter.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/filter.tokens.json) for the complete document.

## Sample tokens {#filter-sample}

```json dtif
{
  "$version": "1.0.0",
  "filter": {
    "focus-css": {
      "$type": "filter",
      "$value": {
        "filterType": "css.filter",
        "operations": [
          {
            "fn": "blur",
            "parameters": ["8px"]
          },
          {
            "fn": "brightness",
            "parameters": [0.95]
          },
          {
            "fn": "drop-shadow",
            "parameters": [
              {
                "$ref": "#/shadow/focus-css"
              }
            ]
          }
        ]
      }
    }
  },
  "shadow": {
    "focus-css": {
      "$type": "shadow",
      "$value": {
        "shadowType": "css.box-shadow.surface",
        "blur": {
          "dimensionType": "length",
          "value": 24,
          "unit": "px"
        },
        "color": {
          "colorSpace": "srgb",
          "components": [0.059, 0.09, 0.165, 0.2]
        },
        "offsetX": {
          "dimensionType": "length",
          "value": 0,
          "unit": "px"
        },
        "offsetY": {
          "dimensionType": "length",
          "value": 12,
          "unit": "px"
        }
      }
    }
  }
}
```
