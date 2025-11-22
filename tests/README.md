# Test Fixtures

This directory hosts conformance fixtures for the DTIF specification.  
Each fixture exercises a feature or edge case of the spec and is described by a `meta.yaml` file alongside the input and expected output.

Run all fixtures with:

```bash
node tests/tooling/run.mjs
```

Before traversing fixtures, the harness runs two preflight checks:

- `assert-packages` verifies that the `schema`, `validator`, and `parser` packages contain required metadata, exports, version alignment, dependencies, changelogs/READMEs, and that generated typings stay in sync with `schema/core.json`.
- `assert-validator-defaults` ensures `createDtifValidator` ships Ajv with strict mode and `$data` references enabled, union types disallowed, and still validates the minimal example tokens bundle.

The harness validates fixtures against `schema/core.json`, resolves `$ref` pointers (blocking remote fetches unless a fixture opts in), and performs basic type compatibility checks for `FunctionValue` expressions such as `calc()` unit mixing and `clamp()` range ordering before comparing normalised output with the expected snapshot.
It also verifies that every built-in `$type` defined by the schema has a fully populated entry in `registry/types.json`, that the registry metadata is well-formed, and that entries remain sorted for reproducible diffs.

These checks run automatically in GitHub Actions via `.github/workflows/ci.yml`.

Current coverage includes primitive edge values, reference aliasing and cycle detection, valid nested `clamp()` usage, gradient tokens, validation of alias pointers inside `calc()` parameter lists with type compatibility enforcement, numeric precision guardrails, opt-in remote reference fixtures that exercise both relative and absolute HTTP(S) pointers while keeping them disabled by default, remote reference scheme validation, path traversal blocking, CSS and iOS snapshot generation, and valid as well as invalid `calc()` FunctionValue expressions. Property-based fuzzing and targeted mutation utilities are scaffolded for future expansion.

Additional fixtures cover boundary and error conditions such as:

- Dimensions that exceed numeric ranges, which fail round‑trip serialization.
- Units provided as numbers, which fail schema validation.
- Dimension tokens that enforce category-specific units and reverse-DNS namespaces for custom measurements.
- Override entries with `$token` paths attempting directory traversal, which are rejected.
- Typography tokens that accept boundary values like `lineHeight: 0` and negative `letterSpacing` values.
- Motion timelines that enforce keyframe coverage (`t=0` start, `t=1` end, normalised keyframe range), easing pointer types, and rotation origin bounds for motion tokens.
- Metadata hygiene enforcing trimmed `$author` and `$tags` fields, unique tag entries, whitespace-free `$hash` identifiers, `$lastUsed` dates that do not precede `$lastModified`, and `$usageCount` / `$lastUsed` pairings that stay in sync while `$deprecated` replacements resolve to tokens with matching `$type` declarations.
- Component slot aliases that must not resolve to other component tokens, preserving primitive slot composition.

Run the fixture suite to verify all cases:

```bash
node tests/tooling/run.mjs
```

All positive fixtures should pass schema, reference resolution, and type compatibility checks, while negative fixtures report the expected error in `expected.error.json`.
