import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const lodash: typeof import('lodash') = require('lodash');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const generator: typeof import('@babel/generator').default = require('@babel/generator').default;
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../../../../');
const beforeRevision = process.env['FILTER_SELECTION_BEFORE_REV'];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid test object');
  return Reflect.get(value, key);
}
function call(value: unknown, key: string, args: unknown[] = []): unknown {
  const method = read(value, key);
  if (typeof method !== 'function') throw new TypeError('Missing actual method ' + key);
  const result: unknown = Reflect.apply(method, value, args);
  return result;
}
function state(value: unknown): Record<string, unknown> {
  const result = read(value, 'state');
  if (!object(result)) throw new TypeError('Invalid state');
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid actual array');
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new TypeError('Invalid record');
  return value;
}
function node(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (React.isValidElement(value)) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value;
  if (Array.isArray(value)) return value.map(node);
  throw new TypeError('Invalid actual node');
}
function tree(value: unknown): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(value)) return value.flatMap(tree);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [{ type: value.type, props: value.props }, ...tree(value.props['children'])];
}
interface SelectorCall {
  name: string;
  target: unknown;
  options: Record<string, unknown>;
}
interface Fixture {
  load(name: string): unknown;
  create(name: string, props: Record<string, unknown>): unknown;
  changes: unknown[];
  alerts: unknown[][];
  selectors: SelectorCall[];
  timers: Array<() => void>;
  enum: Record<string, unknown>;
}
function fixture(before = false): Fixture {
  const cache = new Map<string, unknown>(),
    changes: unknown[] = [],
    alerts: unknown[][] = [],
    selectors: SelectorCall[] = [],
    timers: Array<() => void> = [];
  const translate = (text: string) => text;
  const global = {
    _l: translate,
    safeParse(value: unknown) {
      if (!value) return {};
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(String(value));
      } catch {
        return {};
      }
    },
    md: {
      global: {
        Account: { projects: [{ projectId: 'org' }], isPortal: false },
        FileStoreConfig: { pictureHost: '/pictures' },
      },
    },
  };
  const helperFile = path.join(__dirname, '../../util.ts');
  const helperAst = parser.parse(fs.readFileSync(helperFile, 'utf8'), {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const helperDeclaration = helperAst.program.body.find(
    declaration =>
      declaration.type === 'ExportNamedDeclaration' &&
      declaration.declaration?.type === 'VariableDeclaration' &&
      declaration.declaration.declarations.some(
        value => value.id.type === 'Identifier' && value.id.name === 'getTabTypeBySelectUser',
      ),
  );
  if (!helperDeclaration) throw new TypeError('Missing actual user selector mode helper');
  const helperModule: { exports: unknown } = { exports: {} };
  const helperCode = harness.transformSync(
    generator(helperDeclaration).code + '\nmodule.exports={getTabTypeBySelectUser};',
    { filename: helperFile },
  );
  assert.ok(helperCode?.code);
  new Function('module', 'exports', '_', helperCode.code)(helperModule, helperModule.exports, lodash);
  const userHead = (props: { user: { accountId?: string; userHead?: string } }) =>
    React.createElement('img', { src: props.user.userHead, 'data-account': props.user.accountId });
  const tag = (props: { data: unknown[]; disabled?: boolean; needInput?: boolean }) =>
    React.createElement(
      'div',
      {},
      props.data.map((item, index) => React.createElement('span', { key: index }, node(read(item, 'name')))),
      props.needInput ? React.createElement('input', { disabled: props.disabled }) : null,
    );
  const city = (props: { children?: ReactNode }) =>
    React.createElement('section', { 'data-city': true }, props.children);
  const cascader = (props: { value?: string; disabled?: boolean }) =>
    React.createElement('div', { 'data-cascader': props.value, 'aria-disabled': props.disabled });
  function selector(name: string, target: unknown, options: unknown): void {
    selectors.push({ name, target, options: record(options) });
  }
  function load(name: string): unknown {
    if (cache.has(name)) return cache.get(name);
    const filename = path.join(__dirname, name);
    const relative = path.relative(root, filename);
    const source =
      before && ['Options.tsx', 'Users.tsx', 'Cascader.tsx'].includes(name)
        ? execFileSync('git', ['show', beforeRevision + ':' + relative], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(filename, 'utf8');
    const compiled = harness.transformSync(source, {
      filename,
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
      comments: false,
    });
    assert.ok(compiled?.code);
    const result: { exports: unknown } = { exports: {} };
    new Function('module', 'exports', 'require', '_l', 'safeParse', 'md', 'alert', 'setTimeout', compiled.code)(
      result,
      result.exports,
      (request: string): unknown => {
        if (request === 'ming-ui') return { CityPicker: city, UserHead: userHead };
        if (request === 'ming-ui/functions')
          return {
            quickSelectDept: (target: unknown, options: unknown) => selector('dept', target, options),
            quickSelectRole: (target: unknown, options: unknown) => selector('role', target, options),
            quickSelectUser: (target: unknown, options: unknown) => selector('user', target, options),
            dialogSelectUser: (options: unknown) => selector('dialog', undefined, options),
          };
        if (request === './TagCon') return tag;
        if (request === 'src/components/Form/DesktopForm/widgets/Cascader') return cascader;
        if (request === '../../enum')
          return {
            FILTER_CONDITION_TYPE: {
              LIKE: 1,
              NCONTAIN: 5,
              ARREQ: 26,
              ARRNE: 27,
              EQ_FOR_SINGLE: 51,
              BETWEEN: 11,
              NBETWEEN: 12,
            },
          };
        if (request === 'src/pages/worksheet/common/WorkSheetFilter/util') return helperModule.exports;
        if (request === './selectionBoundary') return load('selectionBoundary.ts');
        return require(request);
      },
      translate,
      global.safeParse,
      global.md,
      (...args: unknown[]) => alerts.push(args),
      (fn: () => void) => {
        timers.push(fn);
        return timers.length;
      },
    );
    cache.set(name, result.exports);
    return result.exports;
  }
  return {
    load,
    changes,
    alerts,
    selectors,
    timers,
    enum: {},
    create(name, props) {
      const constructor = read(load(name), 'default');
      if (typeof constructor !== 'function') throw new TypeError('Missing actual editor');
      const instance: unknown = Reflect.construct(constructor, [
        { folded: true, fullValues: [], onChange: (value: unknown) => changes.push(value), ...props },
      ]);
      const receiver = record(instance);
      receiver['setState'] = (patch: unknown, callback?: () => void) => {
        const value =
          typeof patch === 'function'
            ? Reflect.apply(patch, undefined, [state(receiver), read(receiver, 'props')])
            : patch;
        Object.assign(state(receiver), record(value));
        callback?.();
      };
      return instance;
    },
  };
}
function markup(value: unknown): string {
  return renderToStaticMarkup(node(call(value, 'render')));
}
const f = fixture();
const full = '{"id":"d","name":"Dept","extra":{"keep":true}}';
const options = f.create('Options.tsx', { control: { type: 27 }, fullValues: [full] });
assert.deepEqual(state(options)['selectedOptions'], [JSON.parse(full)]);
const selected = array(state(options)['selectedOptions']);
const original = selected[0];
const addedMeta = { keep: true };
call(options, 'addItem', [{ id: 'e', name: 'Extra', metadata: addedMeta }]);
assert.equal(
  array(state(options)['selectedOptions'])[0],
  original,
  'concat and dedupe keep existing entity references',
);
assert.deepEqual(read(f.changes.at(-1), 'values'), ['d', 'e']);
call(options, 'addItem', [{ id: 'e', name: 'duplicate' }]);
assert.equal(array(state(options)['selectedOptions']).length, 2);
call(options, 'updateItem', ['e', { name: 'Updated' }]);
assert.equal(read(array(state(options)['selectedOptions'])[1], 'name'), 'Updated');
assert.equal(read(array(state(options)['selectedOptions'])[1], 'metadata'), addedMeta);
call(options, 'addItem', [{ id: 'temp', name: 'Temp', temp: true, opaque: { same: true } }]);
const temp = array(state(options)['selectedOptions']).at(-1),
  meta = read(temp, 'opaque');
call(options, 'clearTemp');
const cleared = array(state(options)['selectedOptions']).at(-1);
assert.equal(read(cleared, 'temp'), undefined);
assert.equal(read(cleared, 'opaque'), meta);
call(options, 'removeItem', [{ id: 'd' }]);
assert.deepEqual(read(f.changes.at(-1), 'values'), ['e', 'temp']);
const batch = [{ id: 'b', name: 'Batch' }];
call(options, 'addItem', [batch, { clearSelected: true }]);
assert.equal(state(options)['selectedOptions'], batch, 'explicit clear selection array identity');
const controlOptions = [
  { key: 'b', value: 'B', index: 2 },
  { key: 'a', value: 'A', index: 1 },
  { key: 'deleted', value: 'Deleted', isDeleted: true, index: 0 },
];
const optionEditor = f.create('Options.tsx', {
  control: { type: 9, options: controlOptions },
  fullValues: ['a', '{"id":"deleted"}'],
  type: 51,
});
assert.deepEqual(state(optionEditor)['selectedOptions'], [
  { id: 'a', name: 'A' },
  { id: 'deleted', name: 'Deleted' },
]);
const rendered = tree(call(optionEditor, 'render'));
const b = rendered.find(item => Array.isArray(item.props['children']) && item.props['children'].includes('B'));
assert.ok(b);
call(b.props, 'onClick');
assert.deepEqual(read(f.changes.at(-1), 'values'), ['b']);
const score = f.create('Options.tsx', {
  control: { type: 28, advancedSetting: { max: '5' } },
  fullValues: ['2', '{"id":"3","name":"three","meta":1}'],
});
assert.equal(read(array(state(score)['selectedOptions'])[0], 'name'), '二级');
assert.ok(markup(score).includes('五级'));
const dept = f.create('Options.tsx', { control: { type: 27, enumDefault: 0 }, type: 26, projectId: 'org' });
const deptNode = tree(call(dept, 'render')).find(item => item.props['className'] === 'filterSelectDepartment');
assert.ok(deptNode);
const target = { originalTarget: true };
call(deptNode.props, 'onClick', [{ target }]);
assert.equal(f.selectors.at(-1)?.target, target);
call(f.selectors.at(-1)?.options, 'selectFn', [
  [
    { departmentId: 'one', departmentName: 'One', meta: 2 },
    { departmentId: 'two', departmentName: 'Two' },
  ],
]);
assert.deepEqual(read(f.changes.at(-1), 'values'), ['one']);
const role = f.create('Options.tsx', { control: { type: 48 }, projectId: 'org' });
const roleNode = tree(call(role, 'render')).find(item => item.props['className'] === 'filterSelectDepartment');
assert.ok(roleNode);
call(roleNode.props, 'onClick', [{ target }]);
call(f.selectors.at(-1)?.options, 'onSave', [[{ organizeId: 'r', organizeName: 'Role', metadata: 1 }]]);
assert.deepEqual(
  read(f.changes.at(-1), 'fullValues'),
  ['{"id":"r","name":"Role"}'],
  'selector projection matches historical saved wire',
);
const area = f.create('Options.tsx', {
  control: { type: 24, enumDefault2: 2, advancedSetting: { chooserange: 'ALL' } },
  type: 1,
});
const picker = tree(call(area, 'render')).find(item => item.props['chooserange'] === 'ALL');
assert.ok(picker);
assert.equal(picker.props['level'], 3);
call(picker.props, 'callback', [[{ id: 'city', path: 'Country/City' }]]);
call(picker.props, 'handleClose');
assert.deepEqual(read(f.changes.at(-1), 'values'), ['city']);
f.timers.at(-1)?.();
assert.equal(read(array(state(area)['selectedOptions'])[0], 'temp'), undefined);
const users = f.create('Users.tsx', {
  control: { type: 26 },
  fullValues: ['{"id":"u","name":"User","avatar":"avatar","metadata":1}', 'bad'],
});
assert.deepEqual(state(users)['users'], [{ accountId: 'u', fullname: 'User', avatar: 'avatar' }]);
const chosen = [{ accountId: 'v', fullname: 'Selected', avatar: 'face', opaque: { keep: true } }];
call(users, 'addUsers', [chosen]);
assert.equal(array(state(users)['users']).at(-1), chosen[0]);
assert.deepEqual(read(f.changes.at(-1), 'fullValues'), [
  '{"id":"u","name":"User","avatar":"avatar"}',
  '{"id":"v","name":"Selected","avatar":"face"}',
]);
call(users, 'addUsers', [chosen]);
assert.equal(f.alerts.at(-1)?.[0], '该用户已存在');
call(users, 'removeUser', [chosen[0]]);
assert.deepEqual(read(f.changes.at(-1), 'values'), ['u']);
const single = f.create('Users.tsx', { control: { enumDefault: 0 }, type: 26 });
call(single, 'addUsers', [[chosen[0], { accountId: 'w' }]]);
assert.deepEqual(read(f.changes.at(-1), 'values'), ['v']);
call(single, 'addUser');
const selector = f.selectors.at(-1);
assert.equal(selector?.name, 'user');
call(read(selector?.options, 'SelectUserSettings'), 'callback', [[{ accountId: 'new', fullname: 'New' }]]);
assert.deepEqual(read(f.changes.at(-1), 'values'), ['new']);
const cascade = f.create('Cascader.tsx', {
  control: {
    type: 35,
    enumDefault: 1,
    advancedSetting: {
      showtype: '4',
      anylevel: '1',
      limitlayer: '3',
      minlayer: '2',
      topfilters: '[]',
      topshow: '3',
      meta: 'keep',
    },
  },
  type: 11,
  from: 'rule',
  worksheetId: 'sheet',
  fullValues: ['{"id":"r","name":"Row","opaque":2}'],
});
assert.equal(read(cascade, 'selectSingle'), false);
const widget = tree(call(cascade, 'render')).find(
  item => item.props['popupClassName'] === 'worksheetFilterCascaderPopup',
);
assert.ok(widget);
assert.equal(widget.props['enumDefault'], 2);
assert.deepEqual(widget.props['advancedSetting'], { showtype: '4', anylevel: '0', meta: 'keep' });
assert.equal(widget.props['value'], '[{"name":"Row","sid":"r"}]');
call(widget.props, 'onChange', ['[{"sid":"selected","name":"Selected","sourcevalue":"metadata"}]']);
assert.deepEqual(read(f.changes.at(-1), 'fullValues'), ['{"name":"Selected","id":"selected"}']);
call(cascade, 'handleChange', ['']);
assert.deepEqual(read(f.changes.at(-1), 'values'), []);
const boundary = f.load('selectionBoundary.ts');
const opaque = { same: true },
  entity = { id: 4, name: 'Numeric', opaque };
assert.equal(call(boundary, 'selectionItem', [entity]), entity);
const entities = [entity];
assert.equal(call(boundary, 'selectionItems', [entities]), entities);
assert.throws(() => call(boundary, 'selectionItems', [new Array(1)]), TypeError);
assert.throws(() => call(boundary, 'selectionItem', [{ id: {}, name: 'bad' }]), TypeError);
assert.throws(() => call(boundary, 'selectionUsers', [[{ accountId: 4 }]]), TypeError);
assert.throws(() => call(boundary, 'cascaderValues', ['[{"sid":{},"name":"bad"}]']), TypeError);
const optionProps = record(read(options, 'props'));
const oldProps = { ...optionProps };
const changedFullValues = ['{"id":"refresh","name":"Refreshed","metadata":3}'];
record(options)['props'] = { ...optionProps, fullValues: changedFullValues };
call(options, 'componentDidUpdate', [oldProps]);
assert.equal(
  read(array(state(options)['selectedOptions'])[0], 'id'),
  'refresh',
  'Options deep fullValues change rebuilds selected state',
);
const cascadeProps = record(read(cascade, 'props'));
const priorRecords = state(cascade)['records'];
record(cascade)['props'] = { ...cascadeProps, fullValues: ['{"id":"same-length","name":"New"}'] };
call(cascade, 'componentDidUpdate', [cascadeProps]);
assert.equal(
  state(cascade)['records'],
  priorRecords,
  'Cascader retains original length-only update rule for same length',
);
record(cascade)['props'] = { ...cascadeProps, fullValues: ['{"id":"new","name":"New"}', '{"id":"two","name":"Two"}'] };
call(cascade, 'componentDidUpdate', [cascadeProps]);
assert.deepEqual(
  array(state(cascade)['records']).map(value => read(value, 'id')),
  ['new', 'two'],
);
const many = f.create('Options.tsx', {
  control: {
    type: 10,
    options: Array.from({ length: 7 }, (_, index) => ({ key: String(index), value: 'Item' + index, index })),
  },
  folded: true,
});
const more = tree(call(many, 'render')).find(item => item.props['className'] === 'showMore colorPrimary Hand');
assert.ok(more);
call(more.props, 'onClick');
assert.deepEqual(f.changes.at(-1), { folded: false });
assert.equal(
  tree(call(many, 'render')).filter(
    item => typeof item.props['className'] === 'string' && item.props['className'].startsWith('optionCheckbox '),
  ).length,
  5,
);
const missingOrganization = f.create('Options.tsx', { control: { type: 27 }, projectId: 'absent' });
const absent = tree(call(missingOrganization, 'render')).find(
  item => item.props['className'] === 'filterSelectDepartment',
);
assert.ok(absent);
const selectCount = f.selectors.length;
call(absent.props, 'onClick', [{ target }]);
assert.equal(f.selectors.length, selectCount);
assert.equal(f.alerts.at(-1)?.[0], '您不是该组织成员，无法获取其部门列表，请联系组织管理员');
let dialogUsers: unknown;
call(single, 'selectUser', [
  'Select users',
  'outside',
  { unique: true },
  (value: unknown) => {
    dialogUsers = value;
  },
]);
const dialogSettings = read(f.selectors.at(-1)?.options, 'SelectUserSettings');
assert.equal(read(dialogSettings, 'projectId'), '');
const callbackUsers = [{ accountId: 'contact', fullname: 'Contact' }];
call(dialogSettings, 'callback', [callbackUsers]);
assert.equal(dialogUsers, callbackUsers);
const userElement = tree(call(users, 'render')).find(item => item.props['className'] === 'remove');
assert.ok(userElement);
let stopped = false;
call(userElement.props, 'onClick', [
  {
    stopPropagation: () => {
      stopped = true;
    },
  },
]);
assert.equal(stopped, true);
assert.deepEqual(read(f.changes.at(-1), 'values'), []);
const beforeBad = state(options)['selectedOptions'];
assert.throws(() => call(options, 'addItem', [[{ id: {} }]]), TypeError);
assert.equal(state(options)['selectedOptions'], beforeBad);
call(options, 'addItem', [{ id: 'recover', name: 'Recover' }]);
assert.equal(
  read(array(state(options)['selectedOptions']).at(-1), 'id'),
  'recover',
  'valid next event recovers after explicit malformed payload rejection',
);
console.log(
  'Selection editors independent actual class/ReactDOM/options/users/cascader/selector callbacks/JSON metadata/reference/invalid boundary checks passed',
);
if (beforeRevision) {
  let cases = 0;
  for (const name of ['Options.tsx', 'Users.tsx', 'Cascader.tsx']) {
    const configs =
      name === 'Options.tsx'
        ? [
            { control: { type: 9, options: controlOptions }, fullValues: ['a'] },
            { control: { type: 28, advancedSetting: { max: '5' } }, fullValues: ['2'] },
            { control: { type: 24, advancedSetting: {} }, fullValues: ['{"id":"area","name":"Area","meta":1}'] },
            { control: { type: 27 }, fullValues: [full] },
            { control: { type: 48 }, fullValues: ['{"id":"r","name":"Role"}'] },
          ]
        : name === 'Users.tsx'
          ? [
              { control: { type: 26 }, fullValues: ['{"id":"u","name":"User","avatar":"a"}'] },
              { control: { enumDefault: 0 }, fullValues: [] },
            ]
          : [
              {
                control: { type: 35, advancedSetting: { showtype: '3', anylevel: '1' } },
                fullValues: ['{"id":"r","name":"Row"}'],
              },
            ];
    for (const cfg of configs)
      for (const disabled of [true, false])
        for (const type of [2, 11, 26, 51]) {
          const a = fixture(true),
            b = fixture(false),
            old = a.create(name, { ...cfg, disabled, type }),
            current = b.create(name, { ...cfg, disabled, type });
          assert.deepEqual(state(current), state(old));
          assert.equal(markup(current), markup(old));
          if (name === 'Options.tsx') {
            call(old, 'addItem', [{ id: 'new', name: 'New', opaque: { same: true } }]);
            call(current, 'addItem', [{ id: 'new', name: 'New', opaque: { same: true } }]);
            call(old, 'clearTemp');
            call(current, 'clearTemp');
            call(old, 'removeItem', [{ id: 'new' }]);
            call(current, 'removeItem', [{ id: 'new' }]);
          } else if (name === 'Users.tsx') {
            const selected = [{ accountId: 'new', fullname: 'New', metadata: 2 }];
            call(old, 'addUsers', [selected]);
            call(current, 'addUsers', [selected]);
            call(old, 'removeUser', [selected[0]]);
            call(current, 'removeUser', [selected[0]]);
          } else {
            call(old, 'handleChange', ['[{"sid":"new","name":"New"}]']);
            call(current, 'handleChange', ['[{"sid":"new","name":"New"}]']);
            call(old, 'handleChange', ['']);
            call(current, 'handleChange', ['']);
          }
          assert.deepEqual(state(current), state(old));
          assert.deepEqual(b.changes, a.changes);
          assert.deepEqual(b.alerts, a.alerts);
          cases++;
        }
  }
  console.log(
    'Selection editors historical complete-class production Babel/ReactDOM event matrix passed: ' + cases + ' cases',
  );
}

async function debounceCheck(): Promise<void> {
  const asynchronous = f.create('Options.tsx', { control: { type: 24, advancedSetting: {} } });
  const fetch = read(asynchronous, 'onFetchData');
  assert.ok(typeof fetch === 'function');
  Reflect.apply(fetch, asynchronous, ['first']);
  Reflect.apply(fetch, asynchronous, ['latest']);
  assert.equal(state(asynchronous)['keywords'], '');
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.equal(
    state(asynchronous)['keywords'],
    'latest',
    'actual lodash debounce updates only the latest search with preserved receiver',
  );
  console.log('Selection editors actual async lodash debounce passed');
}
debounceCheck().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
