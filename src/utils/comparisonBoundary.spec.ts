const assert = require('node:assert/strict');
const { isLessThan } = require('./comparisonBoundary.ts');
// This is a runtime oracle for the existing JavaScript operator, not a second implementation.
const nativeLessThan = new Function('left', 'right', 'return left < right;') as (a: unknown, b: unknown) => boolean;
const values: unknown[] = [
  undefined,
  null,
  false,
  true,
  NaN,
  Infinity,
  -Infinity,
  0,
  1,
  -2,
  2.5,
  '',
  '10',
  '2',
  '1.5',
  'invalid',
  [],
  [1],
  [10],
  [{}],
  0n,
  1n,
  9007199254740993n,
];
for (const left of values)
  for (const right of values) {
    assert.equal(isLessThan(left, right), nativeLessThan(left, right));
  }
const calls: unknown[] = [];
const left = {
  [Symbol.toPrimitive](hint: string) {
    calls.push(['left', hint, this === left]);
    return '10';
  },
};
const right = {
  valueOf() {
    calls.push(['right', this === right]);
    return '2';
  },
};
assert.equal(isLessThan(left, right), true, 'Two string primitives compare lexically');
assert.deepEqual(calls, [
  ['left', 'number', true],
  ['right', true],
]);
const invalid = { [Symbol.toPrimitive]: () => ({}) };
assert.throws(() => isLessThan(invalid, 1), TypeError);
assert.throws(() => isLessThan(Symbol('left'), 1), TypeError);
console.log('Mixed comparison preserves arrays, missing values, strings, BigInts and object receiver order');
