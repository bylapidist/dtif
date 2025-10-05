# @lapidist/dtif-parser

Canonical parser and runtime for the Design Token Interchange Format (DTIF). The
package provides the reference pipeline for loading, validating, normalising,
and resolving DTIF documents while emitting structured diagnostics for tooling
and automation workflows.

> Documentation: [Using the DTIF parser](https://dtif.lapidist.net/guides/dtif-parser/)

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

To flatten tokens, collect metadata, and normalise diagnostics in a single step,
use the `parseTokens` helper. It loads the document, builds the dependency graph,
and returns resolved token snapshots alongside a flattened view of the document.

```ts
import { parseTokens } from '@lapidist/dtif-parser';

const { flattened, metadataIndex, resolutionIndex, diagnostics } = await parseTokens('tokens.json');

for (const token of flattened) {
  console.log(token.pointer, token.value);
}
```

Pass `onDiagnostic` to observe parser diagnostics as they are produced and `warn`
to intercept non-fatal issues. Both callbacks receive domain `DiagnosticEvent`
objects, allowing you to format or surface them immediately without waiting for
the promise to resolve.

```ts
await parseTokens('tokens.json', {
  onDiagnostic: (diagnostic) => {
    console.error(diagnostic.message);
  },
  warn: (diagnostic) => {
    console.warn('[warn]', diagnostic.message);
  }
});
```

Provide a `TokenCache` implementation, such as the built-in
`InMemoryTokenCache`, to reuse flattening and resolution results across runs or
for synchronous parsing with `parseTokensSync` when your inputs are already
available in memory.

Create a session with `createSession` to reuse caches, install custom document
loaders, register plugins, or parse multiple collections with shared state.

### Node adapter

For Node-based tooling, import the bundled adapter to read DTIF token files from
disk with extension validation, formatted diagnostics, and ready-to-use token
documents:

```ts
import { parseTokensFromFile, readTokensFile } from '@lapidist/dtif-parser/adapters/node';

try {
  const result = await parseTokensFromFile('tokens/base.tokens.json', {
    onWarn: (message) => console.warn(message)
  });
  console.log(result.flattened.length);
} catch (error) {
  // DtifTokenParseError exposes the normalised diagnostics for reporting
}

const document = await readTokensFile('tokens/base.tokens.json');
```

## Development

- [Parser package structure](../docs/tooling/dtif-parser-package-structure.md) documents the current
  module layout, session lifecycle, and testing conventions that future
  roadmap work will build upon.

## Command line interface

The workspace publishes a `dtif-parse` binary for quick inspection and CI
pipelines:

```bash
dtif-parse tokens/base.tokens.json --resolve "#/color/brand/primary"
```

Use `dtif-parse --help` for the full list of options and output formats.

## License

MIT © Lapidist
