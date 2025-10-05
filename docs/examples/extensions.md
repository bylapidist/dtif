---
title: Extension metadata tokens
description: Tokens that attach custom extension data to colors, components, and motion.
---

# Extension metadata tokens {#extensions}

This example illustrates how `$extensions` carry vendor metadata alongside component slots, motion tokens, and responsive dimensions. It shows accessibility annotations and custom intent flags traveling with the base values.

See [`extensions.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/extensions.tokens.json) for the complete document.

## Sample tokens {#extensions-sample}

```json dtif
{
  "$version": "1.0.0",
  "color": {
    "cta": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0, 0.5, 1]
      },
      "$extensions": {
        "org.example.ai": {
          "intent": "primary action"
        }
      }
    },
    "link": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0, 0, 1]
      },
      "$extensions": {
        "org.example.a11y": {
          "wcagContrast": 4.5
        }
      }
    }
  },
  "motion": {
    "fade": {
      "$type": "duration",
      "$value": {
        "durationType": "css.transition-duration",
        "value": 200,
        "unit": "ms"
      },
      "$extensions": {
        "org.example.a11y": {
          "prefers-reduced-motion": true
        }
      }
    }
  },
  "spacing": {
    "responsive": {
      "$type": "dimension",
      "$value": {
        "fn": "clamp",
        "parameters": [
          {
            "dimensionType": "length",
            "value": 8,
            "unit": "px"
          },
          {
            "dimensionType": "length",
            "value": 2,
            "unit": "vw"
          },
          {
            "dimensionType": "length",
            "value": 16,
            "unit": "px"
          }
        ]
      }
    }
  }
}
```
