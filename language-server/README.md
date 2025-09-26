# DTIF Language Server

`@lapidist/dtif-language-server` provides Language Server Protocol (LSP) services for the Design Token Interchange Format (DTIF). The server integrates with editors that support LSP, delivering validation, navigation, and authoring assistance for DTIF documents.

> **Status:** Experimental – the server API may change before the first stable release.

## Features

- JSON parsing with detailed diagnostics for syntax errors.
- JSON Schema validation powered by `@lapidist/dtif-validator`, including precise ranges for reported issues.
- Automatic diagnostic refresh on document changes and cleanup on close events.
- Jump-to-definition for local JSON pointer references (e.g. `$ref`, override `token`/`ref` fields).
- Pointer hovers that surface token metadata and a formatted JSON preview for the target pointer.
- Rename refactors that update pointer definitions and every reference in open DTIF documents.
- Quick fixes for missing `$type` and `$ref` properties detected by the schema validator.
- Context-aware completions for `$type` identifiers, measurement `unit` values, and `$extensions` namespaces.

## Configuration

The server reads workspace configuration from the `dtifLanguageServer` section. All keys are optional; sensible defaults are used when no settings are provided.

| Setting             | Type            | Default | Description                                                                                                                                                                                   |
| ------------------- | --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation.mode`   | `'on' \| 'off'` | `'on'`  | Controls whether schema diagnostics are published. When set to `'off'`, the server clears diagnostics for open documents while keeping the document index up to date for navigation features. |
| `telemetry.enabled` | `boolean`       | `false` | Enables lightweight telemetry via the LSP `telemetry/log` channel. When disabled, no telemetry payloads are emitted.                                                                          |

## Getting started

```bash
npm install @lapidist/dtif-language-server
```

Start the server by wiring it into an LSP client transport (stdio, sockets, etc.). A minimal Node.js entry point:

```ts
import { start } from '@lapidist/dtif-language-server';

start();
```

The default export boots the server on standard I/O, making it suitable for VS Code and other editors that launch Node-based LSPs.

## Development

- `npm run build` – compile the TypeScript sources to `dist/`.
- `npm test` – run the unit tests with the Node.js test runner.

The package targets **Node.js 22** and uses the same formatting and linting configuration as the rest of the DTIF workspace.
