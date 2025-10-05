---
title: Minimal tokens
description: The smallest valid DTIF document with a single spacing token.
---

# Minimal tokens {#minimal}

This example represents the smallest valid DTIF payload. It contains a single spacing token, making it useful for quick validation smoke tests.

See [`minimal.tokens.json`](https://github.com/bylapidist/dtif/blob/main/examples/minimal.tokens.json) for the complete document.

## Sample tokens {#minimal-sample}

```json dtif
{
  "$version": "1.0.0",
  "spacing": {
    "small": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 2,
        "unit": "px"
      }
    }
  }
}
```
