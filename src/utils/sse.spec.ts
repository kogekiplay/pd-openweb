const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

interface SseModule {
  PartialJsonParser: new () => { parse(chunk: string): Record<string, unknown>; getResult(): Record<string, unknown> };
  parseStreamingJsonlData(content: string, streaming?: boolean, decode?: (value: unknown) => unknown): unknown[];
  getTextContentFromMessage(content: unknown): string;
}
function requireEsm(file: string): SseModule {
  const module: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports as SseModule;
}

const { PartialJsonParser, parseStreamingJsonlData, getTextContentFromMessage } = requireEsm('./sse.js');
const { generatedWidget, generatedControlValue, streamRow, appOptimizationValue } = require('./sseTypes.ts');

assert.deepStrictEqual(parseStreamingJsonlData('{"id":"001","value":1}\n', false), [{ id: '001', value: 1 }]);
assert.deepStrictEqual(
  parseStreamingJsonlData('false\nnull\n0\n"text"\n[1,2]\n{"n":2}\n', false),
  ['text', [1, 2], { n: 2 }],
  'Completed JSONL keeps the original truthy JSON values instead of asserting everything is a row',
);
assert.deepStrictEqual(
  parseStreamingJsonlData('{"n":01}\n', false),
  [{ n: 1 }],
  'Legacy leading-zero recovery remains available',
);
assert.deepStrictEqual(
  parseStreamingJsonlData('{"id":"one"}\n{"id":"pending"}\n', true),
  [{ id: 'one' }],
  'Streaming keeps its existing two trailing-line boundary',
);
const incremental = new PartialJsonParser();
assert.deepStrictEqual(incremental.parse('{"id":"one","text":"a\\'), { id: 'one' });
assert.deepStrictEqual(incremental.parse('"b","flag":false,"empty":null,"items":[1,2]}'), {
  id: 'one',
  text: 'a"b',
  flag: false,
  empty: null,
  items: [1, 2],
});
incremental.parse(',"id":"later"');
assert.equal(incremental.getResult().id, 'one', 'Incremental parsing retains the first complete value of a key');
const snapshot = incremental.getResult();
snapshot.id = 'modified';
assert.equal(incremental.getResult().id, 'one', 'Snapshots cannot overwrite the parser state');
const specialKeys = new PartialJsonParser();
specialKeys.parse('{"hasOwnProperty":"data","constructor":"data","__proto__":{"label":"safe"},"last":2}');
assert.equal(specialKeys.getResult().last, 2, 'JSON field names cannot replace the parser own-key check');
assert.equal(Object.getPrototypeOf(specialKeys.getResult()), Object.prototype);
assert.equal(
  Object.hasOwn(specialKeys.getResult(), '__proto__'),
  true,
  'The prototype-named JSON field stays ordinary own data',
);
assert.equal(getTextContentFromMessage('plain'), 'plain');
assert.equal(
  getTextContentFromMessage([
    { type: 'text', text: 'first' },
    { type: 'image', text: 'skip' },
    { type: 'text', text: 'second' },
  ]),
  'first\nsecond',
);
assert.equal(
  getTextContentFromMessage([null, 1, { type: 'text', text: {} }, { type: 'text', text: 'valid' }]),
  'valid',
);
assert.equal(getTextContentFromMessage(undefined), '');

const widget = {
  type: 'relatedTable',
  code: 'lines',
  rowPosition: '2.1',
  subFields: [{ type: 'radio', options: [{ label: 'Ready', isDefault: true }] }],
  relatedWorksheet: { id: 'worksheet' },
  metadata: 'retained',
};
assert.equal(
  generatedWidget(widget),
  widget,
  'The generated-widget decoder keeps all legitimate original metadata and object identity',
);
assert.equal(generatedWidget({ ...widget, subFields: [{ options: [{ isDefault: 'true' }] }] }), undefined);
assert.equal(generatedWidget({ ...widget, rowPosition: 1 }), undefined);
assert.equal(
  generatedWidget({ ...widget, rowPosition: 'not-grid' }),
  undefined,
  'Malformed layout positions never become NaN row/column values',
);
assert.equal(
  generatedWidget({ ...widget, rowPosition: '' })?.rowPosition,
  '',
  'Empty layout positions keep the legacy default layout',
);
assert.equal(generatedControlValue({ controlId: 1, value: 'unsafe' }), undefined);
const fill = { controlId: 'control', value: { nested: ['row', 1] }, isSmartFill: true, Reason: 'found' };
assert.equal(
  generatedControlValue(fill),
  fill,
  'Generated field values remain unknown until the widget-specific formatter reads them',
);
assert.equal(streamRow({ rowid: 1 }), undefined);
assert.equal(appOptimizationValue({ id: 'app', icon: {} }), undefined);
assert.deepStrictEqual(
  parseStreamingJsonlData(JSON.stringify(widget) + '\nnull\n42\n{"type":false}\n', false, generatedWidget),
  [widget],
);
assert.deepStrictEqual(
  parseStreamingJsonlData(JSON.stringify(fill) + '\n{"controlId":3}\n', false, generatedControlValue),
  [fill],
);
assert.deepStrictEqual(parseStreamingJsonlData('{"rowid":"row","field":[1,{"metadata":true}]}\n', false, streamRow), [
  { rowid: 'row', field: [1, { metadata: true }] },
]);

console.log('sse utils tests passed');
