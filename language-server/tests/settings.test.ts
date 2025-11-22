import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS, parseSettings } from '../src/settings.js';

void test('parseSettings returns defaults with a warning for non-object payloads', () => {
  const result = parseSettings(null);
  assert.deepEqual(result.settings, DEFAULT_SETTINGS);
  assert.deepEqual(result.warnings, [
    'Expected dtifLanguageServer settings to be an object; using defaults.'
  ]);
});

void test('parseSettings falls back to on with descriptive warnings for invalid validation mode', () => {
  const result = parseSettings({ validation: { mode: 'maybe' } });
  assert.deepEqual(result.settings, { validation: { mode: 'on' } });
  assert.deepEqual(result.warnings, [
    'validation.mode must be "on" or "off" (received "maybe"); using "on".'
  ]);
});

void test('parseSettings preserves valid validation mode values', () => {
  const offResult = parseSettings({ validation: { mode: 'off' } });
  assert.deepEqual(offResult.settings, { validation: { mode: 'off' } });
  assert.deepEqual(offResult.warnings, []);

  const onResult = parseSettings({ validation: { mode: 'on' } });
  assert.deepEqual(onResult.settings, { validation: { mode: 'on' } });
  assert.deepEqual(onResult.warnings, []);
});
