const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const { transformSync } = require('../../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../../../..');
const target = 'src/components/Form/MobileForm/components/ChildTable/utils.ts';

function load(
  source: string,
  imports: Record<string, unknown> = {},
  globals: Record<string, unknown> = {},
): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const env = {
    _l: (text: string) => text,
    safeParse: (value: unknown) => {
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    },
    ...globals,
  };
  const { code } = transformSync(source, { filename: target, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', ...Object.keys(env), code)(
    output,
    output.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unexpected dependency: ' + name);
    },
    ...Object.values(env),
  );
  return output.exports;
}

const imports = {
  lodash,
  'src/components/Form/core/DataFormat': class {
    getErrorControls() {
      return [];
    }
  },
  'src/pages/widgetConfig/config/widget': {
    WIDGETS_TO_API_TYPE_ENUM: {
      USER_PICKER: 26,
      DEPARTMENT: 27,
      RELATE_SHEET: 29,
      CASCADER: 35,
      AREA_PROVINCE: 19,
      AREA_CITY: 23,
      AREA_COUNTY: 24,
      ORG_ROLE: 48,
    },
  },
  'src/utils/control': { checkCellIsEmpty: (v: unknown) => v == null || v === '' },
  'src/utils/record': { filterEmptyChildTableRows: (rows: unknown[]) => rows },
  'src/utils/rule': { checkRulesErrorOfRow: () => ({ errors: [], formData: [] }) },
  '../../../core/config': {
    FORM_ERROR_TYPE: { CUSTOM: 'CUSTOM' },
    FORM_ERROR_TYPE_TEXT: { UNIQUE: () => 'unique' },
    FROM: { NEWRECORD: 3 },
  },
  '../../../core/formUtils': { checkRuleLocked: () => false, checkValueByFilterRegex: () => '' },
};
const fakeDocument = {
  createElement: () => ({ style: {}, appendChild: () => {}, innerText: '', offsetWidth: 140 }),
  body: { appendChild: () => {}, removeChild: () => {} },
};
const source = fs.readFileSync(path.join(root, target), 'utf8');
const current = load(source, imports, { document: fakeDocument });
const before = process.env['CHILD_TABLE_BEFORE_REV'];
const historical = before
  ? load(cp.execFileSync('git', ['show', before + ':' + target], { cwd: root, encoding: 'utf8' }), imports, {
      document: fakeDocument,
    })
  : undefined;

function invoke(module: Record<string, unknown>, name: string, args: unknown[]): unknown {
  const fn = module[name];
  if (typeof fn !== 'function') throw new Error(name);
  return Reflect.apply(fn, undefined, args);
}

function compare(name: string, args: unknown[], expected?: unknown): unknown {
  const value = invoke(current, name, args);
  if (expected !== undefined) assert.deepEqual(value, expected, name);
  if (historical) assert.deepEqual(value, invoke(historical, name, structuredClone(args)), 'Historical ' + name);
  return value;
}

const conditions = [
  {
    controlId: 'user',
    dataType: 26,
    filterType: 2,
    values: [JSON.stringify({ accountId: 'a' }), { accountId: 'b' }, 'c'],
    spliceType: 1,
  },
  { controlId: 'date', dataType: 15, filterType: 17, dateRange: 18, dateRangeType: 3, values: [] },
  { controlId: 'plain', dataType: 2, filterType: 2, minValue: '', maxValue: '', values: ['x'], dynamicSource: [] },
];

for (const list of [
  [],
  conditions,
  [{ isGroup: true, spliceType: 2, groupFilters: conditions }],
  conditions.map(c => ({ ...c, isGroup: true, groupFilters: [c] })),
]) {
  const result = compare('normalizeSDKFilterControls', [list]);
  assert.ok(Array.isArray(result));
  if (list.length) assert.ok(Array.isArray(result));
}

const relation = compare('normalizeSDKFilterControls', [
  [{ controlId: 'c', dataType: 29, values: [JSON.stringify({ id: 'row' }), { rowid: 'row2' }, 'x'] }],
]);
assert.deepEqual(relation[0].groupFilters[0].values, ['row', 'row2', 'x']);
for (const value of [[{ controlId: 1 }], [{ values: [1], dataType: 'bad' }]])
  assert.doesNotThrow(() => invoke(current, 'normalizeSDKFilterControls', [value]));
const columns = [
  { controlId: 'title', controlName: 'Title', extra: 'keep' },
  { controlId: 'delete', controlName: '', className: 'deleteAction', width: 30 },
];
const rows = [
  { rowid: 'r1', title: 'short' },
  { rowid: 'r2', title: 'a'.repeat(400) },
];
const width = invoke(current, 'addWidthToColumns', [columns, rows]);
assert.equal(width[0].width, 170);
assert.equal(width[1], columns[1]);
assert.equal(width[0].extra, 'keep');
if (historical) assert.deepEqual(width, invoke(historical, 'addWidthToColumns', [columns, rows]));
const dataControl = { controlId: 'unique', type: 26, unique: true };
const rowsDup = [
  { rowid: 'r1', unique: JSON.stringify([{ accountId: 'a' }]) },
  { rowid: 'r2', unique: JSON.stringify([{ accountId: 'a' }]) },
];
const errors = invoke(current, 'getSubListError', [{ rows: rowsDup, rules: [] }, [dataControl], ['unique'], 3, {}]);
assert.deepEqual(errors, { 'r1-unique': 'unique', 'r2-unique': 'unique' });
console.log(
  `Child table filter normalization, width bounds, uniqueness and history passed${historical ? ' with historical comparison' : ''}`,
);
