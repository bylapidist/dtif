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

When you prefer an npm distribution instead of cloning the repository, install
the published schema package:

```bash
npm install --save-dev @lapidist/dtif-schema
npx --yes ajv-cli validate -s node_modules/@lapidist/dtif-schema/core.json -d your.tokens.json
```

Programmatic validation is available through
[`@lapidist/dtif-validator`](https://www.npmjs.com/package/@lapidist/dtif-validator),
which preloads Ajv with the official schema and recommended options:

```bash
npm install --save-dev @lapidist/dtif-validator
```

```js
import { validateDtif } from '@lapidist/dtif-validator';

const { valid, errors } = validateDtif(tokens);
if (!valid) {
  console.error(errors);
}
```

`@lapidist/dtif-schema` also publishes TypeScript declarations so you can
annotate DTIF documents in editors and build tooling:

```ts
import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

declare const tokens: DesignTokenInterchangeFormat;
```

See the [Specification introduction](../spec/introduction.md#abstract) for terminology and core concepts, and explore the [registry](https://github.com/bylapidist/dtif/blob/main/registry/README.md) for registered `$type` values.
