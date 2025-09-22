# @lapidist/dtif-parser

Canonical parser and runtime for the Design Token Interchange Format (DTIF). The
package provides the reference pipeline for loading, validating, normalising,
and resolving DTIF documents while emitting structured diagnostics for tooling
and automation workflows.

> Documentation: [Canonical parser architecture](../docs/guides/canonical-parser.md)

## Installation

```bash
npm install @lapidist/dtif-parser
```

The package targets modern Node runtimes (v18+) and is published as a native ESM
module.

## Usage

```ts
import { parseDocument } from '@lapidist/dtif-parser';

const result = await parseDocument('tokens.json');

for (const diagnostic of result.diagnostics) {
  console.error(`${diagnostic.severity}: ${diagnostic.message}`);
}

const resolved = result.resolver?.resolve('#/color/brand/primary');
console.log(resolved?.value);
```

Create a session with `createSession` to reuse caches, install custom document
loaders, register plugins, or parse multiple collections with shared state.

## Command line interface

The workspace publishes a `dtif-parse` binary for quick inspection and CI
pipelines:

```bash
dtif-parse tokens/base.tokens.json --resolve color.brand.primary
```

Use `dtif-parse --help` for the full list of options and output formats.

## License

MIT © Lapidist
