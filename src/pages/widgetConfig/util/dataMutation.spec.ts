const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const update = require('immutability-helper');
const root = path.resolve(__dirname, '../../../..');
const target = 'src/pages/widgetConfig/util/data.tsx';
type Widget = {
  controlId: string;
  size: number;
  alias?: string;
  type?: number;
  sectionId?: string;
  [key: string]: unknown;
};
let scheduled: { callback: () => void; delay: number }[] = [];
let events: unknown[] = [];
let featureStatus: string | undefined;
let exceedsLimit = false;
const testGlobal = globalThis as unknown as Record<string, unknown>;
testGlobal['_l'] = (value: string) => value;
testGlobal['alert'] = (...args: unknown[]) => events.push(['alert', ...args]);
testGlobal['document'] = { getElementById: () => null };

function load(source: string, imports: Record<string, unknown> = {}): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformSync(source, { filename: target, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', 'setTimeout', code)(
    output,
    output.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name === 'react/jsx-runtime') return require(name);
      throw new Error('Unexpected import: ' + name);
    },
    (callback: () => void, delay: number) => scheduled.push({ callback, delay }),
  );
  return output.exports;
}

function declaration(source: string, name: string): string {
  const marker = 'const ' + name + ' =';
  const start = source.indexOf(marker);
  const end = source.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start, name);
  return 'export ' + source.slice(start, end + 3);
}

function invoke(module: object, name: string, args: unknown[]): unknown {
  const fn: unknown = Reflect.get(module, name);
  if (typeof fn !== 'function') throw new Error('Missing function: ' + name);
  return Reflect.apply(fn, undefined, args);
}

// Execute the current layout, grouping, deletion and ID matching producers used by the mutations.
const indexSource = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
const prefix = 'import _ from "lodash"; const { includes, get, sortBy, filter, isEmpty } = _;\n';
const helpers = load(
  prefix +
    ['isSheetDisplay', 'getCurrentRowSize', 'fixedBottomWidgets', 'getBoundRowByTab']
      .map(name => declaration(indexSource, name))
      .join('\n'),
  { lodash },
);
const configSource = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/index.ts'), 'utf8');
const fullLine = configSource.match(/export const FULL_LINE_CONTROL = (\[[^;]+\]);/)?.[1];
assert.ok(fullLine);
const dragConfig = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/Drag.ts'), 'utf8'));
const widgets = load(fs.readFileSync(path.join(__dirname, 'widgets.ts'), 'utf8'), {
  lodash,
  'immutability-helper': update,
  '../config': { FULL_LINE_CONTROL: JSON.parse(fullLine) },
  '../config/Drag': dragConfig,
  './index': helpers,
});
Object.assign(
  helpers,
  load(
    prefix +
      'import { isFullLineControl } from "./widgets";\n' +
      'const WHOLE_SIZE = 12; const getDefaultSizeByData = () => { throw new Error("Fixture must provide its width"); };\n' +
      declaration(indexSource, 'putControlByOrder'),
    { lodash, './widgets': widgets },
  ),
);
const dragSource = fs.readFileSync(path.join(__dirname, 'drag.ts'), 'utf8');
const drag = load(
  prefix +
    ['removeEmptyRow', 'removeSrcItems', 'batchRemoveItems'].map(name => declaration(dragSource, name)).join('\n'),
  { lodash },
);
const deletes = load(fs.readFileSync(path.join(__dirname, 'deleteTarget.ts'), 'utf8'));
const source = fs.readFileSync(path.join(root, target), 'utf8');
const imports: Record<string, unknown> = Object.fromEntries(
  [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => [match[1], {}]),
);
Object.assign(imports, {
  '.': helpers,
  lodash,
  'immutability-helper': update,
  '../config/Drag': dragConfig,
  './widgets': widgets,
  './drag': drag,
  './deleteTarget': deletes,
  'ming-ui': { Dialog: { confirm: (options: { onOk: () => void }) => options.onOk() } },
  './setting': { isExceedMaxControlLimit: () => exceedsLimit },
  'src/utils/project': { getFeatureStatus: () => featureStatus },
  'src/components/upgradeVersion': {
    buriedUpgradeVersionDialog: (...args: unknown[]) => events.push(['upgrade', ...args]),
  },
});
const current = load(source, imports);
const before = process.env['DATA_MUTATION_BEFORE_REV'];
const historical = before
  ? load(cp.execFileSync('git', ['show', before + ':' + target], { cwd: root, encoding: 'utf8' }), imports)
  : undefined;
const a: Widget = { controlId: 'a', alias: 'A', size: 12, type: 2, note: 'retain' };
const b: Widget = { controlId: 'b', alias: 'B', size: 6, type: 2 };
const c: Widget = { controlId: 'c', alias: 'C', size: 6, type: 2 };
const d: Widget = { controlId: 'd', alias: 'D', size: 12, type: 2 };
type Context = ReturnType<typeof context>;
function context(layout: Widget[][]) {
  const widgets = structuredClone(layout);
  return {
    widgets,
    allControls: widgets.flat(),
    activeWidget: widgets[0]?.[0],
    globalSheetInfo: { projectId: 'project' },
    setWidgets: (value: unknown) => events.push(['widgets', structuredClone(value)]),
    setActiveWidget: (value: unknown) => events.push(['active', structuredClone(value)]),
    setBatchActive: (value: unknown) => events.push(['batch', structuredClone(value)]),
  };
}

function execute(
  module: object,
  name: string,
  make: (ctx: Context) => unknown[],
  layout: Widget[][] = [[a], [b, c]],
): unknown[] {
  events = [];
  scheduled = [];
  const ctx = context(layout);
  const original = structuredClone(ctx.widgets);
  invoke(module, name, make(ctx));
  const delays = scheduled.map(task => task.delay);
  while (scheduled.length) scheduled.shift()?.callback();
  assert.deepEqual(ctx.widgets, original, name + ' must preserve the original layout');
  return [events, delays];
}

let checks = 0;

function compare(name: string, make: (ctx: Context) => unknown[], expected?: unknown, layout?: Widget[][]): void {
  const result = execute(current, name, make, layout);
  if (expected !== undefined) assert.deepEqual(result, expected, name);
  if (historical) assert.deepEqual(result, execute(historical, name, make, layout), 'Historical ' + name);
  checks++;
}

compare('handleDeleteWidgetsForMingo', ctx => [{ needDeleteWidgets: ['b'] }, ctx], [[['widgets', [[a], [c]]]], []]);
compare('handleDeleteWidgetsForMingo', ctx => [{ needDeleteWidgets: [{ alias: 'A' }] }, ctx], [
  [['widgets', [[], [b, c]]]],
  [],
]);
compare('handleDeleteWidgetsForMingo', ctx => [
  { needDeleteWidgets: ['unknown'] },
  ctx,
  (value: unknown) => events.push(['callback', value]),
]);
compare('handleUpdateWidgetsAttribute', ctx => [
  { needUpdateWidgets: [{ alias: 'B', controlName: 'renamed' }] },
  ctx,
  (value: unknown) => events.push(['callback', value]),
]);
compare('handleUpdateWidgetsAttribute', ctx => [
  { needUpdateWidgets: [{ alias: 'unknown', controlName: 'ignore' }] },
  ctx,
]);
compare('batchUpdateWidgetsLayout', ctx => [
  { a: { row: 1, col: 0, size: 12 }, b: { row: 0, col: 1, size: 6 }, c: { row: 0, col: 0, size: 6 } },
  ctx,
]);
compare('batchUpdateWidgetsLayout', ctx => [{}, ctx, () => events.push(['callback'])]);
compare('batchResetWidgets', ctx => [ctx, [{ ...b, controlName: 'replacement' }]], [
  [['widgets', [[a], [{ ...b, controlName: 'replacement' }, c]]]],
  [],
]);
compare('handleMoveWidgets', ctx => [
  [
    { ...b, controlId: 'new-b' },
    { ...c, controlId: 'new-c' },
  ],
  ctx,
]);
compare('handleMoveWidgets', ctx => [[], ctx]);
for (const reverse of [false, true]) {
  compare('batchShiftWidgets', ctx => [{ ...ctx, batchActive: [reverse ? c : a], data: reverse ? a : c }], [
    [['batch', [a, b, c]]],
    [],
  ]);
}

compare('batchShiftWidgets', ctx => [{ ...ctx, batchActive: [a], data: { ...d, controlId: 'missing' } }], [[], []]);
compare('clearAndSetWidgets', ctx => [[b, c], {}, ctx, () => events.push(['callback'])], [
  [['widgets', [[b], [c]]], ['callback']],
  [],
]);
exceedsLimit = true;
compare('clearAndSetWidgets', ctx => [[b], {}, ctx]);
compare('handleMoveWidgets', ctx => [[b], ctx]);
exceedsLimit = false;
featureStatus = '2';
compare('clearAndSetWidgets', ctx => [[{ ...b, type: 49, featureId: 5 }], {}, ctx], [[['upgrade', 'project', 5]], []]);
featureStatus = undefined;
const child: Widget = { ...d, sectionId: 'tab' };
const tab: Widget = { controlId: 'tab', type: 52, size: 12, relationControls: [child] };
compare('deleteSection', ctx => [{ widgets: ctx.widgets, data: tab }, ctx], undefined, [[a], [tab], [child]]);
// Missing mutation targets are safe no-ops rather than computed undefined paths or absent-array errors.
assert.deepEqual(
  execute(current, 'handleDeleteWidgetsForMingo', ctx => [{}, ctx]),
  [[['widgets', [[a], [b, c]]]], []],
);
assert.deepEqual(
  execute(current, 'handleUpdateWidgetsAttribute', ctx => [{}, ctx]),
  [[['widgets', [[a], [b, c]]]], []],
);
assert.deepEqual(
  execute(current, 'batchResetWidgets', ctx => [ctx, [d]]),
  [[['widgets', [[a], [b, c]]]], []],
);
assert.deepEqual(
  execute(current, 'handleMoveWidgets', ctx => [[d], { ...ctx, activeWidget: undefined }]),
  [[], []],
);
assert.deepEqual(
  execute(current, 'deleteSection', ctx => [{ widgets: ctx.widgets, data: { controlId: 'empty-tab', type: 52 } }, ctx]),
  [
    [
      ['widgets', [[a], [b, c]]],
      ['active', {}],
    ],
    [],
  ],
);
console.log(
  `Widget mutation callbacks, layout, moves, deletion, shift selection and source preservation passed (${checks} cases${historical ? ' with historical comparison' : ''})`,
);
