---
title: DTIF Language Server
description: Integrate the DTIF Language Server Protocol (LSP) implementation into editors and automation.
keywords:
  - language server
  - lsp
  - dtif
outline: [2, 3]
---

# DTIF Language Server {#dtif-language-server}

`@lapidist/dtif-language-server` embeds the Design Token Interchange Format (DTIF) specification inside the Language Server Protocol. Editors that speak LSP gain schema-backed diagnostics, pointer navigation, and guided authoring from a single Node.js runtime.

## Why teams adopt the DTIF language server {#why-adopt}

- **Immediate feedback.** JSON parsing and schema validation surface precise diagnostics as soon as documents change.
- **Pointer intelligence.** Jump-to-definition, hover documentation, and rename refactors understand `$ref` relationships across files.
- **Guided authoring.** Contextual completions for `$type`, measurement `unit` values, and `$extensions` namespaces reduce copy errors.
- **Aligned releases.** The server ships with locked versions of the DTIF parser, schema, and validator so every release stays interoperable.

## Quick start {#quick-start}

Install the workspace in projects that manage DTIF documents:

```bash
npm install --save-dev @lapidist/dtif-language-server
```

Start the server over stdio:

```ts
import { start } from '@lapidist/dtif-language-server';

start();
```

Most editors launch language servers as child processes. `start()` listens on stdio by default, making the package work out of the box for VS Code, Neovim, Sublime Text, Nova, and other clients that adhere to the protocol.

### Custom transports {#custom-transport}

Use the exported `createConnection` helper to adapt the server to socket or message-stream transports:

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

## Configure the workspace {#configure}

The server reads optional configuration from the `dtifLanguageServer` section. Clients should implement [`workspace/configuration`](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#workspace_configuration) to supply values.

| Setting           | Type            | Default | Effect                                                                                              |
| ----------------- | --------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `validation.mode` | `'on' \| 'off'` | `'on'`  | Controls whether schema diagnostics are published. Navigation remains available even when disabled. |

### VS Code

```jsonc
{
  "dtifLanguageServer": {
    "validation": {
      "mode": "on"
    }
  }
}
```

Add the configuration to `settings.json` or workspace settings. Pair it with an LSP client extension or custom `package.json` contribution that launches the bundled server.

### Neovim

Configure `nvim-lspconfig` (or equivalent) to execute the server via Node.js:

```lua
local lspconfig = require('lspconfig')

lspconfig.dtif.setup({
  cmd = { 'node', vim.fn.stdpath('data') .. '/mason/packages/dtif-language-server/node_modules/@lapidist/dtif-language-server/dist/server.js' },
  filetypes = { 'json', 'jsonc', 'dtif' },
  root_dir = lspconfig.util.root_pattern('dtif.config.json', '.git'),
})
```

Adapt the command path to match your package manager or bundler.

## Operational guidance {#operational-guidance}

- **Performance.** The server incrementally indexes documents to keep navigation responsive. Long-running parse jobs honour LSP cancellation tokens to avoid blocking the UI.
- **Versioning.** Changesets ensure the language server, parser, validator, and schema release in lockstep. Consumers can pin a single version in `package.json` to stay consistent.
- **Testing.** Integration tests under `language-server/tests/` simulate full JSON-RPC sessions. Use them as templates for workspace-specific scenarios.

## Troubleshooting {#troubleshooting}

| Symptom                                             | Resolution                                                                                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnostics are missing                             | Confirm `validation.mode` is `'on'` and that the client sends `textDocument/didOpen` events for DTIF files.                                                            |
| Rename refactor misses files                        | LSP rename works on documents currently loaded by the client. Ensure relevant files are open or preloaded before invoking the command.                                 |
| Completion results feel stale                       | The server refreshes the document index on each content change. If completions lag, verify the client forwards incremental changes instead of full document snapshots. |
| Diagnostics stay disabled after toggling validation | Some clients cache configuration responses. Trigger a manual refresh (for example, reloading the window) so the server receives the latest settings.                   |

For further questions or to propose editor-specific configurations, open a [discussion](https://github.com/bylapidist/dtif/discussions).
