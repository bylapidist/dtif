import assert from 'node:assert/strict';
import test from 'node:test';

import { cloneJsonValue } from '../../src/utils/clone-json.js';
import { assertNullPrototypeDeep, toSerializable } from '../helpers/json-assertions.js';

void test('clones __proto__ literals without mutating the global prototype', () => {
  const input = JSON.parse('{"__proto__":{"polluted":"nope"},"value":1}') as Record<
    string,
    unknown
  >;
  const clone = cloneJsonValue(input) as Record<string, unknown>;

  assert.notEqual(clone, input);
  assert.deepEqual(toSerializable(clone), input);

  assert.equal(Reflect.getPrototypeOf(clone), null);
  assertNullPrototypeDeep(clone);
  assert.equal(Object.prototype.hasOwnProperty.call(clone, '__proto__'), true);

  const proto = clone['__proto__'] as Record<string, unknown>;

  assert.equal(Reflect.getPrototypeOf(proto), null);
  assertNullPrototypeDeep(proto);
  assert.equal(proto.polluted, 'nope');
  assert.equal((Object.prototype as Record<string, unknown>).polluted, undefined);
});

void test('clones other magic keys while keeping prototypes isolated', () => {
  const input = {
    constructor: { message: 'ok' },
    prototype: { flag: true }
  } as const;
  const clone = cloneJsonValue(input) as Record<string, unknown>;

  assert.notEqual(clone, input);
  assert.deepEqual(toSerializable(clone), input);
  assert.equal(Reflect.getPrototypeOf(clone), null);
  assertNullPrototypeDeep(clone);

  const constructorValue = clone['constructor'] as Record<string, unknown>;
  assert.equal(Reflect.getPrototypeOf(constructorValue), null);
  assertNullPrototypeDeep(constructorValue);
  assert.equal(constructorValue.message, 'ok');

  const prototypeValue = clone['prototype'] as Record<string, unknown>;
  assert.equal(Reflect.getPrototypeOf(prototypeValue), null);
  assertNullPrototypeDeep(prototypeValue);
  assert.equal(prototypeValue.flag, true);
});
