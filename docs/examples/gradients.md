---
title: Gradient tokens
description: Linear and radial gradients with stops, hints, and keyword angles.
---

# Gradient tokens {#gradients}

This example captures linear and radial gradients with CSS-style angles, keyword stops, and numeric hints. It mirrors how native gradient APIs consume stop positions and colors.

See [`gradients.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/gradients.tokens.json) for the complete document.

## Sample tokens {#gradients-sample}

```json dtif
{
  "$version": "1.0.0",
  "gradient": {
    "heroBackground": {
      "$type": "gradient",
      "$value": {
        "gradientType": "linear",
        "angle": "to top right",
        "stops": [
          {
            "position": "0%",
            "color": {
              "colorSpace": "srgb",
              "components": [0.996, 0.416, 0, 1]
            }
          },
          {
            "position": 0.45,
            "hint": "50%",
            "color": {
              "colorSpace": "srgb",
              "components": [1, 0.824, 0, 1]
            }
          },
          {
            "position": "calc(100% - 8px)",
            "color": {
              "colorSpace": "srgb",
              "components": [1, 0, 0.4, 1]
            }
          }
        ]
      }
    },
    "radialSpotlight": {
      "$type": "gradient",
      "$value": {
        "gradientType": "radial",
        "shape": "circle",
        "center": {
          "x": 0.4,
          "y": 0.35
        },
        "stops": [
          {
            "position": 0,
            "color": {
              "colorSpace": "srgb",
              "components": [1, 0.973, 0.925, 1]
            }
          },
          {
            "position": 0.6,
            "hint": 0.7,
            "color": {
              "colorSpace": "srgb",
              "components": [1, 0.733, 0.565, 0.7]
            }
          },
          {
            "position": 1,
            "color": {
              "colorSpace": "srgb",
              "components": [0.965, 0.525, 0.29, 0]
            }
          }
        ]
      }
    }
  }
}
```
