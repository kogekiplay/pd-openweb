const assert = require('node:assert/strict');
const { applySavedCredit, applyStreamCredit, getSavedTurnPrice, getStreamPrice, sumPrice } =
  require('./creditPrice.ts') as typeof import('./creditPrice');

assert.equal(sumPrice([0.0187, 0.0093]), 0.028);
const frames = [{ price: 0.01 }, { price: 0.01 }, { price: 0.02 }, { price: 0.01 }];
assert.equal(
  frames.reduce((previous, usage) => getStreamPrice(previous, usage), 0),
  0.02,
);
assert.equal(getStreamPrice(0.02, { price: '0.03' }), 0.03);
assert.equal(getStreamPrice(0.02, null), 0.02);
const messages = [
  { role: 'assistant', ctime: 6, metadata: { id: 'b', price: 9 } },
  { role: 'assistant', ctime: 3, metadata: { id: 'a2', price: 0.0093 } },
  { role: 'user', ctime: 1 },
  { role: 'assistant', ctime: 2, metadata: { id: 'a1', price: 0.0187 } },
  { role: 'tool', ctime: 4, metadata: { price: 100 } },
  { role: 'user', ctime: 5 },
];
assert.equal(getSavedTurnPrice(messages, 'a2'), 0.028, 'Only model messages in the same turn count');
assert.equal(getSavedTurnPrice(messages, 'b'), 9, 'Later turns stay separate');
assert.equal(getSavedTurnPrice(messages, 'missing'), 0, 'Missing persisted message preserves streaming fallback');
assert.equal(getSavedTurnPrice(null, 'a2'), 0);
assert.equal(getSavedTurnPrice([null, 3, {}], 'a2'), 0);
const ui = [
  { id: 'q', role: 'user', content: 'Question' },
  { id: 'answer', role: 'assistant', modelMessageId: 'a2', content: 'Answer', price: 0.02 },
];
const streaming = applyStreamCredit(ui, 'resume-id', 0.023);
assert.equal(streaming[1]?.price, 0.023, 'Tool continuation updates the existing assistant bubble');
assert.equal(streaming[0], ui[0], 'The user message and its content remain intact');
assert.equal(ui[1]?.price, 0.02, 'Credit updates preserve the prior state');
assert.equal(applySavedCredit(streaming, messages)[1]?.price, 0.028);
assert.equal(applySavedCredit(streaming, []), streaming, 'Unpersisted turns keep the streaming amount');
console.log('Cumulative streaming prices, turn boundaries, persistence fallback, and decimal precision passed');
