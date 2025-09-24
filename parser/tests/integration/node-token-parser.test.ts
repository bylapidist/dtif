import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DtifTokenParseError,
  parseTokensFromFile,
  readTokensFile
} from '../../src/adapters/node/token-parser.js';

const VALID_FIXTURE = new URL('../fixtures/node/valid.tokens.json', import.meta.url);
const INVALID_FIXTURE = new URL('../fixtures/node/invalid.tokens.json', import.meta.url);

test('parseTokensFromFile returns flattened tokens for supported files', async () => {
  const diagnostics: unknown[] = [];
  const result = await parseTokensFromFile(VALID_FIXTURE, {
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    onWarn: () => {
      throw new Error('did not expect warnings for valid document');
    }
  });

  assert.equal(
    result.diagnostics.length,
    diagnostics.length,
    'expected diagnostic callback to mirror result'
  );
  assert.equal(result.flattened.length, 1, 'expected a flattened token to be returned');
  assert.equal(result.flattened[0]?.name, 'primary');
});

test('parseTokensFromFile rejects unsupported file extensions', async () => {
  await assert.rejects(
    parseTokensFromFile('tokens.json'),
    /Unsupported design tokens file/,
    'expected unsupported extensions to throw'
  );
});

test('parseTokensFromFile throws DtifTokenParseError for invalid documents', async () => {
  await assert.rejects(parseTokensFromFile(INVALID_FIXTURE), (error: unknown) => {
    assert.ok(error instanceof DtifTokenParseError, 'expected DtifTokenParseError instance');
    assert.ok(error.message.includes('Failed to parse DTIF document'));
    assert.ok(error.diagnostics.length > 0, 'expected diagnostics on error');
    const formatted = error.format();
    assert.ok(formatted.includes('Failed to parse DTIF document'));
    return true;
  });
});

test('readTokensFile returns parsed DTIF contents', async () => {
  const document = await readTokensFile(VALID_FIXTURE);
  assert.equal(typeof document, 'object');
  const colors = (document as Record<string, unknown>).colors as Record<string, any> | undefined;
  assert.ok(colors?.brand?.primary);
  assert.equal(colors.brand.primary.$type, 'color');
});
