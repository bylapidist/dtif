# DTIF Language Server

`@lapidist/dtif-language-server` delivers Language Server Protocol (LSP) services for the Design Token Interchange Format (DTIF). It brings schema-backed diagnostics, pointer-aware navigation, and assisted authoring into any editor that can host a Node.js language server.

> **Runtime** · Node.js 22<br>
> **Transports** · stdio (default), custom message readers/writers

## Capabilities

### Diagnostics and validation

- Parses DTIF documents with tolerant JSONC support and precise error ranges.
- Validates against the canonical DTIF schema via `@lapidist/dtif-validator`.
- Publishes diagnostics on open and change events, clearing them automatically when documents close.

### Navigation and insights

- Resolves JSON pointers for `$ref` members and theming overrides.
- Provides jump-to-definition, hover documentation with inline token previews, and related location metadata.
- Keeps an incremental document index so navigation stays responsive in large workspaces.

### Refactors and quick fixes

- Supports rename refactors for pointer definitions, emitting workspace edits that update every reference currently loaded by the server.
- Offers quick fixes for common schema issues such as missing `$type` or `$ref` members, inserting scaffolded payloads that respect DTIF structure.

### Authoring assistance

- Supplies contextual completions for `$type` identifiers, measurement units, and `$extensions` namespaces sourced from the DTIF registry.
- Orders completion results by relevance to the active pointer scope.

## Installation

```bash
npm install --save-dev @lapidist/dtif-language-server
```

The package bundles TypeScript declarations and compiled JavaScript so editors can load it directly from `node_modules`.

## Minimal bootstrap

```ts
import { start } from '@lapidist/dtif-language-server';

start();
```

`start()` wires the language server to stdio, making it compatible with VS Code, Neovim, Sublime Text, and any editor that launches Node-based LSP servers as child processes. For socket- or stream-based transports, pass custom message reader and writer instances:

```ts
import net from 'node:net';
import { createConnection, start } from '@lapidist/dtif-language-server';
import { SocketMessageReader, SocketMessageWriter } from 'vscode-languageserver/node';

const socket = net.connect({ port: 7000 });
const connection = createConnection(
  new SocketMessageReader(socket),
  new SocketMessageWriter(socket)
);

start({ connection });
```

## Workspace settings

The language server reads optional workspace configuration under the `dtifLanguageServer` section.

| Setting           | Type            | Default | Description                                                                     |
| ----------------- | --------------- | ------- | ------------------------------------------------------------------------------- |
| `validation.mode` | `'on' \| 'off'` | `'on'`  | Enables or suppresses schema diagnostics while keeping navigation indexes warm. |

Settings can be supplied by clients that implement [`workspace/configuration`](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#workspace_configuration) or via editor-specific configuration files.

### VS Code example

```jsonc
{
  "dtifLanguageServer": {
    "validation": {
      "mode": "on"
    }
  }
}
```

## Version alignment

The language server depends on `@lapidist/dtif-parser`, `@lapidist/dtif-validator`, and `@lapidist/dtif-schema`. Package versions are locked so that a single release captures compatible behaviour across the stack. When upgrading one dependency, bump the workspace using a Changeset so downstream integrators receive an aligned bundle.

## Development

- `npm run build --workspace=@lapidist/dtif-language-server` – compile to `dist/`.
- `npm test --workspace=@lapidist/dtif-language-server` – run the Node.js test suite.
- `npm run lint` / `npm run lint:ts` – enforce repository lint rules.

Integration tests in `language-server/tests/` spin up the LSP over JSON-RPC streams to verify diagnostics, navigation, refactors, and configuration handling end to end.

## Troubleshooting

| Symptom                                               | Suggested action                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Diagnostics do not appear                             | Confirm `validation.mode` is set to `'on'` and the client calls `textDocument/didOpen` for DTIF files.                            |
| Rename edits miss some files                          | Only documents opened by the client are available to the server. Ensure the editor loads relevant files before triggering rename. |
| Diagnostics do not reappear after toggling validation | Ensure the client re-requests configuration after edits. Some editors only refetch settings on save or focus changes.             |

## License

This package is distributed under the [MIT License](../LICENSE). See the repository root for contributing guidelines and governance.
