---
title: Getting started
description: Quick-start workflow for producing and validating DTIF token documents.
outline: [2, 3]
---

# Getting started {#getting-started}

Token documents are UTF-8 encoded JSON files. The following example is valid:

```json
{
  "$version": "1.0.0",
  "spacing": {
    "small": { "$type": "dimension", "$value": { "value": 2, "unit": "px" } }
  }
}
```

Validate a document using:

```bash
npx --yes ajv-cli validate -s schema/core.json -d your.tokens.json
```

See the [Specification introduction](../spec/introduction.md#abstract) for terminology and core concepts, and explore the [registry](https://github.com/bylapidist/dtif/blob/main/registry/README.md) for registered `$type` values.
