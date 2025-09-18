---
title: Typography unit tokens
description: Typography sizes expressed with characters, percentages, points, and viewport units.
---

# Typography unit tokens {#typography-units}

This example surveys typography tokens that use character counts, ex heights, percentages, viewport units, and font-scaled points. It shows how unit metadata travels alongside each value.

See [`typography-units.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/typography-units.tokens.json) for the complete document.

## Sample tokens {#typography-units-sample}

```json
{
  "typography": {
    "ch": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": {
          "dimensionType": "length",
          "value": 30,
          "unit": "ch"
        }
      }
    },
    "ex": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": {
          "dimensionType": "length",
          "value": 2,
          "unit": "ex"
        }
      }
    },
    "percent": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": {
          "dimensionType": "length",
          "value": 120,
          "unit": "%"
        }
      }
    },
    "points": {
      "$type": "typography",
      "$value": {
        "fontFamily": "SF Pro",
        "fontSize": {
          "dimensionType": "length",
          "value": 14,
          "unit": "pt",
          "fontScale": true
        },
        "lineHeight": {
          "dimensionType": "length",
          "value": 20,
          "unit": "pt",
          "fontScale": true
        }
      }
    },
    "vw": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": {
          "dimensionType": "length",
          "value": 5,
          "unit": "vw"
        }
      }
    }
  }
}
```
