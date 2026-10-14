const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const moment: typeof import('moment') = require('moment');
const lodash = require('lodash');
const { transformSync } = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const relative = 'src/pages/worksheet/views/GunterView/util.ts';
// Keep the test's runtime surface local: the tools program has no browser globals or product aliases.
interface TestPeriod {
  time: string;
  width: number;
  left?: number;
  isToday?: boolean;
}
interface TestCalendar {
  minDayWidth: number;
  periodCount: number;
  dayOff: number[];
  onlyWorkDay: boolean;
}
interface TestSeries {
  result: TestPeriod[];
  parent: TestPeriod[];
}
interface TestGroup extends Record<string, unknown> {
  rows: Record<string, unknown>[];
}
interface GunterUtils {
  getAssignWorkDays(value: number, time: moment.MomentInput, dayOff: number[]): string[];
  getWorkDays(
    start: moment.MomentInput,
    end: moment.MomentInput,
    center: moment.MomentInput,
    config: TestCalendar,
  ): TestSeries;
  getDays(
    start: moment.Moment | null,
    end: moment.Moment | null,
    center: moment.MomentInput,
    config: TestCalendar,
  ): TestSeries;
  getYears(
    start: moment.Moment | null,
    end: moment.Moment | null,
    center: moment.MomentInput,
    config: TestCalendar,
  ): TestSeries;
  changeViewConfig(value: number, config: TestCalendar): TestCalendar & { periodType: number };
  formatRecordTime(
    row: Record<string, unknown>,
    config: { startId: string; endId: string; milepost: string },
  ): { diff: number };
  groupingTimeBlock(
    grouping: TestGroup[],
    periods: TestPeriod[],
    config: TestCalendar & { periodType: number; milepost?: string },
  ): TestGroup[];
  fillRecordTimeBlockColor(row: Record<string, unknown>, control: unknown): { color: string };
}

function load(source: string, imports: Record<string, unknown> = {}): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformSync(source, {
    filename: path.join(root, relative),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', code)(output, output.exports, (name: string) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error('Unexpected dependency: ' + name);
  });
  return output.exports;
}

const testGlobal = globalThis as unknown as Record<string, unknown>;
testGlobal['_l'] = (value: string) => value;
testGlobal['screen'] = { width: 1920 };
// Execute the production parser and system-field declarations used by these helpers.
const globalSource = fs.readFileSync(path.join(root, 'src/common/global.ts'), 'utf8');
const safeParseSource = globalSource.match(/window\.safeParse = [\s\S]+?\n};/)?.[0];
assert.ok(safeParseSource);
const parserWindow: { safeParse?: unknown } = {};
new Function('window', transformSync(safeParseSource, { filename: 'global.ts' }).code)(parserWindow);
testGlobal['safeParse'] = parserWindow.safeParse;
const widgetSource = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/widget.ts'), 'utf8');
const systemDeclarations = ['SYSTEM_DATE_CONTROL', 'SYSTEM_CONTROL'].map(name => {
  const declaration = widgetSource.match(new RegExp('export const ' + name + ' = \\[[\\s\\S]+?\\n\\];'))?.[0];
  assert.ok(declaration, name);
  return declaration;
});
const widget = load(systemDeclarations.join('\n') + '\nexport const SYS = SYSTEM_CONTROL.map(o => o.controlId);');
const sorting = load(fs.readFileSync(path.join(root, 'src/pages/worksheet/redux/actions/util.ts'), 'utf8'), {
  lodash,
  'src/pages/worksheet/constants/enum': { APP_ROLE_TYPE: {} },
});
const config = load(fs.readFileSync(path.join(__dirname, 'config.ts'), 'utf8'));
let mobile = false;
const imports = {
  lodash,
  moment,
  'src/pages/widgetConfig/config/widget': widget,
  'src/pages/worksheet/redux/actions/util': sorting,
  'src/pages/worksheet/redux/actions/util.js': sorting,
  'src/utils/common': { browserIsMobile: () => mobile },
  './config': config,
};
const current = load(fs.readFileSync(path.join(root, relative), 'utf8'), imports) as unknown as GunterUtils;
const before = process.env['GUNTER_BEFORE_REV'];
const historical = before
  ? load(cp.execFileSync('git', ['show', before + ':' + relative], { cwd: root, encoding: 'utf8' }), imports)
  : undefined;
let comparisons = 0;

function invoke(module: object, name: string, args: unknown[]): unknown {
  const fn: unknown = Reflect.get(module, name);
  if (typeof fn !== 'function') throw new Error('Missing helper: ' + name);
  return Reflect.apply(fn, undefined, args);
}

function check(name: string, args: unknown[], expected: unknown): void {
  assert.deepEqual(invoke(current, name, args), expected, name);
  if (historical) assert.deepEqual(invoke(historical, name, args), expected, 'Historical ' + name);
  comparisons++;
}

function compare(name: string, args: unknown[]): void {
  if (historical) {
    assert.deepEqual(invoke(current, name, args), invoke(historical, name, args), 'Historical ' + name);
    comparisons++;
  }
}

const previousNow = moment.now;
const previousLocale = moment.locale();
moment.now = () => Date.parse('2026-10-14T12:00:00+08:00');
moment.locale('en');
try {
  const base = { minDayWidth: 30, periodCount: 4, dayOff: [0, 6], onlyWorkDay: true };
  check('getAssignWorkDays', [3, '2026-10-10', [0, 6]], ['2026-10-12', '2026-10-13', '2026-10-14']);
  check('getAssignWorkDays', [-3, '2026-10-12', [0, 6]], ['2026-10-09', '2026-10-08', '2026-10-07']);
  check('getAssignWorkDays', [0, '2026-10-12', [0, 6]], []);
  for (const invalid of [Number.NaN, Infinity, 1.5])
    assert.deepEqual(current.getAssignWorkDays(invalid, '2026-10-12', []), []);
  assert.deepEqual(current.getAssignWorkDays(1, moment.invalid(), []), []);
  assert.deepEqual(current.getAssignWorkDays(1, '2026-10-12', [0, 1, 2, 3, 4, 5, 6]), []);

  const workDays = current.getWorkDays(moment('2026-10-12'), moment('2026-10-16'), null, base);
  assert.deepEqual(
    workDays.result.map(day => day.time),
    ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'],
  );
  assert.deepEqual(workDays.parent, [{ time: '2026-10', width: 150 }]);
  assert.deepEqual(
    workDays.result.find(day => day.isToday),
    { time: '2026-10-14', width: 30, isToday: true, left: 15 },
  );
  // Exercise the actual milestone helper: this used to omit the working-calendar arguments.
  const speedSource = fs.readFileSync(path.join(__dirname, 'Chart/components/SpeedCreateTime/index.tsx'), 'utf8');
  const dayPeriodStart = speedSource.indexOf('const getDayPeriodList =');
  const dayPeriodEnd = speedSource.indexOf('\n};', dayPeriodStart);
  assert.ok(dayPeriodStart >= 0 && dayPeriodEnd > dayPeriodStart);
  const speed = load(
    'import { PERIOD_TYPE } from "./config"; import { getWorkDays, getDays } from "./util"; export ' +
      speedSource.slice(dayPeriodStart, dayPeriodEnd + 3),
    { './config': config, './util': current },
  );
  const milestoneDays = invoke(speed, 'getDayPeriodList', [[{ time: '2026-10-12' }, { time: '2026-10-18' }], 1, base]);
  assert.deepEqual(milestoneDays, workDays.result);

  for (const [start, end] of [
    [null, null],
    [moment('2026-10-12'), null],
    [null, moment('2026-10-16')],
  ]) {
    compare('getWorkDays', [start, end, '2026-10-14', base]);
  }

  compare('getWorkDays', [moment('2026-09-25'), moment('2026-10-16'), null, base]);
  assert.deepEqual(
    current.getWorkDays(moment('2026-10-12'), moment('2026-10-16'), null, { ...base, dayOff: [0, 1, 2, 3, 4, 5, 6] }),
    { result: [], parent: [] },
  );

  for (const onlyWorkDay of [false, true]) {
    for (const name of ['getDays', 'getWeeks', 'getMonths', 'getQuarters', 'getYears'] as const) {
      compare(name, [null, null, '2026-10-14', { ...base, onlyWorkDay }]);
      compare(name, [moment('2024-01-01'), moment('2024-12-31'), null, { ...base, onlyWorkDay }]);
    }

    for (const type of [0, 1, 2, 3, 4]) {
      for (const isMobile of [false, true]) {
        mobile = isMobile;
        compare('changeViewConfig', [type, { ...base, onlyWorkDay, extra: 'keep' }]);
        compare('getPeriodCount', [type, 30, { ...base, onlyWorkDay }]);
      }
    }
  }

  mobile = false;
  const leapYear = current.getYears(moment('2024-01-01'), moment('2024-12-31'), null, {
    ...base,
    minDayWidth: 1,
    onlyWorkDay: false,
  });
  assert.deepEqual(leapYear.result, [
    { time: '2024-01-01', width: 182 },
    { time: '2024-07-01', width: 184 },
  ]);
  assert.deepEqual(leapYear.parent, [{ time: '2024', width: 366 }]);
  assert.equal(current.changeViewConfig(99, base).periodType, 0);
  assert.ok(Number.isFinite(current.changeViewConfig(99, base).periodCount));
  check('isWeekEndDay', ['2026-10-16', 0, base], true);
  check('isWeekEndDay', ['2026-10-18', 0, base], false);
  check('isWeekEndDay', ['2026-10-18', 0, { ...base, onlyWorkDay: false }], true);
  check('isWeekEndDay', ['2026-10-16', 1, base], false);
  check('formatWeekDay', ['67'], [6, 0]);
  check('formatWeekDay', [null], []);
  check(
    'getRowsTime',
    [
      [
        {
          startTime: '2026-10-12',
          endTime: '2026-10-15',
          dragBeforeStartTime: '2026-10-10',
          dragBeforeEndTime: '2026-10-20',
        },
        { startTime: '2026-10-09', endTime: '2026-10-16' },
        { startTime: '2026-01-01' },
      ],
    ],
    { startTime: '2026-10-09', endTime: '2026-10-20' },
  );
  check('getRowsTime', [[]], { startTime: undefined, endTime: undefined });

  const fields = { startId: 'start', endId: 'end', milepost: 'milestone' };
  check('formatRecordTime', [{ rowid: 'r', start: '2026-10-12', end: '2026-10-14' }, fields], {
    rowid: 'r',
    start: '2026-10-12',
    end: '2026-10-14',
    startTime: '2026-10-12',
    endTime: '2026-10-14',
    diff: 3,
  });
  for (const milestone of ['1', 1]) {
    const row = { start: '2026-10-12', end: '2026-10-14', milestone };
    check('formatRecordTime', [row, fields], { ...row, startTime: '2026-10-12', endTime: '2026-10-12', diff: 1 });
  }

  check('formatRecordTime', [{ end: '2026-10-14', milestone: '1' }, fields], {
    end: '2026-10-14',
    milestone: '1',
    startTime: '2026-10-14',
    endTime: '2026-10-14',
    diff: 1,
  });
  assert.equal(current.formatRecordTime({ start: { bad: true }, end: 123 }, fields).diff, 0);

  const timeline = current.getDays(moment('2026-10-01'), moment('2026-10-31'), null, base).result;
  const group = [
    {
      key: 'g',
      rows: [
        { rowid: 'normal', startTime: '2026-10-12', endTime: '2026-10-14', left: 999, right: 999, extra: 'keep' },
        { rowid: 'hours', startTime: '2026-10-12 12:00', endTime: '2026-10-14 18:00' },
        {
          rowid: 'drag',
          startTime: '2026-10-12',
          endTime: '2026-10-14',
          dragStartTime: '2026-10-13',
          dragEndTime: '2026-10-15',
        },
        { rowid: 'missing', startTime: '', endTime: '' },
        { rowid: 'reversed', startTime: '2026-10-14', endTime: '2026-10-12' },
        { rowid: 'before', startTime: '2026-09-01', endTime: '2026-09-02' },
        { rowid: 'after', startTime: '2026-11-01', endTime: '2026-11-02' },
        { rowid: 'milestone', startTime: '2026-10-14 12:00', endTime: '2026-10-14 12:00', milestone: '1' },
      ],
      startTime: '2026-10-12',
      endTime: '2026-10-15',
      left: 999,
      right: 999,
      extra: 'group',
    },
  ];
  const original = structuredClone(group);

  for (const onlyWorkDay of [false, true]) {
    for (const periodType of [0, 1, 2, 3, 4])
      compare('groupingTimeBlock', [group, timeline, { ...base, onlyWorkDay, periodType, milepost: 'milestone' }]);
  }

  const blocks = current.groupingTimeBlock(group, timeline, {
    ...base,
    onlyWorkDay: false,
    periodType: 0,
    milepost: 'milestone',
  });
  assert.equal(blocks[0]?.rows[0]?.['left'], 330);
  assert.equal(blocks[0]?.rows[0]?.['width'], 90);
  assert.equal(blocks[0]?.rows[0]?.['right'], undefined);
  assert.equal(blocks[0]?.rows[0]?.['extra'], 'keep');
  assert.deepEqual(group, original, 'Time-block geometry must preserve source data');
  assert.equal(current.groupingTimeBlock(group, [], { ...base, periodType: 0 }), group);

  const colorControl = {
    controlId: 'status',
    enumDefault2: 1,
    options: [
      { key: 'a', color: 'red' },
      { key: 'other', color: 'blue' },
    ],
  };
  check('fillRecordTimeBlockColor', [{ status: '["a"]' }, colorControl], { status: '["a"]', color: 'red' });
  check('fillRecordTimeBlockColor', [{ status: '["other:any"]' }, colorControl], {
    status: '["other:any"]',
    color: 'blue',
  });
  check('fillRecordTimeBlockColor', [{ status: '[]' }, colorControl], { status: '[]', color: 'var(--color-primary)' });
  check('fillRecordTimeBlockColor', [{ rowid: 'r' }], { rowid: 'r', color: 'var(--color-primary)' });
  assert.equal(current.fillRecordTimeBlockColor({ status: '[42]' }, colorControl).color, 'var(--color-primary)');
  compare('fillRecordsTimeBlockColor', [[{ key: 'g', rows: [{ status: '["a"]' }, { status: '[]' }] }], colorControl]);

  const indexed = [
    {
      groupingIndex: 4,
      rows: [
        { rowid: 'unarranged', diff: 0 },
        { rowid: 'r', diff: 2 },
      ],
    },
  ];
  check('getRecordIndex', ['r', indexed, false], 5);
  check('getRecordIndex', ['r', indexed, true], 6);
  check('getRecordIndex', ['unarranged', indexed, false], null);
  check('getRecordIndex', ['absent', indexed, true], null);
  const groups = [
    { key: 'a', sort: 2 },
    { key: '-1', sort: 0 },
    { key: 'b', sort: 1 },
  ];
  check('sortGrouping', [groups], [groups[2], groups[0], groups[1]]);
  compare('sortGrouping', [
    groups,
    { viewControl: 'status', advancedSetting: { customitems: '["a","b"]' } },
    [{ controlId: 'status', type: 9 }],
  ]);
  check('getMaxTime', [[{ endTime: '2026-10-12' }, { endTime: '2026-10-16' }]], '2026-10-16');
  check('getMaxTime', [[{ endTime: null }, { endTime: '1960-01-01' }]], null);
  check('getMaxTime', [[]], undefined);
  check('timeToPercentage', ['2026-10-14', 100], 0);
  check('timeToPercentage', ['2026-10-14 23:59', 100], 100);
  check('percentageToTime', [100], 23.99);
  const controls = [
    { controlId: 'ctime', type: 16 },
    { controlId: 'date', type: 15 },
    { controlId: 'calc', type: 38, enumDefault: 2 },
    { controlId: 'lookup', type: 30, sourceControlType: 16, strDefault: '0' },
    { controlId: 'unstored', type: 30, sourceControlType: 16, strDefault: '1' },
    { controlId: 'text', type: 2 },
  ];
  check('getControlsForGunter', [controls], [controls[1], controls[2], controls[3]]);
  for (const [control, expected] of [
    [{ type: 10 }, true],
    [{ type: 30, sourceControlType: 26, enumDefault: 1 }, true],
    [{ type: 29, enumDefault: 2 }, true],
    [{ type: 9 }, false],
    [{}, false],
  ] as const) {
    check('isGunterGroupMultiSelectControl', [control], expected);
  }
} finally {
  moment.now = previousNow;
  moment.locale(previousLocale);
}

console.log(
  `Gunter calendar, geometry, record, color and sorting regressions passed (${comparisons} checks${historical ? ' with historical comparison' : ''})`,
);
