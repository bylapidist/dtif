---
title: Complex tokens
description: Interdependent tokens with aliases, themes, and platform metadata.
---

# Complex tokens {#complex}

This example demonstrates interconnected tokens, from component slots and platform-specific metadata to deprecated aliases and theme references. It shows how a medium-sized system coordinates colors, typography, motion, and more.

See [`complex.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/complex.tokens.json) for the complete document.

## Sample tokens {#complex-sample}

```json
{
  "button": {
    "$type": "color",
    "$extensions": {
      "com.example": {
        "platform": "ios"
      }
    },
    "padding": {
      "$type": "dimension",
      "$ref": "#/size/base"
    },
    "primary": {
      "$type": "color",
      "$ref": "#/color/brand"
    },
    "primary-hover": {
      "$type": "color",
      "$ref": "#/button/primary"
    }
  },
  "color": {
    "brand": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [1, 0, 0]
      },
      "$lastModified": "2024-01-02T00:00:00Z",
      "$lastUsed": "2024-05-01T00:00:00Z",
      "$usageCount": 120,
      "$tags": ["brand"]
    },
    "brand-alt": {
      "$type": "color",
      "$ref": "#/color/brand",
      "$deprecated": {
        "$replacement": "#/color/brand"
      }
    }
  },
  "themes": {
    "dark": {
      "$type": "com.example.tokens.theme",
      "$ref": "dark.tokens.json#"
    },
    "light": {
      "$type": "com.example.tokens.theme",
      "$ref": "light.tokens.json#"
    }
  }
}
```
