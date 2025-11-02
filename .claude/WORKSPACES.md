# Workspace Structure Guide

Understanding the DTIF monorepo architecture and workspace organization.

## Monorepo Architecture

DTIF uses **npm workspaces** to manage multiple related packages in a single repository. This provides:
- Shared dependencies and tooling
- Consistent versioning and release process
- Simplified cross-package development
- Unified testing and CI

## Workspace Overview

```
dtif/
├── schema/              # @lapidist/dtif-schema
├── validator/           # @lapidist/dtif-validator
├── parser/              # @lapidist/dtif-parser
├── language-server/     # @lapidist/dtif-language-server
├── docs/                # Documentation site (not published)
├── tests/               # Shared test infrastructure
├── examples/            # Schema-valid token examples
├── registry/            # Type and extension registry
└── scripts/             # Build and utility scripts
```

## Individual Workspaces

### 1. Schema (`schema/`)

**Package**: `@lapidist/dtif-schema`

**Purpose**: Canonical JSON Schema definition for DTIF

**Key files:**
- `core.json` - Main schema definition
- `index.d.ts` - Generated TypeScript declarations
- `README.md` - Package documentation
- `CHANGELOG.md` - Version history

**Development:**
```bash
# After modifying schema
npm run build:packages  # Regenerates TypeScript types
npm run validate:dtif   # Validates examples against schema
```

**When to modify:**
- Adding new token types
- Changing validation rules
- Updating schema metadata
- Adding new properties to token objects

**Dependencies:**
- None (core schema is self-contained)

**Dependents:**
- All other packages depend on schema

---

### 2. Validator (`validator/`)

**Package**: `@lapidist/dtif-validator`

**Purpose**: Programmatic validation utilities wrapping Ajv

**Key files:**
- `index.js` - Main validator export
- `README.md` - Usage documentation
- `CHANGELOG.md` - Version history

**Development:**
```bash
npm run build:packages  # Ensures validator uses latest schema
npm test                # Validation tests
```

**When to modify:**
- Changing validation behavior
- Adding validation utilities
- Updating error messages
- Configuring Ajv options

**Dependencies:**
- `@lapidist/dtif-schema` (direct)
- `ajv` and `ajv-formats`

**Dependents:**
- Parser uses for validation
- External tools use for validation

---

### 3. Parser (`parser/`)

**Package**: `@lapidist/dtif-parser`

**Purpose**: Streaming parser with token resolution and diagnostics

**Key files:**
- `src/` - Parser implementation (TypeScript)
- `cli/` - Command-line interface
- `tests/` - Parser-specific tests
- `README.md` - Package documentation
- `CHANGELOG.md` - Version history
- `tsconfig.json` - TypeScript configuration

**Development:**
```bash
cd parser/
npm run build         # Build TypeScript
npm test              # Run parser tests

# CLI usage
npx dtif-parse path/to/tokens.json --resolve "#/color/primary"
```

**When to modify:**
- Adding resolution features
- Improving diagnostic messages
- Adding CLI options
- Extending plugin system
- Optimizing performance

**Dependencies:**
- `@lapidist/dtif-schema` (direct)
- `@lapidist/dtif-validator` (for validation)

**Dependents:**
- Language server uses parser
- External build tools use parser

**Important**: Parser changes ALWAYS require a changeset

---

### 4. Language Server (`language-server/`)

**Package**: `@lapidist/dtif-language-server`

**Purpose**: LSP implementation for editor integration

**Key files:**
- `src/` - LSP server implementation
- `tests/` - Language server tests
- `README.md` - Client configuration guide
- `tsconfig.json` - TypeScript configuration

**Development:**
```bash
# Build and test
npm run build --workspace=@lapidist/dtif-language-server
npm test --workspace=@lapidist/dtif-language-server
```

**When to modify:**
- Adding LSP features (hover, completion, etc.)
- Improving diagnostics
- Adding quick fixes
- Extending editor integration

**Dependencies:**
- `@lapidist/dtif-parser` (uses parser for analysis)

**Dependents:**
- Editor extensions (VS Code, etc.)

---

### 5. Documentation (`docs/`)

**Not published as npm package**

**Purpose**: VitePress documentation site

**Key directories:**
- `.vitepress/` - Site configuration
- `spec/` - Specification content
- `guides/` - Implementation guides
- `examples/` - Example documentation
- `governance/` - Process documentation
- `public/` - Static assets

**Development:**
```bash
npm run docs:dev      # Start dev server at http://localhost:5173
npm run docs:build    # Build static site
npm run docs:preview  # Preview built site
npm run lint:docs     # Lint markdown in docs/
```

**When to modify:**
- Adding/updating specification content
- Writing guides
- Documenting new features
- Updating examples

**Deploy target**: https://dtif.lapidist.net

---

### 6. Tests (`tests/`)

**Not a workspace package**

**Purpose**: Shared test infrastructure and conformance fixtures

**Structure:**
- `tooling/` - Test harness and utilities
  - `run.mjs` - Main test runner
  - `snapshot-serializer.test.mjs` - Snapshot testing utilities
  - `validate-examples.mjs` - Example validation
- Conformance fixtures and test cases

**Running:**
```bash
npm test  # Runs all tests via tooling/run.mjs
```

---

### 7. Examples (`examples/`)

**Not a workspace package**

**Purpose**: Schema-valid token documents for testing and documentation

**Contents:**
- Reference token files
- Edge case examples
- Integration examples

**Validation:**
```bash
npm run validate:dtif  # Validates all examples against schema
```

**When to add:**
- Demonstrating new features
- Providing test fixtures
- Documenting usage patterns

---

### 8. Registry (`registry/`)

**Not a workspace package**

**Purpose**: Canonical list of token types and extension namespaces

**Contents:**
- Official `$type` identifiers
- Registered extension namespaces
- Type definitions

**When to modify:**
- Adding new token types (rare - requires governance)
- Registering extensions
- Updating type metadata

---

### 9. Scripts (`scripts/`)

**Not a workspace package**

**Purpose**: Build automation and utilities

**Key scripts:**
- `build-packages.mjs` - Builds schema + validator
- `validate-markdown-dtif.mjs` - Validates DTIF in markdown

**Usage:**
```bash
npm run build:packages  # Uses scripts/build-packages.mjs
npm run validate:dtif   # Uses scripts/validate-markdown-dtif.mjs
```

## Workspace Dependencies

```
schema (base)
  ↓
validator
  ↓
parser
  ↓
language-server
```

- Changes to **schema** affect all downstream packages
- Changes to **validator** affect parser and language-server
- Changes to **parser** affect language-server

## Cross-Workspace Development

### Making Changes Across Multiple Workspaces

When a change spans workspaces:

1. **Start with the lowest-level workspace** (schema first)
2. **Build incrementally** - verify each workspace builds
3. **Create separate changesets** for each affected package
4. **Test the entire chain** - run all workspace tests
5. **Commit atomically** - one commit per logical change

### Example: Adding a New Token Type

1. **schema/**: Update `core.json` with new type definition
   ```bash
   npm run build:packages
   ```

2. **tests/**: Add conformance tests for new type
   ```bash
   npm test
   ```

3. **parser/**: Add parsing support if needed
   ```bash
   npm run --workspace parser test
   npm run changeset  # Select @lapidist/dtif-parser
   ```

4. **docs/**: Document the new type
   ```bash
   npm run docs:dev  # Preview changes
   npm run lint:docs
   ```

5. **Create changesets** for schema and parser
   ```bash
   npm run changeset  # For schema
   npm run changeset  # For parser
   ```

## Workspace Commands

### Install Dependencies

```bash
# All workspaces
npm install

# Specific workspace
npm install --workspace=@lapidist/dtif-parser <package>
```

### Run Scripts

```bash
# All workspaces
npm run <script>

# Specific workspace
npm run <script> --workspace=@lapidist/dtif-parser
npm test --workspace=@lapidist/dtif-language-server
```

### Build

```bash
# Schema and validator
npm run build:packages

# Parser
cd parser && npm run build

# Language server
npm run build --workspace=@lapidist/dtif-language-server

# Documentation
npm run docs:build
```

### Link for Local Development

```bash
# In consuming project
npm link ../dtif/parser
npm link ../dtif/validator
```

## Package Publishing

Packages are published via Changesets:
- **Published packages**: schema, validator, parser, language-server
- **Unpublished**: docs, examples, registry (repo-only)

### Version Management

All published packages follow:
- **Strict semantic versioning**
- **Synchronized releases** via changesets
- **Individual CHANGELOGs** per package

## Workspace Conventions

### File Structure

Each workspace should have:
- `README.md` - Package documentation
- `CHANGELOG.md` - Version history (published packages)
- `package.json` - Package metadata
- `LICENSE` - Inherited from root or explicit

### TypeScript Workspaces

Parser and language-server use TypeScript:
- Individual `tsconfig.json` per workspace
- Root `tsconfig.eslint.json` for linting
- Build to `dist/` or similar

### Testing Strategy

- Workspace-specific tests in workspace `tests/` directory
- Shared test infrastructure in root `tests/`
- All tests run via `npm test` from root

## Troubleshooting

### Workspace Not Found

```bash
# Ensure workspace is listed in root package.json
npm ls --workspace=@lapidist/dtif-parser
```

### Dependency Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Build Issues

```bash
# Rebuild packages in dependency order
npm run build:packages
cd parser && npm run build
npm run build --workspace=@lapidist/dtif-language-server
```

## Best Practices

1. **Work from lowest to highest** in dependency chain
2. **Test workspace isolation** - ensure workspace tests pass independently
3. **Maintain consistent tooling** - use root scripts when possible
4. **Document cross-workspace impacts** in commit messages
5. **Create appropriate changesets** for each affected published package
6. **Keep workspaces focused** - single responsibility per workspace
