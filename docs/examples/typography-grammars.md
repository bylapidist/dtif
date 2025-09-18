---
title: Typography grammar tokens
description: Typography values that exercise CSS grammar shorthands and features.
---

# Typography grammar tokens {#typography-grammars}

This example exercises advanced CSS typography grammars, including multi-keyword text transforms, feature flags, and oblique angle styles. It verifies that shorthand decorations round-trip correctly.

See [`typography-grammars.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/typography-grammars.tokens.json) for the complete document.

## Sample tokens {#typography-grammars-sample}

```json
{
  "typography": {
    "cssGrammar": {
      "$type": "typography",
      "$value": {
        "color": {
          "colorSpace": "srgb",
          "components": [0.1, 0.2, 0.3, 1]
        },
        "fontFamily": "Inter",
        "fontFeatures": ["ss01", "cv01"],
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "fontStyle": "oblique 14deg",
        "fontWeight": "bold",
        "letterSpacing": {
          "dimensionType": "length",
          "value": 0.12,
          "unit": "em"
        },
        "textDecoration": "underline dotted 0.12em",
        "textTransform": "uppercase full-width",
        "wordSpacing": {
          "dimensionType": "length",
          "value": 12,
          "unit": "%"
        }
      }
    },
    "variableAxis": {
      "$type": "typography",
      "$value": {
        "color": {
          "colorSpace": "display-p3",
          "components": [0.68, 0.32, 0.28, 1]
        },
        "fontFamily": "Inter",
        "fontFeatures": ["tnum"],
        "fontSize": {
          "dimensionType": "length",
          "value": 16,
          "unit": "px"
        },
        "fontStyle": "italic",
        "fontWeight": 575,
        "letterSpacing": "normal",
        "textDecoration": "line-through solid",
        "textTransform": "capitalize",
        "wordSpacing": {
          "dimensionType": "length",
          "value": 1,
          "unit": "sp",
          "fontScale": true
        }
      }
    }
  }
}
```
