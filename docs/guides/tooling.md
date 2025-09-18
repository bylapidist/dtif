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
`dp` on Android and `pt` on iOS.

## Linting {#linting}

Linting tools _SHOULD_ warn on unknown `$type` values,
unsupported units, and deprecated tokens. Warnings
_SHOULD NOT_ fail builds by default.
