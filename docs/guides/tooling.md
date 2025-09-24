---
title: Tooling integration
description: Expectations for design tools, build pipelines, and linting when working with DTIF documents.
keywords:
  - tooling
  - dtif
  - build
  - linting
outline: [2, 3]
---

# Tooling integration {#tooling-integration}

This guide offers non-normative expectations for exporters, build tooling, and linting workflows.

## Design tools {#design-tools}

Exporters _SHOULD_ generate deterministic identifiers, timestamps,
and names. Token names _SHOULD_ use slash‑separated paths.

## Build tools {#build-tools}

Transformers _MAY_ map tokens to CSS variables, platform constants,
or other configuration files. When converting units, tools
_SHOULD_ honour platform conventions such as `px` to
`dp` on Android and `pt` on iOS. Install
[`@lapidist/dtif-schema`](https://www.npmjs.com/package/@lapidist/dtif-schema)
to validate inputs and consume the bundled TypeScript declarations, and use
[`@lapidist/dtif-validator`](https://www.npmjs.com/package/@lapidist/dtif-validator)
when you need a preconfigured Ajv instance inside CI or build steps.

## Linting {#linting}

Linting tools _SHOULD_ warn on unknown `$type` values,
unsupported units, and deprecated tokens. Warnings
_SHOULD NOT_ fail builds by default.

[Design Lint](https://design-lint.lapidist.net) ships as an npm package
(`@lapidist/design-lint`). It parses DTIF payloads with the
canonical schema, enforces rule sets tailored to component libraries and CSS authoring,
and emits deterministic diagnostics and formatter output for both local development and
CI pipelines.
