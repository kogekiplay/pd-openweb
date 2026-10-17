const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { transformSync } = require('../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const React = require('react');
const EventEmitter = require('node:events');
const root = path.resolve(__dirname, '../../../../..');
const file = 'src/pages/worksheet/components/ChildTableDialog.tsx';
global._l = (text: string) => text;
global.alert = () => {};

global.window = { innerWidth: 1366, innerHeight: 900, cellTextIsBlurring: false };

interface ElementFixture {
  type: unknown;
  props: Record<string, unknown>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findElement(value: unknown, predicate: (node: ElementFixture) => boolean): ElementFixture | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  } else if (object(value) && object(value['props'])) {
    const node = { type: value['type'], props: value['props'] };
    if (predicate(node)) return node;
    return findElement(node.props['children'], predicate);
  }

  return undefined;
}

function invoke(node: ElementFixture, key: string, ...args: unknown[]) {
  const callback = node.props[key];
  assert.equal(typeof callback, 'function', key);
  if (typeof callback !== 'function') throw new Error('Missing callback ' + key);
  return callback(...args);
}

function load(source: string, imports: Record<string, unknown>, timers: number[]) {
  const target = { exports: {} as Record<string, unknown> };
  const code = transformSync(source, { filename: path.join(root, file) }).code;
  new Function('module', 'exports', 'require', 'setTimeout', code)(
    target,
    target.exports,
    (name: string) => {
      if (name in imports) return imports[name];
      throw new Error('Unstubbed dialog import: ' + name);
    },
    (callback: () => void, delay: number) => {
      timers.push(delay);
      callback();
      return 0;
    },
  );
  return target.exports['default'] as (props: Record<string, unknown>) => unknown;
}

interface EditFixture {
  action: Record<string, unknown>;
  updated: Array<string | undefined>;
  deleted: Array<string | undefined> | undefined;
}
async function scenario(
  source: string,
  options: { editable: boolean; childSheet?: string; failure?: boolean; edit: EditFixture },
) {
  const hooks: unknown[] = [];
  let cursor = 0;
  const requests: unknown[] = [];
  const formatted: Array<Record<string, unknown>> = [];
  const validations: Array<Record<string, unknown>> = [];
  const errors: unknown[] = [];
  const events: unknown[] = [];
  const timers: number[] = [];
  const emitter = new EventEmitter();
  emitter.on('RELOAD_RECORD_INFO', (value: unknown) => events.push(value));
  const Button = () => null;
  const ChildTable = () => null;
  const styled = () => () => null;
  const Component = load(
    source,
    {
      react: {
        Fragment: React.Fragment,
        useEffect() {},
        useRef(initial: unknown) {
          const index = cursor++;
          if (!(index in hooks)) hooks[index] = { current: initial };
          return hooks[index];
        },
        useState(initial: unknown) {
          const index = cursor++;
          if (!(index in hooks)) hooks[index] = initial;
          return [
            hooks[index],
            (value: unknown) => {
              hooks[index] = typeof value === 'function' ? value(hooks[index]) : value;
            },
          ];
        },
      },
      'react/jsx-runtime': require('react/jsx-runtime'),
      'react-use': { useKey() {} },
      classnames: require('classnames'),
      lodash,
      'styled-components': { div: styled, span: styled, createGlobalStyle: styled },
      'ming-ui': { Button, Dialog: {}, Modal: () => null },
      'ming-ui/antd-components': { Tooltip: () => null },
      'ming-ui/components/FunctionWrap': () => null,
      'src/api/worksheet': {
        updateWorksheetRow(value: unknown) {
          requests.push(value);
          return Promise.resolve(options.failure ? { resultCode: 22, badData: ['duplicate'] } : { data: true });
        },
      },
      'worksheet/components/ChildTable': ChildTable,
      'worksheet/constants/enum': { ROW_HEIGHT: {} },
      'src/components/Form/core/formUtils': {
        onValidator(value: Record<string, unknown>) {
          validations.push(value);
          return {};
        },
      },
      'src/components/Form/core/utils': {
        formatControlToServer(value: Record<string, unknown>) {
          formatted.push(value);
          return value;
        },
      },
      'src/pages/widgetConfig/util': { formatSearchConfigs: (value: unknown) => value },
      'src/pages/worksheet/components/ChildTable/utils': { getSubListErrorOfStore: () => ({}) },
      'src/utils/common': { emitter },
    },
    timers,
  );
  let cleared = 0;
  let closed = 0;
  const store = {
    clearSubListErrors: () => cleared++,
    setUniqueError: (error: unknown) => errors.push(error),
  };
  const control = { controlId: 'sub-list', dataSource: options.childSheet, fieldPermission: '111' };
  const props = {
    openFrom: 'cell',
    allowEdit: options.editable,
    appId: 'app',
    worksheetId: 'master-sheet',
    viewId: 'master-view',
    recordId: 'master-row',
    control,
    controls: [{ controlId: 'child-field', type: 2 }],
    searchConfig: [],
    onClose: () => closed++,
  };

  const render = () => {
    cursor = 0;
    return Component(props);
  };

  let tree = render();

  const table = () => {
    const node = findElement(tree, element => element.type === ChildTable);
    if (!node) throw new Error('Missing real dialog table');
    return node;
  };

  const passedControl = table().props['control'];
  assert.ok(object(passedControl));
  if (!object(passedControl)) throw new Error('Missing child control');
  assert.equal(passedControl['worksheetId'], 'master-sheet', 'nested control retains the master worksheet ID');
  assert.equal(passedControl['dataSource'], options.childSheet, 'child data source is never replaced by master ID');
  assert.equal(passedControl['fieldPermission'], options.editable ? '111' : '100');
  invoke(table(), 'registerCell', { props: { store } });
  invoke(table(), 'onChange', { rows: [], originRows: [] });
  assert.equal(
    findElement(render(), node => node.type === Button),
    undefined,
    'missing action is ignored',
  );
  for (const isAddByTree of [true, 'legacy-flag']) {
    invoke(table(), 'onChange', {
      rows: [],
      lastAction: { type: 'ADD_ROWS', rows: [{ rowid: 'tree-row', isAddByTree }] },
    });
    assert.equal(
      findElement(render(), node => node.type === Button),
      undefined,
      'tree additions never dirty the dialog',
    );
  }

  const rows = [{ rowid: 'child-row', 'child-field': 'changed' }];
  invoke(table(), 'onChange', { rows, lastAction: options.edit.action });
  tree = render();
  const save = findElement(tree, node => node.type === Button);
  if (!save) throw new Error('Missing save button after a real edit');
  invoke(save, 'onClick');
  invoke(save, 'onClick');
  assert.equal(requests.length, 1, 'in-flight save lock prevents duplicate requests');
  await Promise.resolve();
  assert.equal(cleared, 1);
  assert.equal(closed, 0, 'ordinary save does not close the dialog');
  assert.deepEqual(requests[0], {
    appId: 'app',
    viewId: 'master-view',
    worksheetId: 'master-sheet',
    rowId: 'master-row',
    newOldControl: [formatted[0]],
  });
  assert.deepEqual(formatted[0]?.['value'], {
    updated: options.edit.updated,
    deleted: options.edit.deleted,
    rows,
    controls: props.controls,
  });
  if (options.failure) {
    assert.deepEqual(events, []);
    assert.deepEqual(errors, [{ badData: ['duplicate'] }]);
    assert.ok(
      findElement(render(), node => node.type === Button),
      'failed save keeps edits available for retry',
    );
    invoke(save, 'onClick');
    await Promise.resolve();
    assert.equal(requests.length, 2, 'failed save releases the lock so the user can retry');
  } else {
    assert.deepEqual(events, [{ worksheetId: 'master-sheet', recordId: 'master-row' }]);
    tree = render();
    assert.equal(
      findElement(tree, node => node.type === Button),
      undefined,
      'successful save clears dirty UI',
    );
    invoke(table(), 'onChange', { rows, lastAction: { type: 'UPDATE_ROW', rowid: 'next-row' } });
    tree = render();
    const secondSave = findElement(tree, node => node.type === Button);
    if (!secondSave) throw new Error('Missing next save');
    invoke(secondSave, 'onClick');
    await Promise.resolve();
    assert.deepEqual(formatted[1]?.['value'], {
      updated: ['next-row'],
      deleted: [],
      rows,
      controls: props.controls,
    });
  }

  formatted.forEach(value => assert.equal(value['store'], store));
  return {
    requests: requests.map(request => lodash.omit(request, 'newOldControl')),
    formatted: formatted.map(value => lodash.omit(value, 'store')),
    validations,
    events,
    timers,
    errors,
  };
}

(async () => {
  const current = fs.readFileSync(path.join(root, file), 'utf8');
  const original = execFileSync('git', ['show', 'c1c74ba4d:' + file], { cwd: root, encoding: 'utf8' });
  const broken = execFileSync('git', ['show', '2eaf3559e:' + file], { cwd: root, encoding: 'utf8' });

  const edits: EditFixture[] = [
    { action: { type: 'UPDATE_ROW', rowid: 'child-row' }, updated: ['child-row'], deleted: [] },
    { action: { type: 'ADD_ROW', rowid: 'temp-row' }, updated: ['temp-row'], deleted: [] },
    { action: { type: 'ADD_ROW' }, updated: [undefined], deleted: [] },
    { action: { type: 'DELETE_ROW', rowid: 'child-row' }, updated: [], deleted: ['child-row'] },
    {
      action: { type: 'DELETE_ROWS', rowIds: ['child-row', 'child-row', 'temp-row', 'default-row'] },
      updated: [],
      deleted: ['child-row'],
    },
    {
      action: { type: 'UPDATE_ROWS', rowIds: ['child-row', 'child-row', 'next-row'] },
      updated: ['child-row', 'next-row'],
      deleted: [],
    },
    { action: { type: 'ADD_ROWS', rows: [{ rowid: 'temp-row' }, {}] }, updated: ['temp-row', undefined], deleted: [] },
    {
      action: { type: 'CLEAR_AND_SET_ROWS', rows: [{ rowid: 'child-row' }], deleted: ['old-row', undefined] },
      updated: ['child-row'],
      deleted: ['old-row', undefined],
    },
    { action: { type: 'CLEAR_AND_SET_ROWS', rows: [] }, updated: [], deleted: undefined },
  ];

  await assert.rejects(
    () => scenario(broken, { editable: true, childSheet: 'child-sheet', edit: edits[0] }),
    /nested control retains the master worksheet ID/,
    'the pending main version fails the real contract check before this correction',
  );

  for (const editable of [false, true]) {
    for (const childSheet of [undefined, 'child-sheet']) {
      for (const failure of [false, true]) {
        for (const edit of edits) {
          const options = { editable, childSheet, failure, edit };
          const before = await scenario(original, options);
          const after = await scenario(current, options);
          assert.deepEqual(after, before, 'real dialog request, value reset and refresh contracts match production');
        }
      }
    }
  }

  console.log(
    'Child table dialog: 72 production A/B save, master/child ID, action, lock, failure and refresh scenarios passed',
  );
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
