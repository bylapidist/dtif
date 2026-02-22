# Contributing to DTIF

Thanks for your interest in improving the Design Token Interchange Format. This guide walks you through setting up a local
environment, running project tasks, and preparing contributions.

## Prerequisites

- **Node.js 22 or newer** - the CI pipeline runs on Node 22; use Node 22 or any newer major version locally to avoid incompatibilities. Tools like
  [`nvm`](https://github.com/nvm-sh/nvm) or [`fnm`](https://github.com/Schniz/fnm) make switching versions easy.
- **pnpm 10** or newer - install with `corepack enable` and `corepack prepare pnpm@10.17.1 --activate`.
- **Git** - for cloning the repository and managing branches.

## Initial setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/bylapidist/dtif.git
   cd dtif
   ```

2. **Install JavaScript dependencies**

   ```bash
   pnpm install
   ```

   Use `pnpm install --frozen-lockfile` when you want a clean, lockfile-driven install (for example, in CI or scripted
   environments).

3. **Verify the installation**

   Run the automated checks once to ensure your environment is working end-to-end:

   ```bash
   pnpm run format:check
   pnpm run lint
   pnpm test
   ```

   - `pnpm run format:check` confirms Prettier settings are honoured.
   - `pnpm run lint` runs `markdownlint` across Markdown sources.
   - `pnpm test` exercises the schema tooling and validates example token files.

## Project layout highlights

- `registry/` - namespaced type registry definitions.
- `tests/` - tooling tests, fixtures, and scripts executed via `pnpm test`.

## Development workflow

Use the following loop while working on changes:

1. **Make edits** in the relevant directories.
2. **Format and lint** modified files before committing:

   ```bash
   pnpm run format
   pnpm run lint
   ```

   `pnpm run format` applies Prettier across JSON and Markdown files. Commit the formatted results rather than editing generated
   output manually.

3. **Run the tests**:

   ```bash
   pnpm test
   ```

4. **Review git status** to confirm only intentional files are staged:

   ```bash
   git status
   ```

5. **Commit with clear messages** and open a pull request once all checks pass.

## Release process

The repository is managed as a pnpm workspace. The schema package (which
bundles TypeScript declarations) and the validator package share a version
through [Changesets](https://github.com/changesets/changesets).

1. Run `pnpm run changeset` to record every user-visible change. Choose the bump type requested by the CLI and describe the
   change. This writes a markdown file under `.changeset/`.
2. When preparing a release, run `pnpm run version-packages` locally to apply pending changesets. This updates package versions
   and changelog entries in `schema/` and `validator/`.
3. Merge the resulting pull request. The [`Release`](.github/workflows/release.yml) workflow promotes the changes by creating a
   release PR or publishing to npm once `NPM_TOKEN` is configured.

All packages must maintain `CHANGELOG.md` files. Tooling assertions fail if they are missing, ensuring every release documents
the shipped changes.

## Style guidelines

- Use Prettier for JSON and Markdown formatting.
- Run `pnpm run format` before each commit to apply the project formatting rules.
- `markdownlint` enforces prose conventions.
- Normative language SHOULD use [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) keywords.

## Code of Conduct

This project follows the [W3C Code of Conduct](https://www.w3.org/Consortium/cepc/). By participating you agree to uphold it.

## How to contribute

- Discuss ideas in [GitHub Discussions](https://github.com/bylapidist/dtif/discussions).
- Report bugs or propose features in [Issues](https://github.com/bylapidist/dtif/issues).
- For significant changes, open a draft pull request early to gather feedback.
