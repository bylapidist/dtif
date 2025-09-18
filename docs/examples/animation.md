---
title: Animation tokens
description: Duration and easing fixtures that align CSS, iOS, and Android timelines.
---

# Animation tokens {#animation}

This example demonstrates duration and easing tokens that keep CSS timelines, iOS animations, and Android animators in sync. It mixes frame counts, millisecond values, percentage staggers, and spring curves so the same JSON payload suits multiple engines.

See [`animation.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/animation.tokens.json) for the complete document.

## Sample tokens {#animation-sample}

```json
{
  "duration": {
    "entry": {
      "$type": "duration",
      "$value": {
        "durationType": "ios.cadisplaylink.frame-count",
        "value": 6,
        "unit": "frames"
      }
    },
    "medium": {
      "$type": "duration",
      "$value": {
        "durationType": "css.transition-duration",
        "value": 0.2,
        "unit": "s"
      }
    },
    "stagger": {
      "$type": "duration",
      "$value": {
        "durationType": "css.timeline.progress",
        "value": 150,
        "unit": "%"
      }
    }
  },
  "easing": {
    "springy": {
      "$type": "easing",
      "$value": {
        "easingFunction": "spring",
        "parameters": [1, 180, 24, 0.2]
      }
    },
    "stepped": {
      "$type": "easing",
      "$value": {
        "easingFunction": "steps",
        "parameters": [4, "jump-end"]
      }
    }
  }
}
```
