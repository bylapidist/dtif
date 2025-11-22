<!-- markdownlint-disable MD041 -->
<p>
  <a href="https://dtif.lapidist.net">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./docs/public/dtif-lockup-dark.svg">
      <img src="./docs/public/dtif-lockup-light.svg" alt="DTIF Logo" width="200">
    </picture>
  </a>
</p>

# Design Token Interchange Format (DTIF)

[![CI](https://img.shields.io/github/actions/workflow/status/bylapidist/dtif/ci.yml?branch=main&label=CI)](https://github.com/bylapidist/dtif/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@lapidist/dtif-schema.svg)](https://www.npmjs.com/package/@lapidist/dtif-schema)
[![Schema Tests](https://img.shields.io/badge/schema%20tests-passing-brightgreen)](tests/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Status:** Experimental Editor's Draft · [Read the documentation](https://dtif.lapidist.net)

DTIF is a vendor-neutral JSON specification for exchanging design tokens—colour, typography, spacing, motion, and more—between design tools and codebases. It standardises how tokens are described and referenced without dictating how they are authored or consumed.

Use DTIF when you need:

- a single, versioned definition of design tokens that designers and engineers can share;
- predictable token payloads validated by an official JSON Schema; and
- a registry-backed naming system that keeps custom extensions interoperable.

## Documentation

Browse the deployed documentation at **[dtif.lapidist.net](https://dtif.lapidist.net)**. Key sections include:

- [Specification](https://dtif.lapidist.net/spec/) – normative chapters covering the format, token types, and conformance rules.
- [Guides](https://dtif.lapidist.net/guides/) – implementation playbooks and tooling workflows.
- [Using the DTIF parser](https://dtif.lapidist.net/guides/dtif-parser) – configure the canonical parser, CLI, and plugin system.
- [DTIFx Toolkit](https://dtifx.lapidist.net/) – automation-ready workflows and plugins for DTIF, with the [open-source suite](https://github.com/bylapidist/dtifx).
- [Examples](https://dtif.lapidist.net/examples/) – schema-valid token documents you can reuse in tests.
- [Governance](https://dtif.lapidist.net/governance/) – processes for proposing changes and managing the registry.
- [Roadmap](https://dtif.lapidist.net/roadmap/) – current focus areas and forward-looking drafts.

## Runtime & support policy

- **Node.js:** 22 or newer (aligns with CI and published workspace `engines` fields)
- **npm:** 10 or newer

The repository follows semantic versioning across workspaces. When contributing, run the workspace-specific scripts referenced
in [CONTRIBUTING.md](CONTRIBUTING.md) to match CI: `npm run lint`, `npm run lint:ts`, `npm test`, and the workspace build/test
commands noted in `AGENTS.md`.

## Quick example

```json dtif
{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "$version": "1.0.0",
  "button": {
    "background": {
      "$type": "color",
      "$value": {
        "$ref": "#/color/brand/primary"
      }
    }
  },
  "color": {
    "brand": {
      "primary": {
        "$type": "color",
        "$value": {
          "colorSpace": "srgb",
          "components": [0.18, 0.28, 0.94]
        }
      }
    }
  },
  "spacing": {
    "small": {
      "$type": "dimension",
      "$value": {
        "dimensionType": "length",
        "value": 8,
        "unit": "px"
      }
    }
  }
}
```

## Validate a token file

1. **Install the tooling**

   ```bash
   git clone https://github.com/bylapidist/dtif.git
   cd dtif
   npm install
   ```

2. **Run the JSON Schema**

   ```bash
   npx ajv validate --spec=draft2020 --strict=true --data=true -c ajv-formats \
     -s schema/core.json -d path/to/tokens.json
   ```

   Load `schema/core.json` with [Ajv](https://ajv.js.org/) or another JSON Schema validator if you want to integrate validation into your build pipeline.

   Prefer installing the published schema when you do not need the full repository:

   ```bash
   npm install --save-dev @lapidist/dtif-schema
   npx ajv validate --spec=draft2020 --strict=true --data=true -c ajv-formats \
     -s node_modules/@lapidist/dtif-schema/core.json -d path/to/tokens.json
   ```

   For programmatic validation, install [`@lapidist/dtif-validator`](https://www.npmjs.com/package/@lapidist/dtif-validator) to wrap Ajv with the published schema and sensible defaults:

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

3. **Exercise the project checks**

   ```bash
   npm run lint
   npm test
   npm run docs:dev   # optional: preview the docs locally
   ```

## Parse DTIF documents

Use the canonical parser package to cache decoded documents, resolve pointers, and drive extension plugins.

1. **Install the parser**

   ```bash
   npm install @lapidist/dtif-parser
   ```

2. **Create a reusable parse session**

   ```ts
   import { createSession } from '@lapidist/dtif-parser';

   const session = createSession({ allowHttp: false, maxDepth: 32 });
   const result = await session.parseDocument('tokens/base.tokens.json');

   if (result.diagnostics.hasErrors()) {
     console.error(result.diagnostics.toArray());
   }

   const resolution = result.resolver?.resolve('#/color/brand/primary');
   if (resolution?.token) {
     console.log(resolution.token.value);
   }
   ```

   Sessions expose the decoded document, normalised AST, document graph, diagnostic bag, and resolver so tooling can perform repeated lookups efficiently.

3. **Inspect documents from the command line**

   ```bash
   npx dtif-parse tokens/base.tokens.json --resolve "#/color/brand/primary" --format json
   ```

   Run `dtif-parse --help` to view all CLI switches. The [parser guide](https://dtif.lapidist.net/guides/dtif-parser) covers cache configuration, loader overrides, and plugin registration in more detail.

## Packages at a glance

| Package                                                       | Description                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`@lapidist/dtif-schema`](schema/README.md)                   | Canonical JSON Schema, bundled TypeScript declarations, and supporting metadata.                              |
| [`@lapidist/dtif-validator`](validator/README.md)             | Programmatic validation utilities that wrap the schema with Ajv best practices.                               |
| [`@lapidist/dtif-parser`](parser/README.md)                   | A streaming parser that builds pointer graphs, resolver APIs, and diagnostics for tooling.                    |
| [`@lapidist/dtif-language-server`](language-server/README.md) | Language Server Protocol (LSP) implementation that powers diagnostics and editor workflows for DTIF projects. |

Each workspace shares formatting, linting, and test infrastructure so upgrades remain consistent across the ecosystem.

## DTIF language server

Embed the [`@lapidist/dtif-language-server`](language-server/README.md) package in any editor that hosts Node.js-based LSP servers. Core capabilities include:

- JSON parsing with schema-backed diagnostics and precise ranges.
- Jump-to-definition, hover documentation, and pointer-aware navigation for `$ref` targets.
- Rename refactors that update pointer declarations alongside every in-memory reference.
- Quick fixes for common schema violations such as missing `$type` or `$ref` members.
- Contextual completions for `$type` identifiers, measurement units, and `$extensions` namespaces sourced from the registry.

See the [language server guide](docs/tooling/language-server.md) for client configuration, workspace settings, and transport options.

## TypeScript support

`@lapidist/dtif-schema` bundles TypeScript declarations so editors and
build tooling can understand DTIF documents:

```ts
import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';

declare const tokens: DesignTokenInterchangeFormat;
```

## Repository reference

- [`schema/`](schema/) – JSON Schema definitions used by validators.
- [`examples/`](examples/) – schema-valid token sets shared across docs and tests.
- [`registry/`](registry/) – the canonical list of `$type` identifiers and extension namespaces.
- [`tests/`](tests/) – conformance fixtures and the test harness invoked by CI.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) – contribution workflow, coding standards, and release process expectations.
- [`.changeset/`](.changeset/) – Changesets configuration for tracking package releases.

## Release & versioning

DTIF is published as an npm workspace that groups the schema (with bundled TypeScript declarations) and validator packages under a shared version. The
[Changesets](https://github.com/changesets/changesets) workflow powers automated changelog generation and release pull
requests:

- Run `npm run changeset` to document changes. The command prompts for the release type and writes a markdown entry under
  `.changeset/`.
- Run `npm run version-packages` locally to update package versions and regenerate changelog entries before publishing.
- CI uses [`changesets/action`](https://github.com/changesets/action) to open release pull requests and run `npm run release`
  once they land on `main`.

Repository-wide changes are documented in [`CHANGELOG.md`](CHANGELOG.md). Package-specific history lives alongside each
workspace:

- [`schema/CHANGELOG.md`](schema/CHANGELOG.md)
- [`validator/CHANGELOG.md`](validator/CHANGELOG.md)

## Contributing & community

Contributions follow the guidance in [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md), which is based on the [W3C Code of Ethics and Professional Conduct](https://www.w3.org/Consortium/cepc/). Discuss proposals in [GitHub Issues](https://github.com/bylapidist/dtif/issues) or [Discussions](https://github.com/bylapidist/dtif/discussions). Suggested changes to the registry or specification should reference the [governance processes](https://dtif.lapidist.net/governance/processes/).

## License

DTIF is distributed under the [MIT License](LICENSE). Portions derive from the [Design Tokens Community Group format specification](https://design-tokens.github.io/community-group/format/) and are restructured to describe a JSON-focused interchange format with an accompanying registry and conformance tooling.
