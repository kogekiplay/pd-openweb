const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const traverse = require('@babel/traverse').default;
const { transformFileSync, transformSync } = require('../../scripts/spec-harness.ts');
const EventEmitter = require('events');
function boundary() {
  const target: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', transformFileSync(path.join(__dirname, 'mingoStoreBoundary.ts')).code)(
    target,
    target.exports,
    (name: string) => {
      if (name === 'events') return EventEmitter;
      throw new Error('Unstubbed Mingo boundary dependency: ' + name);
    },
  );
  return target.exports;
}
const product = fs.readFileSync(path.join(__dirname, 'common.ts'), 'utf8');
const tree = parser.parse(product, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const names = ['globalStoreForMingo', 'updateGlobalStoreForMingo', 'getGlobalStoreForMingo'];
const nodes = tree.program.body
  .map(node => (node.type === 'ExportNamedDeclaration' ? node.declaration : node))
  .filter(
    node =>
      node &&
      ((node.type === 'VariableDeclaration' && node.declarations.some(item => names.includes(item.id.name))) ||
        (node.type === 'FunctionDeclaration' && names.includes(node.id.name))),
  );
assert.equal(nodes.length, 3);
const globals = { window: {} as Record<string, unknown>, EventEmitter, ...boundary() };
const target: { exports: unknown } = { exports: {} };
new Function(
  'module',
  ...Object.keys(globals),
  transformSync(
    nodes.map(node => generate(node).code).join('\n') +
      '\nwindow.globalStoreForMingo=globalStoreForMingo;module.exports={updateGlobalStoreForMingo,getGlobalStoreForMingo};',
    { filename: path.join(__dirname, 'common.ts') },
  ).code,
)(target, ...Object.values(globals));
interface Store {
  emitter?: {
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    emit(event: string, ...args: unknown[]): boolean;
  };
  activeModule?: string;
  [key: string]: unknown;
}
const common = target.exports as {
  updateGlobalStoreForMingo(key: unknown, value?: unknown): void;
  getGlobalStoreForMingo(key?: string | null): unknown;
};
const get = common.getGlobalStoreForMingo,
  update = common.updateGlobalStoreForMingo;
const store = get() as Store;
assert.equal(globals.window.globalStoreForMingo, store);
assert.equal(get(''), store);
assert.equal(get(null), store);
assert.equal(get('activeModule'), 'worksheet');
assert.equal(store.emitter instanceof EventEmitter, true);
const emitter = store.emitter;
const eventValues: unknown[] = [];
emitter?.on('opaque', (...args) => eventValues.push(args));
emitter?.emit('opaque', { message: 'before clear' });
assert.deepEqual(eventValues, [[{ message: 'before clear' }]]);
const nested = { SDKCallback: () => 'local-only', rowid: 5 };
const widgets = [
  { controlId: 'field', alias: 'title', controlName: 'Name', type: 2, description: 'Description', nested },
];
update('allWidgets', widgets);
assert.equal(get('allWidgets'), widgets);
assert.equal(store['allWidgets'], widgets);
update({
  activeModule: 'workflow',
  appId: 'app',
  projectId: 'project',
  sectionId: 'section',
  appName: 'App',
  appDescription: 'Description',
});
assert.equal(get('activeModule'), 'workflow');
assert.equal(get('appId'), 'app');
update({ activeModule: 'worksheetControlsEdit', worksheetId: 'sheet', worksheetName: 'Sheet' }, 'clear');
assert.equal(get(), store, 'clear retains the live store object reference');
assert.equal(globals.window.globalStoreForMingo, store);
assert.equal(
  get('emitter'),
  undefined,
  'clear removes the initial store emitter rather than constructing a replacement',
);
assert.equal(get('allWidgets'), undefined);
assert.equal(get('appId'), undefined);
assert.equal(get('activeModule'), 'worksheetControlsEdit');
emitter?.emit('opaque', 'after clear');
assert.deepEqual(
  eventValues.at(-1),
  ['after clear'],
  'clear deletes the store slot but does not destroy external emitter references',
);
update('appId');
assert.equal(Object.hasOwn(store, 'appId'), true);
assert.equal(get('appId'), undefined, 'single-key omitted value remains an own undefined slot');
update({ metadata: nested });
assert.equal(get('metadata'), nested, 'future metadata/callbacks retain their reference and remain opaque');
// Execute real producer and reader closures, without mounting a page or using the SDK/network.
const root = path.resolve(__dirname, '../..');
function productFunction(relative: string, name: string, values: Record<string, unknown>) {
  const file = path.join(root, relative),
    source: string = fs.readFileSync(file, 'utf8'),
    ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let body = '';
  traverse(ast, {
    FunctionDeclaration(p) {
      if (p.node.id?.name === name) body = generate(p.node).code;
    },
  });
  assert.ok(body, name);
  const target: { exports: unknown } = { exports: {} };
  new Function(
    'module',
    ...Object.keys(values),
    transformSync(body + '\nmodule.exports=' + name, { filename: file }).code,
  )(target, ...Object.values(values));
  return target.exports;
}
const workflowWriter = productFunction(
  'src/pages/workflow/WorkflowList/AppWorkflowList.tsx',
  'updateWorkflowMingoStore',
  {
    updateGlobalStoreForMingo: update,
    _: require('lodash'),
  },
) as (detail: unknown) => void;
workflowWriter({
  id: 'workflow-app',
  projectId: 'workflow-project',
  sections: [{ appSectionId: 'workflow-section' }],
  name: 'Workflow',
  description: 'Workflow description',
});
assert.equal(get('activeModule'), 'workflow');
assert.equal(get('appId'), 'workflow-app');
assert.equal(get('sectionId'), 'workflow-section');
const readApp = productFunction('src/components/Mingo/modules/CreateWorksheetBot/index.tsx', 'getCurrentAppData', {
  window: globals.window,
  flatten: require('lodash').flatten,
  ...boundary(),
}) as (input?: unknown) => unknown;
assert.deepEqual(readApp(), {
  activeModule: 'workflow',
  appId: 'workflow-app',
  appName: 'Workflow',
  projectId: 'workflow-project',
  sectionId: 'workflow-section',
  appDescription: 'Workflow description',
});
update(
  {
    activeModule: 'worksheetControlsEdit',
    worksheetId: 'sheet',
    worksheetName: 'Sheet',
    projectId: 'project',
    appId: 'app',
    appName: 'App',
  },
  'clear',
);
assert.deepEqual(readApp(), {
  activeModule: 'worksheet',
  appId: 'app',
  appName: 'App',
  worksheetId: 'sheet',
  worksheetName: 'Sheet',
  projectId: 'project',
});
const cacheReader = productFunction('src/components/Mingo/index.tsx', 'getDefaultValueOfMingoCache', {
  window: globals.window,
  md: { global: { Account: { accountId: 'account' } } },
  localStorage: { getItem: () => JSON.stringify({ worksheetId: 'sheet', cached: true }) },
  safeParse: JSON.parse,
  get: require('lodash').get,
}) as () => unknown;
assert.deepEqual(cacheReader(), { worksheetId: 'sheet', cached: true });
update({ activeModule: 'worksheet' }, 'clear');
const directSheet = { type: 0, workSheetId: 'sheet1', workSheetName: 'Direct', remark: 'Remark' };
const groupedSheet = { type: 0, workSheetId: 'sheet2', workSheetName: 'Grouped' };
globals.window.appInfo = { name: 'App', projectId: 'project', description: 'Description' };
assert.deepEqual(
  readApp({
    base: { appId: 'app', worksheetId: 'sheet1', groupId: 'section' },
    sheetList: { data: [directSheet, { type: 1, items: [groupedSheet] }] },
  }),
  {
    activeModule: 'worksheetControlsEdit',
    appId: 'app',
    worksheetId: 'sheet1',
    projectId: 'project',
    sectionId: 'section',
    worksheets: [directSheet, groupedSheet],
    appName: 'App',
    appDescription: 'Description',
  },
);
assert.deepEqual(cacheReader(), {});
const savedWindowStore = globals.window.globalStoreForMingo;
delete globals.window.globalStoreForMingo;
assert.deepEqual(cacheReader(), {}, 'pre-initialization window state is a real optional branch');
globals.window.globalStoreForMingo = savedWindowStore;
for (const [key, value] of [
  ['activeModule', 'invalid'],
  ['allWidgets', {}],
  ['allWidgets', [null]],
  ['allWidgets', [{ alias: 3 }]],
  ['appId', 42],
  ['emitter', { emit() {} }],
])
  assert.throws(() => update(key, value));
const previousKeys = Object.keys(store);
assert.throws(() => update({ appId: 42 }, 'clear'));
assert.deepEqual(Object.keys(store), previousKeys, 'invalid clear input never discards the existing valid context');
assert.throws(() => update({ allWidgets: new Array(2) }, 'clear'));
assert.deepEqual(Object.keys(store), previousKeys, 'sparse widget array fails before clearing valid state');
update(store, 'clear');
assert.deepEqual(Object.keys(store), [], 'clearing with the same live store argument retains the old alias semantics');
console.log('Mingo key-value context, widget/callback identity, emitter and live-reference clear tests passed');
