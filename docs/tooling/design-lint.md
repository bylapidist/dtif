---
title: Design Lint
description: Lint DTIF-aware codebases with the @lapidist/design-lint CLI.
keywords:
  - linting
  - design lint
  - dtif
outline: [2, 3]
---

# Design Lint {#design-lint}

[`@lapidist/design-lint`](https://design-lint.lapidist.net) is a DTIF-native command-line
linter. It parses token documents with the same schema guarantees as the specification
and applies rule sets tuned for component libraries, CSS authoring, and framework-driven
design system work.

## What Design Lint validates {#what-design-lint-checks}

The linter focuses on aligning source tokens with product code:

- Parse DTIF documents so colour, typography, spacing, and motion tokens retain their
  canonical structure.
- Enforce naming conventions and token usage across React, Vue, Svelte, and other common
  front-end stacks.
- Surface granular diagnostics that explain why a file failed and how to resolve the
  mismatch.
- Offer deterministic formatter output so teams can adopt autofix workflows safely.

## Get started quickly {#getting-started}

Design Lint ships as an npm package that targets Node.js 22 and above. To try it
immediately, run:

```bash
npx design-lint .
```

For long-term adoption, install it locally and scaffold a configuration file:

```bash
npm install --save-dev @lapidist/design-lint
npx design-lint init
```

The initializer creates `designlint.config.json` so you can opt into the rule sets that
match your stack. Lint specific directories or glob patterns once the configuration is in
place:

```bash
npx design-lint "src/**/*"
```

Pass `--fix` when you want the CLI to apply formatter-backed fixes, and keep CI runs in
read-only mode so pull requests fail if manual intervention is required.

## Integrate with automation {#automation}

Teams can build richer workflows on top of Design Lint's subcommands and caching:

- `npx design-lint validate` confirms configurations and tokens parse before linting.
- `npx design-lint tokens --out tokens.json` exports flattened DTIF tokens for follow-on
  build steps.
- `--watch` mode reruns linting as files change, while the `.designlintcache` directory
  keeps feedback fast locally and in CI caches.

Adopt these recipes alongside existing task runners, GitHub Actions, or other CI/CD
providers to keep design and engineering deliverables in sync.
