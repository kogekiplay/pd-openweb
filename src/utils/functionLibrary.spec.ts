const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const dayjs = require('dayjs');
dayjs.extend(require('dayjs/plugin/customParseFormat'));
interface Control {
  type?: number;
  value?: unknown;
  enumDefault?: number;
  enumDefault2?: number;
  sourceControlType?: number;
  sourceControl?: { advancedSetting?: Record<string, string> };
  advancedSetting?: Record<string, string>;
  options?: { key: string; value?: string; isDeleted?: boolean }[];
  unit?: string;
  store?: unknown;
}
interface Library {
  formatControlValue(control?: Control, nullzero?: string): unknown;
  wgs84togcj02(
    longitude: string | number | null | undefined,
    latitude: string | number | null | undefined,
  ): [number, number];
  calcDate(
    date: string | number | Date | null | undefined,
    expression: string,
  ): {
    result?: { valueOf(): number; format(format?: string): string };
    error?: unknown;
  };
  countChar(text: string, character: string): number;
}
function load(relative: string): unknown {
  const target: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', 'console', transformFileSync(path.join(__dirname, relative)).code)(
    target,
    target.exports,
    (name: string) => {
      if (name === 'dayjs' || name === 'lodash') return require(name);
      if (name === 'src/utils/subListStoreTypes') return load('subListStoreTypes.ts');
      if (name === './functionLibraryBoundary') return load('functionLibraryBoundary.ts');
      throw new Error('Unstubbed function library dependency: ' + name);
    },
    { error() {}, log() {} },
  );
  return target.exports;
}
global._l = (text: string) => text;
const library = load('function-library.ts') as Library;
const format = library.formatControlValue;
assert.equal(format(undefined), undefined);
for (const value of [undefined, null, false, true, 0, -0, NaN, Infinity, 1n, Symbol.for('function raw'), '', 'text'])
  assert.equal(format({ type: 2, value }), value);
const date = new Date('2026-01-02T03:04:05Z');
const callback = () => 'opaque callable';
const cyclic: unknown[] = [];
cyclic.push(cyclic);
assert.equal(
  format({ type: 2, value: cyclic }),
  cyclic,
  'raw cyclic arrays pass through without cloning or serialization',
);
class SDKValue {
  data = { rowid: 7 };
}
for (const value of [
  date,
  callback,
  new SDKValue(),
  { rowid: 5, nested: { flag: false } },
  [0, false, null, undefined],
  new Array(2),
])
  assert.equal(
    format({ type: 2, value }),
    value,
    'open raw values keep their reference without claiming an SDK/callable ABI',
  );
assert.equal(format({ type: 6, value: ' 3.25 ' }), 3.25);
assert.equal(format({ type: 8, value: '' }), undefined);
assert.equal(format({ type: 8, value: '' }, '1'), 0);
assert.equal(format({ type: 6, value: null }), 0);
assert.equal(format({ type: 6, value: [2] }), 2);
assert.equal(format({ type: 31, value: '2' }), 2);
assert.equal(format({ type: 38, enumDefault: 1, value: '2' }), 2);
assert.equal(format({ type: 38, enumDefault: 2, value: '2026-01-02' }), '2026-01-02');
assert.equal(format({ type: 37, value: '0.125', advancedSetting: { summaryresult: '1' } }), '13%');
assert.equal(format({ type: 37, value: undefined, advancedSetting: { summaryresult: '1' } }), 'NaN%');
assert.equal(format({ type: 53, enumDefault2: 6, value: '4' }), 4);
assert.equal(format({ type: 19, value: '{"name":"Province"}' }), 'Province');
assert.deepEqual(format({ type: 17, value: '["2026-01-01","2026-01-02"]' }), ['2026-01-01', '2026-01-02']);
assert.equal(format({ type: 18, value: '["",""]' }), undefined);
assert.deepEqual(
  format({ type: 40, value: '{"title":"Office","coordinate":"gcj02","x":0,"y":1,"extra":{"rowid":5}}' }),
  {
    title: 'Office',
    coordinate: 'gcj02',
    x: 0,
    y: 1,
    extra: { rowid: 5 },
  },
);
const converted = format({ type: 40, value: '{"coordinate":"wgs84","x":"116.397","y":39.908}' });
assert.ok(converted && typeof converted === 'object' && 'x' in converted && 'y' in converted);
if (converted && typeof converted === 'object' && 'x' in converted && 'y' in converted)
  assert.deepEqual([converted.x, converted.y], library.wgs84togcj02('116.397', 39.908));
assert.deepEqual(format({ type: 26, value: '[{"fullname":"Alice"},"Bob",null,{},false]' }), [
  'Alice',
  'Bob',
  undefined,
]);
assert.deepEqual(format({ type: 26, value: '{"fullname":"Alice"}' }), ['Alice']);
const departmentValue = JSON.stringify([
  { departmentName: 'Child', departmentPath: [{ departmentName: 'Parent' }, { departmentName: 'Root' }] },
  {},
]);
const department = { type: 27, value: departmentValue };
assert.deepEqual(format(department), ['Root/Parent/Child', '该部门已删除']);
assert.equal(department.value, departmentValue);
assert.deepEqual(
  JSON.parse(department.value)[0].departmentPath,
  [{ departmentName: 'Parent' }, { departmentName: 'Root' }],
  'reverse mutates only the parsed path, not the original payload',
);
assert.deepEqual(format({ type: 48, value: '["Role",{"organizeName":"Admin"},{}]' }), [
  'Role',
  'Admin',
  '该组织已删除',
]);
assert.equal(format({ type: 36, value: '1' }), true);
assert.equal(format({ type: 36, value: true }), false);
assert.deepEqual(
  format({ type: 14, value: '[{"originalFilename":"a","ext":".png"},{},{"ext":".jpg"},{"originalFilename":"b"}]' }),
  ['a.png', 'NaN', 'undefined.jpg', 'bundefined'],
);
assert.equal(format({ type: 35, value: '[{"name":"Leaf"}]' }), 'Leaf');
assert.deepEqual(format({ type: 29, value: '2' }), [undefined, undefined]);
assert.deepEqual(format({ type: 29, enumDefault: 1, value: '2' }), [undefined]);
let numericCalls = 0;
const numericReceiver = {
  valueOf() {
    numericCalls++;
    return 2;
  },
};
assert.deepEqual(format({ type: 29, value: numericReceiver }), [undefined, undefined]);
assert.equal(numericCalls, 3, 'relation counts preserve each original numeric coercion and receiver call');
assert.equal(format({ type: 29, value: Object(2n) }), undefined, 'boxed BigInt still fails unary numeric coercion');
assert.equal(
  format({
    type: 29,
    value: {
      [Symbol.toPrimitive](hint: string) {
        assert.equal(hint, 'number');
        return 2n;
      },
    },
  }),
  undefined,
);
assert.equal(format({ type: 29, value: '"not array"' }), false);
assert.equal(format({ type: 29, enumDefault: 1, value: '"not array"' }), undefined);
assert.deepEqual(format({ type: 29, sourceControlType: 6, value: '[{"name":"3"},{"name":"0"},{"name":"4"}]' }), [3, 4]);
assert.equal(format({ type: 30, sourceControlType: 6, value: '4' }), 4);
const row = { rowid: 'actual-row', json: { rowid: 5 }, attachments: [{ originalFilename: 'a' }] };
assert.deepEqual(format({ type: 34, value: { rows: [{ rowid: 'empty-1' }, row] } }), [row]);
const fakeStore = { name: 34, initAndLoadRows() {}, getState: () => ({ rows: [row] }) };
const stored = format({ type: 34, value: '', store: fakeStore });
assert.deepEqual(stored, [row]);
if (Array.isArray(stored)) assert.equal(stored[0], row, 'store row and dynamic field identities survive formatting');
assert.deepEqual(format({ type: 34, value: '2' }), [undefined, undefined]);
assert.equal(format({ type: 46, value: '', unit: '9' }), '');
assert.equal(format({ type: 46, value: '03:04:05', unit: '9' }), '03:04:05');
const options = [
  { key: 'a', value: 'A' },
  { key: 'b', value: 'B' },
  { key: 'other', value: 'Other' },
];
assert.deepEqual(format({ type: 10, value: '["b","a","other:custom"]', options }), ['B', 'A', 'custom']);
assert.deepEqual(format({ type: 10, value: '["b","a"]', options, advancedSetting: { checktype: '0' } }), ['A', 'B']);
for (const control of [
  { type: 26, value: '[{"fullname":{}}]' },
  { type: 27, value: '[{"departmentPath":[null]}]' },
  { type: 48, value: '[null]' },
  { type: 14, value: '[{"originalFilename":{}}]' },
  { type: 40, value: '{"coordinate":{},"x":1,"y":2}' },
  { type: 34, value: { rows: [{ rowid: 5 }] } },
  { type: 29, value: '-1' },
  { type: 19, value: '{bad json' },
])
  assert.equal(format(control), undefined);
assert.equal(library.countChar('one:two:three', ':'), 2);
assert.equal(library.countChar('no matches', ':'), 0);
assert.equal(library.countChar('text', '['), 0);
assert.equal(library.calcDate('', '1d').error, true);
assert.equal(library.calcDate('2026-01-02', '+2d-1h').result?.format('YYYY-MM-DD HH:mm:ss'), '2026-01-03 23:00:00');
assert.equal(library.calcDate('2026-01-02', '0d').result?.format('YYYY-MM-DD'), '2026-01-02');
assert.equal(
  library.calcDate('2026-01-02', '1Q').result?.valueOf(),
  dayjs('2026-01-02').add(1, 'Q').valueOf(),
  'Q uses the deployed Dayjs method behavior without adding a plugin',
);
assert.equal(Number.isNaN(library.calcDate('invalid date', '+1d').result?.valueOf()), true);
assert.equal(library.wgs84togcj02('bad', undefined).every(Number.isNaN), true);
assert.equal(library.wgs84togcj02(NaN, Infinity).every(Number.isNaN), true);
console.log(
  'Function library finite values, selected names, row identity, date units, coordinates and malformed boundaries passed',
);
