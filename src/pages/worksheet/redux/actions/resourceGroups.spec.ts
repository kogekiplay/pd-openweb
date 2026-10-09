const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
interface TestAction {
  type: string;
  data: unknown;
}
interface ModuleSurface {
  fetchRows(refresh?: boolean): (dispatch: (action: TestAction) => void, getState: () => unknown) => void;
}
const moduleState: { exports: unknown } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'resourceview.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
let response: unknown = [{ key: 'group', name: 'One', sort: 1, rows: [], customMetadata: 'retained' }];
const stubs: Record<string, unknown> = {
  'src/api/worksheet': {
    getFilterRows: () => ({ then: (callback: (value: unknown) => void) => callback({ data: response }) }),
  },
  'src/pages/worksheet/redux/actions/util.js': { sortDataByCustomItems: (rows: unknown) => rows },
  'src/pages/worksheet/views/CalendarView/util.js': {},
  'src/pages/worksheet/views/GunterView/util.js': { sortGrouping: (rows: unknown) => rows },
  'src/pages/worksheet/views/ResourceView/config.js': { types: ['Day'], pageSize: 50, kanbanSize: 50 },
  'src/pages/worksheet/views/ResourceView/util.js': {
    calculateTop: (rows: unknown) => ({ data: rows, totalHeight: 0 }),
  },
  'src/utils/common': { browserIsMobile: () => false, getFilledRequestParams: (args: unknown) => args },
  'src/utils/control': {},
  'src/utils/filter': { formatQuickFilter: (rows: unknown) => rows },
  'src/utils/project': { dateConvertToUserZone: (value: unknown) => value },
  'src/utils/translate.js': {},
};
new Function('module', 'exports', 'require', code)(
  moduleState,
  moduleState.exports,
  (name: string) => stubs[name] || require(name),
);
const resource = moduleState.exports as ModuleSurface;
global.window = { shareState: {} };
global.localStorage = { getItem: () => null };
const state = {
  mobile: { filterControls: [] },
  sheet: {
    base: { appId: 'app', viewId: 'view', worksheetId: 'sheet' },
    controls: [],
    views: [{ viewId: 'view', advancedSetting: {} }],
    filters: {},
    quickFilter: [],
    resourceview: { gridTimes: [{ date: '2026-10-09' }], currentTime: null, keywords: 'One' },
  },
};
const dispatched: TestAction[] = [];
const run = () =>
  resource.fetchRows()(
    action => dispatched.push(action),
    () => state,
  );
run();
assert.deepStrictEqual(dispatched.find(action => action.type === 'CHANGE_RESOURCE_RESOURCE_DATA')?.data, [
  { key: 'group', name: 'One', sort: 1, rows: [], customMetadata: 'retained', height: 0 },
]);
assert.deepStrictEqual(dispatched.find(action => action.type === 'CHANGE_RESOURCE_RESOURCE_DATA_BY_KEY')?.data, [
  { key: 'group', name: 'One', sort: 1, rows: [], customMetadata: 'retained', height: 0 },
]);
response = [{ key: 'group', name: 42, rows: [] }];
assert.throws(run, /Invalid resource view group rows/);
response = [{ key: 'group', name: 'One', rows: [42] }];
assert.throws(run, /Invalid resource view group rows/);
response = undefined;
assert.throws(run, /Invalid resource view group rows/);
console.log('Resource group response validation and original metadata preservation passed');
