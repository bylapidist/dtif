# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) to version the published npm packages.

- Run `npm run changeset` to record a change. Choose the appropriate bump type and describe the change in the generated
  markdown file.
- Run `npm run version-packages` to apply pending changesets locally. This updates package versions and changelog entries.
- Run `npm run release` (in CI) to publish the updated packages to npm. The provided GitHub Actions workflow creates release PRs
  and handles publishing when `NPM_TOKEN` is configured.

Changesets keeps the schema, types, and validator packages on the same version via a fixed release group in
[`.changeset/config.json`](./config.json).
