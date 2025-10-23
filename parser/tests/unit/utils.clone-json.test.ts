import assert from 'node:assert/strict';
import test from 'node:test';

import { cloneJsonValue } from '../../src/utils/clone-json.js';
import {
  assertIsRecord,
  assertNullPrototypeDeep,
  toSerializable
} from '../helpers/json-assertions.js';

void test('clones __proto__ literals without mutating the global prototype', () => {
  const input: unknown = JSON.parse('{"__proto__":{"polluted":"nope"},"value":1}');
  assertIsRecord(input);
  const clone = cloneJsonValue(input);

  assertIsRecord(clone);

  assert.notEqual(clone, input);
  assert.deepEqual(toSerializable(clone), input);

  assert.equal(Reflect.getPrototypeOf(clone), null);
  assertNullPrototypeDeep(clone);
  assert.equal(Object.prototype.hasOwnProperty.call(clone, '__proto__'), true);

  const proto = Reflect.get(clone, '__proto__');

  assertIsRecord(proto);

  assert.equal(Reflect.getPrototypeOf(proto), null);
  assertNullPrototypeDeep(proto);
  assert.equal(proto.polluted, 'nope');
  assert.equal(Reflect.get(Object.prototype, 'polluted'), undefined);
});

void test('clones other magic keys while keeping prototypes isolated', () => {
  const input = {
    constructor: { message: 'ok' },
    prototype: { flag: true }
  };
  const clone = cloneJsonValue(input);

  assertIsRecord(clone);

  assert.notEqual(clone, input);
  assert.deepEqual(toSerializable(clone), input);
  assert.equal(Reflect.getPrototypeOf(clone), null);
  assertNullPrototypeDeep(clone);

  const constructorValue = Reflect.get(clone, 'constructor');

  assertIsRecord(constructorValue);
  assert.equal(Reflect.getPrototypeOf(constructorValue), null);
  assertNullPrototypeDeep(constructorValue);
  assert.equal(constructorValue.message, 'ok');

  const prototypeValue = Reflect.get(clone, 'prototype');

  assertIsRecord(prototypeValue);
  assert.equal(Reflect.getPrototypeOf(prototypeValue), null);
  assertNullPrototypeDeep(prototypeValue);
  assert.equal(prototypeValue.flag, true);
});
