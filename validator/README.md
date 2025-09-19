# @lapidist/dtif-validator

Utilities for validating Design Token Interchange Format (DTIF) documents
with [Ajv](https://ajv.js.org/). The package loads the published
[`@lapidist/dtif-schema`](https://www.npmjs.com/package/@lapidist/dtif-schema)
and configures Ajv with sensible defaults.

## Installation

```bash
npm install --save-dev @lapidist/dtif-validator
```

Peer Ajv dependencies are bundled so no additional packages are required.

## Quick start

```js
import { createDtifValidator, validateDtif } from '@lapidist/dtif-validator';

// Option 1: manage the Ajv instance yourself
const { ajv, validate } = createDtifValidator();
const valid = validate(tokens);
if (!valid) {
  console.error(validate.errors);
}

// Option 2: one-off validation helper
const result = validateDtif(tokens);
if (!result.valid) {
  console.error(result.errors);
}
```

By default the helper uses Ajv's 2020-12 mode, disables strict schema
validation to match the official tooling, and registers the `ajv-formats`
plugin so string formats (URIs, dates, etc.) are enforced. Pass an
existing Ajv instance or override the options when you need to extend the
validator.

```js
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createDtifValidator } from '@lapidist/dtif-validator';

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

const { validate } = createDtifValidator({ ajv });
```

The DTIF schema is re-exported for convenience:

```js
import { schema } from '@lapidist/dtif-validator';
```

## Versioning

`@lapidist/dtif-validator` is versioned in lockstep with the schema
package (which now bundles the TypeScript declarations). Upgrade both
packages together to stay aligned with the latest DTIF release.

## Changelog

Release history is published in [CHANGELOG.md](CHANGELOG.md).
