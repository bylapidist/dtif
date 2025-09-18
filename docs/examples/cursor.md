---
title: Cursor tokens
description: Pointer styles with CSS strings, iOS beams, and Android hotspots.
---

# Cursor tokens {#cursor}

This example encodes pointer affordances for CSS cursors, Android pointer icons, and iOS beam interactions. It highlights hotspot coordinates and beam settings that travel with each platform value.

See [`cursor.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/cursor.tokens.json) for the complete document.

## Sample tokens {#cursor-sample}

```json
{
  "cursor": {
    "link": {
      "$type": "cursor",
      "$value": {
        "cursorType": "css.cursor",
        "value": "pointer, url('/cursors/link.svg') 8 0"
      }
    },
    "link-icon": {
      "$type": "cursor",
      "$value": {
        "cursorType": "android.pointer-icon",
        "parameters": {
          "hotspot": {
            "x": {
              "dimensionType": "length",
              "value": 8,
              "unit": "dp"
            },
            "y": {
              "dimensionType": "length",
              "value": 0,
              "unit": "dp"
            }
          }
        },
        "value": "TYPE_HAND"
      }
    },
    "text-beam": {
      "$type": "cursor",
      "$value": {
        "cursorType": "ios.uipointerstyle",
        "parameters": {
          "preferredLength": {
            "dimensionType": "length",
            "value": 28,
            "unit": "pt"
          }
        },
        "value": {
          "axis": "vertical",
          "style": "beam"
        }
      }
    }
  }
}
```
