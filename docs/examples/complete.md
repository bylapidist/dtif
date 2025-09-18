---
title: Complete design system tokens
description: A comprehensive fixture with metadata, extensions, themes, and aliases.
---

# Complete design system tokens {#complete}

This example assembles a full design system payload with usage metadata, extensions, and cross-referenced tokens spanning many categories. It illustrates how themes, component slots, and authoring details live alongside the core values.

See [`complete.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/complete.tokens.json) for the complete document.

## Sample tokens {#complete-sample}

```json
{
  "component": {
    "button": {
      "$type": "component",
      "$description": "Button component tokens",
      "$value": {
        "$slots": {
          "background": {
            "$type": "color",
            "$ref": "#/color/primary",
            "$extensions": {
              "org.example.a11y": {
                "wcagContrast": 4.5
              }
            }
          },
          "border": {
            "$type": "border",
            "$ref": "#/border/focus-ring"
          },
          "text": {
            "$type": "color",
            "$value": {
              "colorSpace": "srgb",
              "components": [1, 1, 1, 1]
            },
            "$extensions": {
              "org.example.ai": {
                "intent": "primary action"
              }
            }
          }
        }
      },
      "$tags": ["component"]
    }
  },
  "metadata": {
    "$description": "Demonstrates all collection metadata fields",
    "$author": "Designer",
    "$tags": ["example", "metadata"]
  },
  "themes": {
    "$description": "External references",
    "dark": {
      "$type": "theme",
      "$ref": "dark.tokens.json#"
    },
    "light": {
      "$type": "theme",
      "$ref": "light.tokens.json#"
    }
  }
}
```
