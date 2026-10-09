const assert = require('assert');
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { transformSync, transformFileSync } = require('../../scripts/spec-harness.ts');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../..');

type TestMethod = (this: object, ...args: unknown[]) => unknown;
/** Compile the actual method body, rather than duplicating the boundary implementation in the test. */
function method(file: string, name: string, globals: Record<string, unknown>): TestMethod {
  const source: string = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let expression = '';
  traverse(ast, {
    ClassMethod(p) {
      if (p.node.key.name === name) expression = 'function ' + source.slice(p.node.key.end, p.node.end);
    },
    ClassProperty(p) {
      if (p.node.key.name === name) {
        const value = p.node.value;
        const params = value.params.map(param => source.slice(param.start, param.end)).join(', ');
        expression = 'function (' + params + ') ' + source.slice(value.body.start, value.body.end);
      }
    },
  });
  assert.ok(expression, file + ' has ' + name);
  const { code } = transformSync('const target = ' + expression + '; module.exports = target;', {
    filename: path.join(root, file),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const module: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', ...Object.keys(globals), code)(module, module.exports, ...Object.values(globals));
  assert.strictEqual(typeof module.exports, 'function');
  return module.exports as TestMethod;
}
const updates: unknown[] = [];
let query: Record<string, unknown> = {};
const initParam = method('src/pages/globalSearch/index.tsx', 'initParam', {
  getRequest: () => query,
  NEED_ALL_ORG_TAB: ['post', 'task', 'kcnode'],
  getCurrentProjectId: () => 'current-org',
});
const search = {
  props: { search: '' },
  state: { searchType: 'record', projectId: 'selected-org', appProjectId: 'selected-app-org' },
  updateSearchParam: (value: unknown) => updates.push(value),
};
query = { search_type: 'record', search_key: 'needle' };
initParam.call(search);
assert.deepStrictEqual(updates.pop(), {
  searchKey: 'needle',
  searchType: 'record',
  projectId: 'selected-org',
  appProjectId: 'selected-app-org',
  pageIndex: 1,
  dateRange: undefined,
});
query = { search_type: 'post', search_key: 'needle' };
initParam.call(search);
assert.deepStrictEqual(updates.pop(), {
  searchKey: 'needle',
  searchType: 'post',
  projectId: 'all',
  appProjectId: 'current-org',
  pageIndex: 1,
  dateRange: undefined,
});
query = { search_type: ['record', 'post'], search_key: ['needle', 'other'] };
initParam.call(search);
assert.deepStrictEqual(
  updates.pop(),
  {
    searchKey: undefined,
    searchType: 'all',
    projectId: 'current-org',
    appProjectId: 'current-org',
    pageIndex: 1,
    dateRange: undefined,
  },
  'ambiguous query arrays cannot become a search type or keyword',
);
query = { search_type: null, search_key: null };
initParam.call(search);
assert.deepStrictEqual(updates.pop(), {
  searchKey: undefined,
  searchType: 'all',
  projectId: 'current-org',
  appProjectId: 'current-org',
  pageIndex: 1,
  dateRange: undefined,
});

const boundary: { exports: { embedUrlSegment?: (value: unknown) => string } } = { exports: {} };
new Function(
  'module',
  'exports',
  transformFileSync(path.join(root, 'src/pages/worksheet/views/CustomWidgetView/valueBoundary.ts'), {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code,
)(boundary, boundary.exports);
assert.strictEqual(typeof boundary.exports.embedUrlSegment, 'function');
let embedValue: unknown = '';
const opened: unknown[] = [];
const handleOpenSheet = method('src/pages/Mobile/App/index.tsx', 'handleOpenSheet', {
  _: lodash,
  addBehaviorLog() {},
  localStorage: { removeItem() {} },
  safeLocalStorageSetItem() {},
  transferValue: () => [{ staticValue: 'https://example.com/?field=' }, { cid: 'field' }],
  getEmbedValue: () => embedValue,
  embedUrlSegment: boundary.exports.embedUrlSegment,
  window: { open: (value: unknown) => opened.push(value) },
});
const mobile = {
  props: {
    match: { params: { appId: 'app', appSectionId: 'group', workSheetId: 'sheet' } },
    appDetail: { detail: { projectId: 'org' } },
  },
};
for (const value of ['text', 5, 1700000000000, false, true, null, undefined]) {
  embedValue = value;
  handleOpenSheet.call(
    mobile,
    { appSectionId: 'group' },
    { type: 1, workSheetId: 'sheet', urlTemplate: 'template', configuration: { openType: '2' } },
  );
  assert.strictEqual(
    opened.pop(),
    ['https://example.com/?field=', value].join(''),
    'embedded URL keeps the original Array.join conversion',
  );
}

for (const value of [['a', 'b'], { value: 'object' }, [{ rowid: 'row' }]]) {
  embedValue = value;
  handleOpenSheet.call(
    mobile,
    { appSectionId: 'group' },
    { type: 1, workSheetId: 'sheet', urlTemplate: 'template', configuration: { openType: '2' } },
  );
  assert.strictEqual(opened.pop(), 'https://example.com/?field=', 'array and object form values are not URL segments');
}

let project: { projectId?: string; companyName?: string } = {};
const loads: unknown[] = [],
  states: unknown[] = [];
const mount = method('src/pages/Mobile/AppHome/AppGroupList/index.tsx', 'componentDidMount', {
  _: lodash,
  getCurrentProject: () => project,
  localStorage: { getItem: () => 'org' },
  md: { global: { Account: { projects: [] } } },
  _l: (text: string) => text,
  actions: { getMyApp: (projectId: string) => ({ type: 'load', projectId }) },
});
const group = {
  props: { dispatch: (value: unknown) => loads.push(value) },
  setState: (value: unknown) => states.push(value),
};
project = { projectId: 'org', companyName: 'Organization' };
mount.call(group);
assert.deepStrictEqual(loads.pop(), { type: 'load', projectId: 'org' });
project = { companyName: 'Incomplete organization' };
mount.call(group);
assert.deepStrictEqual(
  loads.pop(),
  { type: 'load', projectId: 'external' },
  'missing organization identity uses the existing external collaboration branch',
);
assert.deepStrictEqual(states.pop(), { projectId: 'external' });
console.log('project caller string/query boundary tests passed');
