# Testing Guide

Comprehensive guide to testing in the DTIF repository.

## Test Philosophy

DTIF maintains high code quality through comprehensive testing:
- All features require tests
- Bug fixes require regression tests
- Tests must pass before committing
- No test should be skipped or disabled without documented reason

## Test Structure

### Main Test Suite

Located in `tests/` at the repository root:
- **tooling/** - Test infrastructure and utilities
- **conformance/** - Schema conformance fixtures
- Test harness invoked by `npm test`

### Workspace-Specific Tests

Each workspace may have its own tests:
- **parser/tests/** - Parser-specific tests
- **language-server/tests/** - LSP server tests
- **validator/** - Validation tests (if separate from main suite)

## Running Tests

### Run All Tests

```bash
# Full test suite across all workspaces
npm test
```

This runs:
1. Snapshot serializer tests
2. Main test harness
3. Example validation tests

### Run Workspace Tests

```bash
# Parser tests
npm run --workspace parser test

# Language server tests
npm test --workspace=@lapidist/dtif-language-server
```

### Run Specific Test Files

```bash
# Using node directly (for test files in tests/)
node tests/tooling/snapshot-serializer.test.mjs

# For workspace-specific tests
cd parser && npm test -- <specific-test-file>
```

## Writing Tests

### Test File Naming

- Test files should clearly indicate what they test
- Use `.test.js`, `.test.mjs`, or `.test.ts` extension
- Place near the code they test when possible
- Use descriptive names: `color-token-validation.test.mjs`

### Test Structure

```javascript
// Import testing utilities
import { describe, it, assert } from 'your-test-framework';

describe('Feature or Component Name', () => {
  it('should behave in expected way', () => {
    // Arrange - set up test data
    const input = { /* test data */ };

    // Act - perform the operation
    const result = functionUnderTest(input);

    // Assert - verify the result
    assert.equal(result, expectedValue);
  });

  it('should handle edge case', () => {
    // Test edge cases, error conditions, boundary values
  });
});
```

### Test Coverage Guidelines

When writing tests, ensure coverage of:

1. **Happy Path**: Normal, expected usage
2. **Edge Cases**: Boundary conditions, empty inputs, null/undefined
3. **Error Cases**: Invalid inputs, malformed data
4. **Integration**: How components work together
5. **Regression**: Tests for previously fixed bugs

### Example-Based Testing

The repository includes schema-valid examples in `examples/`:
- Use these in tests to verify real-world scenarios
- Tests validate these examples: `npm run validate:dtif`
- Add new examples when adding features

## Schema Validation Testing

### Testing Schema Changes

When modifying `schema/core.json`:

1. **Update or add conformance tests** in `tests/`
2. **Run validation** against examples:
   ```bash
   npm run validate:dtif
   ```
3. **Verify generated types** are correct:
   ```bash
   npm run build:packages
   ```
4. **Test both valid and invalid cases**

### Example Valid Test Case

```json
{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "$version": "1.0.0",
  "color": {
    "primary": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.5, 0.5, 0.5]
      }
    }
  }
}
```

### Example Invalid Test Case

```json
{
  "$schema": "https://dtif.lapidist.net/schema/core.json",
  "$version": "1.0.0",
  "color": {
    "primary": {
      "$type": "color",
      "$value": {
        "colorSpace": "invalid-space",
        "components": [0.5, 0.5]  // Wrong number of components
      }
    }
  }
}
```

## Parser Testing

### Testing Resolution

When testing `@lapidist/dtif-parser`:

```javascript
import { createSession } from '@lapidist/dtif-parser';

it('should resolve token references', async () => {
  const session = createSession();
  const result = await session.parseDocument('path/to/tokens.json');

  // Check for errors
  assert.equal(result.diagnostics.hasErrors(), false);

  // Test resolution
  const resolution = result.resolver?.resolve('#/color/primary');
  assert.ok(resolution?.token);
  assert.equal(resolution.token.type, 'color');
});
```

### Testing Error Handling

```javascript
it('should report diagnostic for invalid reference', async () => {
  const session = createSession();
  const result = await session.parseDocument('invalid-tokens.json');

  assert.equal(result.diagnostics.hasErrors(), true);

  const errors = result.diagnostics.toArray();
  assert.ok(errors.some(e => e.message.includes('invalid reference')));
});
```

## Language Server Testing

When testing `@lapidist/dtif-language-server`:

```bash
# Build and test language server
npm run build --workspace=@lapidist/dtif-language-server
npm test --workspace=@lapidist/dtif-language-server
```

Test LSP features:
- **Diagnostics**: Error detection and reporting
- **Hover**: Documentation on hover
- **Go to Definition**: Navigation for $ref targets
- **Completion**: Suggestions for token types, units
- **Rename**: Refactoring support

## Validator Testing

Testing `@lapidist/dtif-validator`:

```javascript
import { validateDtif } from '@lapidist/dtif-validator';

it('should validate valid DTIF document', () => {
  const tokens = {
    $schema: 'https://dtif.lapidist.net/schema/core.json',
    $version: '1.0.0',
    color: {
      primary: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [1, 0, 0] }
      }
    }
  };

  const result = validateDtif(tokens);
  assert.equal(result.valid, true);
  assert.equal(result.errors, null);
});

it('should reject invalid document', () => {
  const tokens = { invalid: 'structure' };

  const result = validateDtif(tokens);
  assert.equal(result.valid, false);
  assert.ok(result.errors?.length > 0);
});
```

## Snapshot Testing

If using snapshot tests:

1. **Generate initial snapshot**: Run test to create baseline
2. **Review snapshot**: Ensure it captures correct behavior
3. **Commit snapshot**: Include in version control
4. **Update when needed**: Re-generate when behavior intentionally changes

```bash
# Update snapshots (if framework supports)
npm test -- --update-snapshots
```

## Testing Best Practices

### DO ✅

- **Write tests first** for new features (TDD)
- **Test edge cases** and error conditions
- **Use descriptive test names** that explain what's being tested
- **Keep tests isolated** - no dependencies between tests
- **Mock external dependencies** when appropriate
- **Clean up** after tests (files, connections, etc.)
- **Use meaningful assertions** with clear error messages

### DON'T ❌

- **Skip tests** without documenting why
- **Commit failing tests** - all tests must pass
- **Test implementation details** - test behavior instead
- **Write flaky tests** - tests should be deterministic
- **Leave debug code** in tests (console.log, etc.)
- **Make tests depend on order** - each test should be independent

## Debugging Test Failures

### Local Test Failures

```bash
# Run with verbose output
node tests/tooling/run.mjs --verbose

# Run single test file
node tests/specific-test.mjs

# Use Node debugger
node --inspect-brk tests/specific-test.mjs
```

### CI Test Failures

1. **Check CI logs** for full error output
2. **Reproduce locally** with same Node version (22)
3. **Check for environment differences** (paths, timing, etc.)
4. **Verify all dependencies** are installed: `npm ci`

### Common Issues

**Tests pass locally but fail in CI:**
- Check Node.js version matches (22)
- Run `npm ci` instead of `npm install` to match CI
- Look for hardcoded paths or timing assumptions

**Intermittent failures:**
- Race conditions in async code
- External dependencies (network, filesystem)
- Non-deterministic test data

**Type errors:**
- Run `npm run lint:ts` to catch before tests
- Ensure TypeScript config is consistent

## Test Coverage

While not currently enforced, aim for high coverage:
- **Critical paths**: 100% coverage
- **Error handling**: All error paths tested
- **Public APIs**: Comprehensive coverage
- **Edge cases**: Boundary conditions covered

## Continuous Integration

All tests run in CI on every push:
- Must pass before merge
- Runs on multiple Node.js versions (if configured)
- Includes linting and formatting checks

### CI Test Command

```bash
# Same command used in CI
npm ci
npm test
```

## Adding New Tests

When adding new test files:

1. **Place appropriately**: In `tests/` or workspace-specific directory
2. **Follow naming convention**: `feature-name.test.mjs`
3. **Import test utilities** consistently
4. **Add to test runner** if needed (check `tests/tooling/run.mjs`)
5. **Document complex test setups** with comments
6. **Verify in CI** after pushing

## Testing Checklist

Before committing:

- [ ] All tests pass: `npm test`
- [ ] Workspace tests pass (if applicable)
- [ ] No tests skipped without reason
- [ ] New features have tests
- [ ] Bug fixes have regression tests
- [ ] Test names are descriptive
- [ ] No debug code left in tests
- [ ] Tests are independent and deterministic
- [ ] Edge cases and error conditions tested
