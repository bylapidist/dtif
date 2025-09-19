# DTIF Schemas

This directory contains the canonical JSON Schema definitions for the
Design Token Interchange Format (DTIF). It doubles as the published npm
package [`@lapidist/dtif-schema`](https://www.npmjs.com/package/@lapidist/dtif-schema)
so consumers can install versioned schema snapshots without cloning the
repository.

## Files

- [`core.json`](core.json) – schema for the DTIF core specification.
- [`package.json`](package.json) – npm metadata for `@lapidist/dtif-schema`.
- [`README.md`](README.md) – this document is bundled with the npm release.

## Installation

```bash
npm install @lapidist/dtif-schema
```

## Usage

Load the schema from Node or bundlers:

```js
import schema from '@lapidist/dtif-schema/core.json' assert { type: 'json' };

// Validate a document using Ajv
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(tokens);
```

Prefer [`@lapidist/dtif-validator`](https://www.npmjs.com/package/@lapidist/dtif-validator)
when you want a preconfigured Ajv instance that bundles this schema and
the recommended defaults.

The package only contains published schema files so the payload stays
small. Install the matching version whenever a new specification release
is published to stay aligned.

## TypeScript declarations

`@lapidist/dtif-schema` bundles generated TypeScript declarations at
[`index.d.ts`](index.d.ts) so editors and build tooling can type-check
DTIF documents without installing a separate package.

```ts
import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

declare const tokens: DesignTokenInterchangeFormat;
```

Run `npm run build:packages` to regenerate the declaration file after
editing `core.json`.

## Changelog

Refer to [CHANGELOG.md](CHANGELOG.md) for release history.
