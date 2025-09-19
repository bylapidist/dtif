# DTIF changelog

This changelog records high-level repository changes. Package-specific updates are tracked in each workspace under
`schema/CHANGELOG.md` and `validator/CHANGELOG.md`.

## Unreleased

- Added first-class `fallbacks` stacks to `font` tokens for direct DTCG interoperability.
- Set up npm workspaces to manage the schema (with bundled TypeScript declarations) and validator packages together.
- Adopted Changesets for versioning with automated changelog generation and release PRs.
- Added GitHub Actions workflows for continuous integration and automated releases.
- Required package changelogs as part of the tooling assertions.
- Started the published `@lapidist/dtif-schema` and `@lapidist/dtif-validator` packages at version `0.1.0` for the initial release.
