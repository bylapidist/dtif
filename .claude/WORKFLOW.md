# Development Workflow Guide

This guide provides step-by-step workflows for common development tasks in the DTIF repository.

## Pre-Flight Checklist

Before starting ANY development work:

1. Ensure Node.js 22 is installed: `node --version`
2. Install/update dependencies: `npm install`
3. Verify your current branch: `git branch --show-current`
4. Check workspace status: `git status`

## Making Code Changes

### Step 1: Identify Your Workspace

Determine which workspace(s) you'll be modifying:
- `schema/` - JSON Schema definitions
- `validator/` - Validation utilities
- `parser/` - Parser implementation
- `language-server/` - LSP server
- `docs/` - Documentation
- `tests/` - Test fixtures
- Root - Infrastructure, tooling, CI

### Step 2: Make Your Changes

Follow these principles:
- Keep changes atomic and focused
- Prefer editing existing files over creating new ones
- Maintain consistent code style (Prettier handles this)
- Add tests for new functionality
- Update documentation if adding features

### Step 3: Run Incremental Checks

As you work, run relevant checks:

```bash
# Format your changes
npm run format

# If you touched TypeScript/JavaScript
npm run lint:ts

# If you modified schema or validator
npm run build:packages

# If you changed parser
npm run --workspace parser test

# Run all tests
npm test
```

### Step 4: Pre-Commit Validation

**Required checks before committing:**

```bash
# 1. Format check
npm run format:check

# 2. Markdown linting
npm run lint

# 3. TypeScript linting (if you touched .js/.ts files)
npm run lint:ts

# 4. All tests
npm test

# 5. Conditional checks based on what you changed:

# Changed language-server/?
npm run build --workspace=@lapidist/dtif-language-server
npm test --workspace=@lapidist/dtif-language-server

# Changed docs/?
npm run lint:docs
npm run docs:build  # If you touched .vitepress/ or static content

# Changed parser/?
npm run --workspace parser test

# Changed schema/ or validator/?
npm run build:packages
```

### Step 5: Create Changeset (If Required)

**When to create a changeset:**
- Any user-visible feature or bug fix
- Changes to parser/ (ALWAYS)
- Changes to schema/ API
- Changes to validator/ API

**How to create:**

```bash
npm run changeset
```

Follow the interactive prompts:
1. Select affected packages (use spacebar, then enter)
2. Choose semver bump type:
   - **patch**: Bug fixes, no API changes
   - **minor**: New features, backward-compatible
   - **major**: Breaking changes
3. Write a concise summary of the change

Example changeset summary:
```
Add support for custom color spaces in color tokens
```

### Step 6: Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with conventional commit message
git commit -m "feat(parser): add custom color space resolution

Extends the parser to handle registry-defined color spaces
beyond the core sRGB/Display-P3 options.

Includes comprehensive test coverage and documentation updates."
```

**Commit message format:**
- `feat(scope)`: New feature
- `fix(scope)`: Bug fix
- `docs(scope)`: Documentation only
- `test(scope)`: Adding missing tests
- `refactor(scope)`: Code change that neither fixes a bug nor adds a feature
- `chore(scope)`: Changes to build process or auxiliary tools

**Common scopes:**
- `parser`, `schema`, `validator`, `language-server`, `docs`, `ci`, `tests`

### Step 7: Push Your Changes

```bash
# Push to your feature branch
git push -u origin <branch-name>
```

## Specific Task Workflows

### Adding a New Token Type

1. Update schema in `schema/core.json`
2. Run `npm run build:packages` to regenerate TypeScript types
3. Add validation tests in `tests/`
4. Update parser if needed in `parser/`
5. Update documentation in `docs/spec/`
6. Create changeset for schema and validator
7. Run full test suite
8. Commit with `feat(schema): add <type> token type`

### Fixing a Bug

1. Write a failing test that reproduces the bug
2. Fix the bug in the relevant workspace
3. Verify the test now passes
4. Run full test suite
5. Create changeset (patch bump)
6. Commit with `fix(<workspace>): <description>`

### Updating Documentation

1. Edit relevant files in `docs/`
2. Test locally: `npm run docs:dev`
3. Run `npm run lint:docs`
4. Run `npm run docs:build` if you changed build config
5. Commit with `docs(<scope>): <description>`
6. No changeset needed for docs-only changes

### Refactoring Code

1. Ensure tests pass before refactoring: `npm test`
2. Make refactoring changes
3. Verify tests still pass
4. Run all quality checks
5. No changeset needed if behavior unchanged
6. Commit with `refactor(<scope>): <description>`

### Adding Tests

1. Add test files or extend existing tests
2. Run relevant test command to verify
3. Run full test suite: `npm test`
4. Commit with `test(<scope>): <description>`
5. No changeset needed for test-only additions

## Common Pitfalls to Avoid

### ❌ Don't Do This

- Commit without running all required checks
- Create changesets for non-user-facing changes (docs, tests, refactors)
- Bundle multiple unrelated changes in one commit
- Disable linting rules with inline comments
- Push code that doesn't pass `npm test`
- Skip formatting: always run `npm run format`
- Forget to run `npm run build:packages` after schema changes

### ✅ Do This

- Run all checks before committing
- Create atomic, focused commits
- Write clear, descriptive commit messages
- Fix linting issues properly (don't suppress)
- Test incrementally as you work
- Create changesets for user-facing changes
- Keep schema and generated artifacts in sync
- Update documentation alongside code changes

## Emergency Fixes

If you discover a critical issue:

1. Create a hotfix branch from main
2. Make minimal changes to fix the issue
3. Run full test suite
4. Create changeset with patch bump
5. Commit with `fix(<scope>): <critical issue description>`
6. Open PR immediately with "HOTFIX" label

## Getting Unstuck

### Build Failures

```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build:packages
```

### Test Failures

```bash
# Run specific workspace tests
npm test --workspace=<workspace-name>

# Run with verbose output
npm test -- --verbose
```

### Formatting Issues

```bash
# Auto-fix formatting
npm run format

# Then verify
npm run format:check
```

### Linting Errors

```bash
# See all lint errors
npm run lint:ts

# Fix auto-fixable issues
npx eslint . --fix
```

## Review Checklist

Before opening a PR, verify:

- [ ] All tests pass: `npm test`
- [ ] Code is formatted: `npm run format:check`
- [ ] No lint errors: `npm run lint && npm run lint:ts`
- [ ] Changesets created for user-facing changes
- [ ] Documentation updated if needed
- [ ] Commit messages follow Conventional Commits
- [ ] Changes are focused and atomic
- [ ] No debugging code or console.logs left behind
