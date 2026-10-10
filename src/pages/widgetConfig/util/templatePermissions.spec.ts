const assert = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const traverse: typeof import('@babel/traverse').default = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const boundary = require('./templatePermissionBoundary.ts');
const source = fs.readFileSync(path.join(__dirname, 'createTemplate.tsx'), 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const actual = ast.program.body.find(
  node => node.type === 'FunctionDeclaration' && node.id?.name === 'getBatchPermission',
);
assert.ok(actual, 'Use the actual sync API caller');
let response: unknown = {};
const calls: unknown[][] = [];
const helper = new Function(
  'worksheetAjax',
  '_',
  'decodeTemplatePermissions',
  transformSync(generate(actual).code, { filename: path.join(__dirname, 'createTemplate.tsx') }).code +
    '\nreturn getBatchPermission;',
)(
  {
    getWorksheetsRoleType: (...args: unknown[]) => {
      calls.push(args);
      return response;
    },
  },
  require('lodash'),
  boundary.decodeTemplatePermissions,
) as (ids: Array<string | undefined>) => unknown;
const metadata = { future: true };
const item = { worksheetId: 'sheet', name: 'Source', roleType: 2, metadata };
const list = [item];
response = { data: list };
const ids = ['sheet', undefined];
assert.equal(helper(ids), list, 'The original array identity is retained');
assert.equal(list[0]?.metadata, metadata);
assert.deepEqual(calls.at(-1), [{ worksheetIds: ids }, { ajaxOptions: { sync: true } }]);
const before = calls.length;
assert.deepEqual(helper([]), []);
assert.equal(calls.length, before, 'An empty request stays local');
for (const data of [undefined, null, false, '', 0]) {
  response = { data };
  assert.deepEqual(helper(['sheet']), [], 'Preserve the original falsy data fallback');
}
response = { data: [{ worksheetId: 'sheet' }] };
assert.deepEqual(helper(['sheet']), [{ worksheetId: 'sheet' }]);
for (const data of [
  {},
  [null],
  [{ worksheetId: 4 }],
  [{ worksheetId: 'sheet', name: 7 }],
  [{ worksheetId: 'sheet', roleType: '2' }],
  new Array(1),
]) {
  response = { data };
  assert.throws(() => helper(['sheet']), TypeError, 'Malformed permissions cannot become successful empty data');
}
const cyclic: Record<string, unknown> = { worksheetId: 'cyclic' };
cyclic['self'] = cyclic;
response = { data: [cyclic] };
assert.equal(
  (helper(['cyclic']) as unknown[])[0],
  cyclic,
  'Opaque cyclic metadata is not cloned or recursively inspected',
);
console.log('Actual sync template permission requests, reference and malformed-data protocols passed');

let effect: import('@babel/types').ArrowFunctionExpression | undefined;
let save: import('@babel/types').ArrowFunctionExpression | undefined;
let retry: import('@babel/types').ArrowFunctionExpression | undefined;
let disabled: import('@babel/types').Expression | undefined;
let entry: import('@babel/types').ArrowFunctionExpression | undefined;
traverse(ast.program, {
  noScope: true,
  CallExpression(node) {
    const { callee, arguments: args } = node.node;
    if (
      callee.type === 'Identifier' &&
      callee.name === 'useEffect' &&
      args[0]?.type === 'ArrowFunctionExpression' &&
      generate(args[0]).code.includes('getAllReferencedControls')
    )
      effect = args[0];
  },
  VariableDeclarator(node) {
    if (node.node.id.type !== 'Identifier' || node.node.init?.type !== 'ArrowFunctionExpression') return;
    if (node.node.id.name === 'handleOk') save = node.node.init;
    if (node.node.id.name === 'createTemplateDialog') entry = node.node.init;
  },
  JSXAttribute(node) {
    const { name, value } = node.node;
    if (
      name.type !== 'JSXIdentifier' ||
      value?.type !== 'JSXExpressionContainer' ||
      value.expression.type === 'JSXEmptyExpression'
    )
      return;
    if (name.name === 'okDisabled') disabled = value.expression;
    if (
      name.name === 'onClick' &&
      value.expression.type === 'ArrowFunctionExpression' &&
      generate(value.expression).code.includes('setReferenceRetry')
    )
      retry = value.expression;
  },
});
assert.ok(
  effect && save && retry && disabled && entry,
  'Execute the actual effect, save, retry, disabled and entry source',
);
function closure(node: unknown, environment: Record<string, unknown>): (...args: unknown[]) => unknown {
  const code = transformSync('const target = ' + generate(node).code, {
    filename: path.join(__dirname, 'createTemplate.tsx'),
  }).code;
  return new Function(...Object.keys(environment), code + '\nreturn target;')(...Object.values(environment));
}
function expression(node: unknown, environment: Record<string, unknown>): unknown {
  return new Function(...Object.keys(environment), 'return ' + generate(node).code)(...Object.values(environment));
}
const control = { controlId: 'control', type: 29, controlName: 'Linked' };
const alerts: unknown[][] = [];
const resolved: unknown[] = [];
const errors: unknown[] = [];
let retries = 0;
let opened = 0;
let saved = 0;
const permissionInfo = () => {
  helper(['sheet']);
  return { referencedControls: [control], noPermissionSheetNames: [], deletedWorksheetControlNames: [] };
};
const environment: Record<string, unknown> = {
  loading: false,
  templateInfo: {},
  templateControls: [control],
  allControls: [control],
  queryConfigs: [],
  _: require('lodash'),
  getAllReferencedControls: () => permissionInfo().referencedControls,
  getAllReferencedControlInfo: permissionInfo,
  setResolvedReferencedControls: (value: unknown) => resolved.push(value),
  setReferenceError: (value: unknown) => errors.push(value),
  referenceExpandNoticeShownRef: { current: false },
  alert: (...args: unknown[]) => alerts.push(args),
  _l: (key: string) => key,
  isValidControl: () => true,
  setReferenceRetry: (update: (count: number) => number) => {
    retries = update(retries);
  },
  saving: false,
  referenceError: undefined,
  type: 1,
  templateInfoState: { name: 'Name' },
  templatePersonalList: [],
  templateOrganizationList: [],
  resolvedReferencedControls: null,
  globalSheetInfo: { projectId: 'project' },
  md: { global: { Account: { accountId: 'user' } } },
  formatControlsData: (value: unknown) => value,
  setSaving: () => {},
  setVisible: () => {},
  setConfig: () => {},
  worksheetAjax: {
    saveControlTemplate: () => {
      saved++;
      return Promise.resolve({ data: 'template' });
    },
  },
  supportCreateTemplate: () => true,
  alertPermissionError: () => false,
  CreateTemplateDialog: 'dialog',
  functionWrap: () => {
    opened++;
    return 'opened';
  },
};
response = { data: [{ worksheetId: 'sheet', name: 'Linked', roleType: '2' }] };
assert.doesNotThrow(() => closure(effect, environment)());
assert.deepEqual(resolved, [], 'Failed effect keeps prior referenced controls');
assert.equal(errors.at(-1), '获取引用字段权限失败，请重试');
assert.equal(expression(disabled, { name: 'Name', referenceError: errors.at(-1) }), true);
assert.doesNotThrow(() => closure(save, environment)());
assert.equal(saved, 0, 'A failed fallback permission request cannot save a template');
assert.equal(alerts.at(-1)?.[0], '获取引用字段权限失败，请重试');
assert.equal(closure(entry, environment)({ allControls: [control], templateControls: [control] }), undefined);
assert.equal(opened, 0, 'Creation failure does not open a falsely valid dialog');
assert.equal(closure(retry, environment)(), undefined);
assert.equal(retries, 1, 'Click the actual retry operation');
response = { data: [{ worksheetId: 'sheet', name: 'Linked', roleType: 2 }] };
closure(effect, environment)();
assert.deepEqual(resolved.at(-1), [control]);
assert.equal(errors.at(-1), undefined);
assert.equal(expression(disabled, { name: 'Name', referenceError: undefined }), false);
assert.equal(closure(entry, environment)({ allControls: [control], templateControls: [control] }), 'opened');
assert.equal(opened, 1, 'Successful retry can create the dialog normally');
closure(save, environment)();
assert.equal(saved, 1, 'Successful retry reaches the real save closure');
console.log('Actual permission effect, save, create, disabled-state and retry closures passed');
