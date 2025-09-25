import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DtifTokenParseError,
  parseTokensFromFile,
  readTokensFile
} from '../../src/adapters/node/token-parser.js';

const VALID_FIXTURE = new URL('../fixtures/node/valid.tokens.json', import.meta.url);
const INVALID_FIXTURE = new URL('../fixtures/node/invalid.tokens.json', import.meta.url);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

void test('parseTokensFromFile returns flattened tokens for supported files', async () => {
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

void test('parseTokensFromFile rejects unsupported file extensions', async () => {
  await assert.rejects(
    parseTokensFromFile('tokens.json'),
    /Unsupported design tokens file/,
    'expected unsupported extensions to throw'
  );
});

void test('parseTokensFromFile throws DtifTokenParseError for invalid documents', async () => {
  await assert.rejects(parseTokensFromFile(INVALID_FIXTURE), (error: unknown) => {
    assert.ok(error instanceof DtifTokenParseError, 'expected DtifTokenParseError instance');
    assert.ok(error.message.includes('Failed to parse DTIF document'));
    assert.ok(error.diagnostics.length > 0, 'expected diagnostics on error');
    const formatted = error.format();
    assert.ok(formatted.includes('Failed to parse DTIF document'));
    return true;
  });
});

void test('readTokensFile returns parsed DTIF contents', async () => {
  const document = await readTokensFile(VALID_FIXTURE);
  assert.ok(isRecord(document), 'expected document to be an object');

  const colors = document.colors;
  assert.ok(isRecord(colors), 'expected document to expose a colors record');

  const brand = colors.brand;
  assert.ok(isRecord(brand), 'expected colors.brand to be an object');

  const primary = brand.primary;
  assert.ok(isRecord(primary), 'expected colors.brand.primary to be a token object');
  const tokenType = primary.$type;
  assert.equal(typeof tokenType, 'string', 'expected token type to be a string');
  assert.equal(tokenType, 'color');
});
