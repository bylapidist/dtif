---
title: Motion tokens
description: Motion transforms for CSS, UIKit/Core Animation, and Android APIs.
---

# Motion tokens {#motion}

This example showcases motion tokens across CSS transforms, UIKit/Core Animation helpers, and Android animator APIs. It includes a path-based keyframe sequence and an easing reference shared between tokens.

See [`motion.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/motion.tokens.json) for the complete document.

## Sample tokens {#motion-sample}

```json
{
  "android-elevation": {
    "$type": "motion",
    "$value": {
      "motionType": "android.viewpropertyanimator.translationz",
      "parameters": {
        "z": {
          "dimensionType": "length",
          "value": 4,
          "unit": "dp"
        }
      }
    }
  },
  "orbit": {
    "$type": "motion",
    "$value": {
      "motionType": "ios.cakeyframeanimation.path",
      "parameters": {
        "points": [
          {
            "time": 0,
            "position": {
              "x": {
                "dimensionType": "length",
                "value": 0,
                "unit": "px"
              },
              "y": {
                "dimensionType": "length",
                "value": 0,
                "unit": "px"
              }
            }
          },
          {
            "time": 0.5,
            "easing": "#/timing",
            "position": {
              "x": {
                "dimensionType": "length",
                "value": 40,
                "unit": "%"
              },
              "y": {
                "dimensionType": "length",
                "value": -16,
                "unit": "px"
              }
            }
          },
          {
            "time": 1,
            "position": {
              "x": {
                "dimensionType": "length",
                "value": 0,
                "unit": "px"
              },
              "y": {
                "dimensionType": "length",
                "value": 0,
                "unit": "px"
              }
            }
          }
        ]
      }
    }
  },
  "slide-in": {
    "$type": "motion",
    "$value": {
      "motionType": "css.translate3d",
      "parameters": {
        "x": {
          "dimensionType": "length",
          "value": 24,
          "unit": "px"
        },
        "y": {
          "dimensionType": "length",
          "value": 0,
          "unit": "px"
        },
        "z": {
          "dimensionType": "length",
          "value": 0,
          "unit": "px"
        }
      }
    }
  },
  "timing": {
    "$type": "easing",
    "$value": {
      "easingFunction": "cubic-bezier",
      "parameters": [0.4, 0, 0.2, 1]
    }
  }
}
```
