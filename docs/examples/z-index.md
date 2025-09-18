---
title: Z-index tokens
description: Stacking context values aligned with CSS, iOS, and Android APIs.
---

# Z-index tokens {#z-index}

This example captures stacking contexts for CSS, iOS, and Android so that layer ordering stays consistent. Each entry mirrors the platform-specific property it targets.

See [`z-index.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/z-index.tokens.json) for the complete document.

## Sample tokens {#z-index-sample}

```json
{
  "z-index": {
    "android-fab": {
      "$type": "z-index",
      "$value": {
        "zIndexType": "android.view.translationz",
        "value": 3.5
      },
      "$description": "Floating action button translationZ for prominence"
    },
    "ios-dialog": {
      "$type": "z-index",
      "$value": {
        "zIndexType": "ios.calayer.z-position",
        "value": 4
      },
      "$description": "Layer.zPosition used to raise iOS dialogs above scrims"
    },
    "modal": {
      "$type": "z-index",
      "$value": {
        "zIndexType": "css.z-index",
        "value": 1300
      },
      "$description": "CSS stacking context for modal dialogs"
    }
  }
}
```
