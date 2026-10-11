const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const {
  transformSync,
}: {
  transformSync(code: string, options?: Record<string, unknown>): { code: string | null };
} = require('../../../../../../../scripts/spec-harness.ts');

const root = path.resolve(__dirname, '../../../../../../../');
const before = process.env['FAST_FILTER_BEFORE'];
const directory = 'src/pages/worksheet/common/ViewConfig/components/fastFilter';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

function load(old = false): Record<string, (...args: unknown[]) => unknown> {
  const filename = path.join(root, directory, 'util.ts');
  const source =
    old && before
      ? execFileSync('git', ['show', before + ':' + path.relative(root, filename)], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(filename, 'utf8');
  const transformed = transformSync(source, {
    filename,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  if (!transformed.code) throw new TypeError('Missing fast-filter transform');
  const moduleLike: { exports: unknown } = { exports: {} };
  const esm = (file: string): unknown => {
    const target = path.join(root, file);
    const code =
      old && before
        ? execFileSync('git', ['show', before + ':' + file], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(target, 'utf8');
    const output = transformSync(code, {
      filename: target,
      babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    if (!output.code) throw new TypeError('Missing dependency transform');
    const dependency: { exports: unknown } = { exports: {} };
    new Function('module', 'exports', 'require', output.code)(dependency, dependency.exports, require);
    return dependency.exports;
  };
  (globalThis as Record<string, unknown>)['_l'] = (value: string) => `translated:${value}`;
  (globalThis as Record<string, unknown>)['safeParse'] = (value: unknown) => {
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      return undefined;
    }
  };
  new Function('module', 'exports', 'require', transformed.code)(
    moduleLike,
    moduleLike.exports,
    (request: string): unknown => {
      if (request === 'lodash') return require('lodash');
      if (
        request === 'src/pages/worksheet/common/WorkSheetFilter/enum' ||
        request === 'src/pages/worksheet/common/WorkSheetFilter/enum.js'
      )
        return esm('src/pages/worksheet/common/WorkSheetFilter/enum.ts');
      if (request === 'src/pages/worksheet/common/WorkSheetFilter/util')
        return { redefineComplexControl: (control: unknown) => control };
      if (request.endsWith('/fastFilter/config') || request.endsWith('/fastFilter/config.js'))
        return esm(directory + '/config.ts');
      return require(request);
    },
  );
  if (!object(moduleLike.exports)) throw new TypeError('Missing fast-filter exports');
  return moduleLike.exports as Record<string, (...args: unknown[]) => unknown>;
}

interface FastFilterInfo {
  dataType?: number;
  values?: string[];
  [key: string]: unknown;
}

function observe(old = false) {
  const util = load(old);
  const dateDefault = util['getDefaultDateRange']('3');
  const granularity = util['getDateRangeTypeListByShowtype']('3');
  const text = util['getSetDefault']({
    controlId: 'text',
    type: 1,
    advancedSetting: { searchcontrol: '1', searchtype: '2' },
  }) as Record<string, unknown>;
  const date = util['getSetDefault']({ controlId: 'date', type: 15, advancedSetting: { showtype: '5' } }) as Record<
    string,
    unknown
  >;
  const formatted = util['formatFastFilterData']([
    { dataType: 26, values: [JSON.stringify({ id: 'user-1', accountId: 'account-1', name: 'User' })] },
    { dataType: 29, values: [JSON.stringify({ id: 'row-1', rowid: 'row-1', name: 'Row' })] },
    { dataType: 1, values: ['plain'] },
  ]) as FastFilterInfo[];
  const ranges = util['getDaterange']({ daterange: JSON.stringify([1, 2]) }) as unknown[];
  const malformed = util['getDaterange']({ daterange: '{bad' }) as unknown[] | undefined;
  return { dateDefault, granularity, text, date, formatted, ranges, malformed };
}

const current = observe();
assert.deepEqual(
  current.dateDefault,
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 52, 21, 22, 23, 51, 31, 32, 33],
);
assert.equal(Array.isArray(current.granularity), true);
assert.equal(object(current.text) && current.text['controlId'], 'text');
assert.equal(object(current.date) && current.date['dateRangeType'], 5);
assert.deepEqual(current.formatted[0]?.['values'], ['account-1']);
assert.deepEqual(current.formatted[1]?.['values'], ['row-1']);
assert.deepEqual(current.formatted[2]?.['values'], ['plain']);
assert.deepEqual(current.ranges, [1, 2]);
assert.equal(current.malformed, undefined);
if (before) assert.deepEqual(current, observe(true), 'Fast filter defaults and serialization match historical source');
console.log(
  `fast-filter-util: ${current.formatted.length + 5} behavior cases passed${before ? ' with historical Babel A/B' : ''}`,
);
