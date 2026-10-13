const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const crypto: typeof import('node:crypto') = require('node:crypto');
const {
  transformSync,
}: import('../../../../../../../scripts/spec-harness.ts').SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../../../..');
const originalTimezone = process.env['TZ'];
process.env['TZ'] = 'UTC';
const NativeDate = Date;
const timestamp = NativeDate.parse('2026-10-13T03:20:30Z');
class FrozenDate extends NativeDate {
  constructor(...args: unknown[]) {
    const date: unknown = Reflect.construct(NativeDate, args.length ? args : [timestamp]);
    if (!(date instanceof NativeDate)) throw new Error('Invalid clock constructor');
    super(date.valueOf());
  }
  static now() {
    return timestamp;
  }
}
Reflect.set(globalThis, 'Date', FrozenDate);
Reflect.set(globalThis, '_l', (text: string) => text);
Reflect.set(globalThis, 'window', { isIphone: false });
const mutedConsole = { log() {}, error() {} };
function load(relative: string, imports: Record<string, unknown>, revision?: string): Record<string, unknown> {
  const source = revision
    ? cp.execFileSync('git', ['show', revision + ':' + relative], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, relative), 'utf8');
  const transformed = transformSync(source, {
    filename: path.join(root, relative),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  if (!transformed?.code) throw new Error('Formula source did not compile');
  const code = transformed.code;
  const output: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', 'console', code)(
    output,
    output.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unexpected formula dependency: ' + name);
    },
    mutedConsole,
  );
  return output.exports;
}
const dayjs = require('dayjs');
const numericBoundary = load('src/utils/functionLibraryBoundary.ts', {});
const library = load('src/utils/function-library.ts', {
  dayjs,
  lodash: require('lodash'),
  'src/utils/subListStoreTypes': load('src/utils/subListStoreTypes.ts', {}),
  './functionLibraryBoundary': numericBoundary,
});
const local = { getLang: (key: string) => key, initLang: () => {} };
const enumPath = 'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/enum.ts';
const imports = {
  dayjs,
  lodash: require('lodash'),
  'dayjs/plugin/customParseFormat': require('dayjs/plugin/customParseFormat'),
  'dayjs/plugin/isBetween': require('dayjs/plugin/isBetween'),
  'src/utils/function-library': library,
  'src/utils/functionLibraryBoundary': numericBoundary,
  './local': local,
};
const current = load(enumPath, imports);
const beforeRevision = process.env['FORMULA_ENUM_BEFORE_REV'];
const previous = beforeRevision ? load(enumPath, imports, beforeRevision) : undefined;
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Missing module exports');
  return value;
}
const funcs = record(current['functions']),
  oldFuncs = previous ? record(previous['functions']) : undefined;
const rawReference: unknown = JSON.parse(fs.readFileSync(path.join(__dirname, 'enumTyping.expected.json'), 'utf8'));
const reference = record(rawReference);
const referenceCases = record(reference['cases']);
const referenceReceivers = record(reference['numericReceivers']);
function normalized(value: unknown): unknown {
  if (value === undefined) return { kind: 'undefined' };
  if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) {
    return { kind: 'number', value: Object.is(value, -0) ? '-0' : String(value) };
  }
  if (Array.isArray(value)) return value.map(normalized);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalized(item)]));
  return value;
}
function invoke(registry: Record<string, unknown>, name: string, args: readonly unknown[]): unknown {
  const fn = registry[name];
  if (typeof fn !== 'function') throw new Error('Missing formula function: ' + name);
  return Reflect.apply(fn, registry, args);
}
function outcome(registry: Record<string, unknown>, name: string, args: readonly unknown[]): unknown {
  try {
    return { value: invoke(registry, name, args) };
  } catch (error) {
    if (!(error instanceof Error)) return { thrown: error };
    return { error: error.name, message: error instanceof TypeError ? undefined : error.message };
  }
}
const cases: Record<string, unknown[][]> = {
  NETWORKDAY: [
    ['2026-10-01', '2026-10-14'],
    ['2026-10-14', '2026-10-01'],
    ['2026-10-01', '2026-10-14', ['2026-10-08'], [1, 2, 3, 4]],
    [null, '2026-10-14'],
    ['bad', '2026-10-14'],
  ],
  MINUTE: [['11:35'], ['11:35:42'], ['2026-10-01 14:20:00'], ['bad']],
  HOUR: [['11:35'], ['11:35:42'], ['2026-10-01 14:20:00'], ['bad']],
  WEEKDAY: [['2026-10-04'], ['2026-10-05'], [null]],
  DAY: [['2026-10-13'], ['bad'], ['']],
  MONTH: [['2026-10-13'], ['bad'], ['']],
  YEAR: [['2026-10-13'], ['bad'], ['']],
  DATEADD: [
    ['2026-10-01', '+2d'],
    ['12:30', '+01:15:00'],
    ['2026-10-01 10:20:30', '+2h', 2],
    ['', '+2d'],
  ],
  DATEIF: [
    ['2026-10-01', '2026-10-03'],
    ['2026-10-01', '2026-10-03', 2],
    ['2025-10-01', '2026-10-01', 1, 'Y'],
    ['2026-01-01', '2026-10-01', 1, 'M'],
    ['10:00', '11:30', 1, 'm'],
    [null, '2026-10-13'],
    ['bad', '2026-10-13'],
    ['2026-10-01', '2026-10-03', 1, 'invalid'],
  ],
  DATENOW: [[]],
  COUNTARRAY: [[['one', 'two']], ['42'], ['text'], [null], [{ length: 3 }], [true]],
  RANDBETWEEN: [
    [1, 5],
    ['2', '5'],
    ['bad', 5],
  ],
  ROUNDDOWN: [['1.239', 2], [-1.239, 2], ['bad']],
  ROUNDUP: [['1.231', 2], [-1.231, 2], ['bad']],
  ROUND: [['1.234', 2], [1.235, 2], ['bad']],
  CEILING: [
    ['7', '3'],
    [-7, 3],
    [7, -3],
    ['bad', 2],
  ],
  FLOOR: [
    ['7', '3'],
    [-7, 3],
    [7, -3],
    ['bad', 2],
  ],
  MOD: [
    [2.5, 0.2],
    [undefined, 2],
    [8, 0],
    ['bad', 2],
  ],
  INT: [['2.8'], [-2.8], ['bad']],
  ABS: [['-2.8'], [null], ['bad']],
  COUNTA: [[0, '', null, undefined, false, true, 'x', NaN]],
  COUNTBLANK: [[0, '', null, undefined, false, true, 'x', NaN]],
  PRODUCT: [[2, '3', 4], [2, 'bad'], []],
  MAX: [
    [1, '2', null, -3],
    [undefined, ''],
    [2n, 3],
  ],
  MIN: [
    [1, '2', null, -3],
    [undefined, ''],
    [2n, 3],
  ],
  AVERAGE: [
    [1, '2', null, -3],
    [undefined, ''],
  ],
  SUM: [[1, '2', null, undefined], []],
  NUMBER: [['2.555'], [null], ['bad']],
  POWER: [
    ['2', '3'],
    [2n, 3],
    ['bad', 2],
  ],
  LOG: [
    ['8', '2'],
    [8n, 2],
    ['bad', 2],
  ],
  REPLACE: [['abcdef', 2, 3, 'X'], [undefined]],
  REPT: [
    ['x', 3],
    ['', 3],
    ['x', 10001],
  ],
  MID: [['abcdef', 2, 3]],
  RIGHT: [['abcdef', 3]],
  LEFT: [['abcdef', 3]],
  UPPER: [['aBc']],
  LOWER: [['aBc']],
  CONCAT: [['a', 1, null, undefined, false]],
  STRING: [[['a', { text: 'b' }, null, { text: 3 }]], [undefined], [0]],
  TRIM: [[' a b '], [0]],
  CLEAN: [[' a b '], [false]],
  IF: [
    [true, { keep: true }, 'false'],
    [false, 'true', { keep: true }],
  ],
  OR: [[false, '1 > 2'], [false, '1 < 2'], [0, {}], ['args.length === 1']],
  AND: [[true, '1 < 2'], [true, 0], [true, {}], ['args.length === 1']],
  NOT: [['1 < 2'], [false], [{}], ['expression.length === 23']],
  FALSE: [[]],
  TRUE: [[]],
  ISBLANK: [[null], [''], [[]], ['[]'], [false], [0]],
  ENCODEURI: [['https://example.test/a b?x=1'], [null]],
  DECODEURI: [['https://example.test/a%20b'], ['%']],
  ENCODEURICOMPONENT: [['a b&c'], [false]],
  DECODEURICOMPONENT: [['a%20b%26c'], ['%']],
  DISTANCE: [
    [
      { x: 116.3, y: 39.9 },
      { x: 116.4, y: 40.1 },
    ],
    ['116.3,39.9', '116.4,40.1'],
    [
      { x: '116.3', y: '39.9' },
      { x: 116.4, y: 40.1 },
    ],
    [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1n, y: 2n },
      { x: 1n, y: 2n },
    ],
    ['bad', '1,2'],
  ],
  FIND: [
    ['a[b]c', '[', ']'],
    ['a.foo.bar', '.', '.'],
    ['ab-end', null, '-'],
    ['start-tail', '-', null],
  ],
  FINDA: [
    ['a[b]c[d]', '[', ']'],
    ['a.foo.bar', '.', '.'],
    ['none', '[', ']'],
  ],
  SPLIT: [['a,b', ',']],
  JOIN: [[['a', 1, null], ',']],
  INCLUDE: [
    ['abc', 'b'],
    ['abc', ''],
    [0, '0'],
  ],
  GETPOSITION: [
    [{ x: 1, y: 2 }, 'x,y'],
    [{ x: 0, y: 2 }, 'x,y'],
    [{ title: 'Office' }, 'title'],
  ],
  COUNTCHAR: [['a\r\nb\nc'], [null]],
  PI: [[]],
  RADIANS: [[180], ['90'], ['bad']],
  DEGREES: [[Math.PI], ['bad']],
  SIN: [[0], ['1']],
  COS: [[0], ['1']],
  TAN: [[0], ['1']],
  COT: [[1], ['bad']],
  ASIN: [[0.5], ['bad']],
  ACOS: [[0.5], ['bad']],
  ATAN: [[1], ['bad']],
  ACOT: [[1], ['bad']],
  SUBSTITUTE: [
    ['a.b.a', '.', '-', undefined],
    ['abcabc', 'a', 'X', 2],
    ['abcabc', 'a', 'X', 0],
    ['abcabc', 'a', 'X', 'bad'],
  ],
  IFS: [
    [false, 'a', true, 'b'],
    [false, 'a', false, 'b'],
    [true, 0],
  ],
  WORKDAY: [
    ['2026-10-02', 2],
    ['2026-10-05', -2],
    ['2026-10-02', 2, ['2026-10-05']],
    [null, 2],
    ['bad', 2],
    ['2026-10-02', 'bad'],
  ],
  WORKDAY_INTL: [
    ['2026-10-02', 2],
    ['2026-10-02', 2, 11],
    ['2026-10-02', 2, 2, ['2026-10-06']],
    ['2026-10-05', -2, 17],
    [null, 2],
  ],
  WEEKNUM: [['2026-10-13'], ['2026-10-13', 2], ['2026-10-13', 21], [null], ['bad']],
  STRREVERSE: [['abc'], [0], [[1, 2]]],
  NORM_S_DIST: [[1.96], [0, false], ['bad']],
  PERMUT: [
    [5, 3],
    ['5', '3'],
    [0, 0],
    [-1, 0],
    [5, 6],
  ],
  COMBIN: [
    [5, 3],
    ['5', '3'],
    [0, 0],
    [2.5, 1],
    [5, 6],
  ],
};
assert.deepEqual(
  Object.keys(cases).sort(),
  Object.keys(funcs).sort(),
  'Every public formula must have a behaviour case',
);
assert.deepEqual(Object.keys(funcs).sort(), reference['functions'], 'Public formula registry remains complete');
const details = JSON.stringify(record(current['functionDetails']));
assert.equal(
  crypto.createHash('sha256').update(details).digest('hex'),
  reference['detailsSha256'],
  'Published formula descriptions and order remain unchanged',
);
if (previous) assert.deepEqual(current['functionDetails'], previous['functionDetails']);
let comparisons = 0;
const originalRandom = Math.random;
Math.random = () => 0.25;
for (const [name, inputs] of Object.entries(cases))
  for (const [index, args] of inputs.entries()) {
    assert.deepEqual(
      normalized(outcome(funcs, name, args)),
      referenceCases[name + '/' + index],
      name + ' ' + String(args),
    );
    if (oldFuncs) assert.deepEqual(outcome(funcs, name, args), outcome(oldFuncs, name, args));
    comparisons++;
  }
Math.random = originalRandom;
assert.equal(invoke(funcs, 'HOUR', ['11:35']), 11);
assert.equal(invoke(funcs, 'MINUTE', ['11:35:42']), 35);
assert.equal(invoke(funcs, 'DATEIF', ['2026-10-01', '2026-10-03']), '2天%04021');
assert.equal(invoke(funcs, 'COMBIN', [5, 3]), 10);
assert.equal(invoke(funcs, 'PERMUT', [5, 3]), 60);
assert.deepEqual(invoke(funcs, 'FINDA', ['a[b]c[d]', '[', ']']), ['b', 'd']);
// ECMAScript numeric coercion must preserve receiver methods, their order, and BigInt failure.
for (const name of ['MAX', 'MIN', 'POWER', 'LOG']) {
  function observed(registry: Record<string, unknown>) {
    const trace: string[] = [];
    const value = {
      [Symbol.toPrimitive](hint: string) {
        trace.push(hint);
        return '2';
      },
    };
    return { result: outcome(registry, name, [value, 4]), trace };
  }
  assert.deepEqual(normalized(observed(funcs)), referenceReceivers[name], name + ' numeric receiver protocol');
  if (oldFuncs) assert.deepEqual(observed(funcs), observed(oldFuncs));
  comparisons++;
}
// The actual executor uses the actual field formatter and this actual registry.
const widgetTypes = {
  TEXT: 2,
  SWITCH: 36,
  NUMBER: 6,
  MONEY: 8,
  DATE: 15,
  DATE_TIME: 16,
  FLAT_MENU: 9,
  MULTI_SELECT: 10,
  DROP_DOWN: 11,
  TIME: 46,
  LOCATION: 40,
};
const execImports = {
  lodash: require('lodash'),
  dayjs,
  'query-string': require('query-string'),
  'src/pages/widgetConfig/config/widget': { WIDGETS_TO_API_TYPE_ENUM: widgetTypes },
  'src/utils/function-library': library,
  './enum': current,
  './local': local,
};
const executor = load('src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/exec.ts', execImports);
function execute(expression: string, type: number, formData: unknown[] = []) {
  return record(
    invoke(executor, 'default', [
      { type, advancedSetting: { defaultfunc: JSON.stringify({ type: 'formula', expression }) } },
      formData,
      { forceSyncRun: true },
    ]),
  );
}
assert.equal(execute('SUM($field$,2)', 6, [{ type: 6, controlId: 'field', value: '3' }])['value'], '5');
assert.equal(
  execute('DATEIF($start$,$end$)', 2, [
    { type: 15, controlId: 'start', value: '2026-10-01' },
    { type: 15, controlId: 'end', value: '2026-10-03' },
  ])['value'],
  '2天%04021',
);
assert.equal(
  execute('IF(ISBLANK($start$),"empty",DATEIF($start$,$end$))', 2, [
    { type: 15, controlId: 'start', value: '' },
    { type: 15, controlId: 'end', value: '2026-10-03' },
  ])['value'],
  'empty',
);
assert.equal(
  execute('GETPOSITION($location$,"x,y")', 2, [
    { type: 40, controlId: 'location', value: JSON.stringify({ x: 116.3, y: 39.9 }) },
  ])['value'],
  '116.3,39.9',
);
assert.equal(
  execute('SUM(POWER($field$,2),COMBIN(5,3))', 6, [{ type: 6, controlId: 'field', value: '3' }])['value'],
  '19',
);
Reflect.set(globalThis, 'Date', NativeDate);
if (originalTimezone === undefined) delete process.env['TZ'];
else process.env['TZ'] = originalTimezone;
console.log(
  'Real formula registry reference parity passed:',
  Object.keys(funcs).length,
  'functions,',
  comparisons,
  'cases; actual executor/formatter integration: 5 cases',
);
