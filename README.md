# Design Token Interchange Format (DTIF)

[![CI](https://img.shields.io/github/actions/workflow/status/bylapidist/dtif/ci.yml?branch=main&label=CI)](https://github.com/bylapidist/dtif/actions/workflows/ci.yml)
[![Schema Tests](https://img.shields.io/badge/schema%20tests-passing-brightgreen)](tests/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Status:** Editor's Draft · [Read the documentation](https://dtif.lapidist.net)

<img src="./docs/public/dtif-logo.svg" alt="DTIF logo" width="72" />

DTIF is a vendor-neutral JSON specification for exchanging design tokens—colour, typography, spacing, motion, and more—between design tools and codebases. It standardises how tokens are described and referenced without dictating how they are authored or consumed.

Use DTIF when you need:

- a single, versioned definition of design tokens that designers and engineers can share;
- predictable token payloads validated by an official JSON Schema; and
- a registry-backed naming system that keeps custom extensions interoperable.

## Documentation

Browse the deployed documentation at **[dtif.lapidist.net](https://dtif.lapidist.net)**. Key sections include:

- [Specification](https://dtif.lapidist.net/spec/) – normative chapters covering the format, token types, and conformance rules.
- [Guides](https://dtif.lapidist.net/guides/) – implementation playbooks and tooling workflows.
- [Examples](https://dtif.lapidist.net/examples/) – schema-valid token documents you can reuse in tests.
- [Governance](https://dtif.lapidist.net/governance/) – processes for proposing changes and managing the registry.
- [Roadmap](https://dtif.lapidist.net/roadmap/) – current focus areas and forward-looking drafts.

## Quick example

```jsonc
{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "$version": "1.0.0",
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
  },
  "button": {
    "background": {
      "$type": "color",
      "$ref": "#/color/brand/primary"
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
   npx ajv validate --spec=draft2020 --strict=false -c ajv-formats \
     -s schema/core.json -d path/to/tokens.json
   ```

   Load `schema/core.json` with [Ajv](https://ajv.js.org/) or another JSON Schema validator if you want to integrate validation into your build pipeline.

3. **Exercise the project checks**

   ```bash
   npm run lint
   npm test
   npm run docs:dev   # optional: preview the docs locally
   ```

## Repository reference

- [`schema/`](schema/) – JSON Schema definitions used by validators.
- [`examples/`](examples/) – schema-valid token sets shared across docs and tests.
- [`registry/`](registry/) – the canonical list of `$type` identifiers and extension namespaces.
- [`tests/`](tests/) – conformance fixtures and the test harness invoked by CI.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) – contribution workflow, coding standards, and release process expectations.

## Contributing & community

Contributions follow the guidance in [CONTRIBUTING.md](CONTRIBUTING.md) and the [W3C Code of Conduct](https://www.w3.org/Consortium/cepc/). Discuss proposals in [GitHub Issues](https://github.com/bylapidist/dtif/issues) or [Discussions](https://github.com/bylapidist/dtif/discussions). Suggested changes to the registry or specification should reference the [governance processes](https://dtif.lapidist.net/governance/processes/).

## License

DTIF is distributed under the [MIT License](LICENSE). Portions derive from the [Design Tokens Community Group format specification](https://design-tokens.github.io/community-group/format/) and are restructured to describe a JSON-focused interchange format with an accompanying registry and conformance tooling.
