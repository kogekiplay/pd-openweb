import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync, spawnSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
Reflect.set(globalThis, '_l', (text: string) => text);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError(`Missing ${key}`);
  return value[key];
}
function invoke(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  if (typeof fn !== 'function') throw new TypeError('Missing function');
  return Reflect.apply(fn, receiver, args);
}

function loadDropdown(revision?: string) {
  const filename = 'src/ming-ui/components/Dropdown.tsx';
  const source = revision
    ? execFileSync('git', ['show', `${revision}:${filename}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, filename), 'utf8');
  const compiled = harness.transformSync(source, {
    filename: path.join(root, 'src/ming-ui/components/Dropdown.tsx'),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  assert.ok(compiled?.code);
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  const Component = (props: Record<string, unknown>) =>
    React.createElement('div', { className: props['className'] }, props['children'] as ReactNode);
  const MenuItem = (props: Record<string, unknown>) =>
    React.createElement('li', { className: props['className'] }, props['children'] as ReactNode);
  const imports = (request: string): unknown => {
    if (request === './Icon') return { __esModule: true, default: Component };
    if (request === './LoadDiv' || request === './Menu') return { __esModule: true, default: Component };
    if (request === './MenuItem') return { __esModule: true, default: MenuItem };
    if (request === '@rc-component/trigger') return { __esModule: true, default: Component };
    if (request.endsWith('.less')) return {};
    return require(request);
  };
  new Function('module', 'exports', 'require', compiled.code)(moduleLike, moduleLike.exports, imports);
  return moduleLike.exports;
}

function instantiate(component: unknown, props: Record<string, unknown>) {
  if (typeof component !== 'function') throw new TypeError('Dropdown is not a class');
  const defaults = read(component, 'defaultProps');
  assert.ok(object(defaults));
  const instance: unknown = Reflect.construct(component, [{ ...defaults, ...props }]);
  assert.ok(object(instance));
  instance['setState'] = (patch: unknown, callback: unknown) => {
    assert.ok(object(patch));
    const state = read(instance, 'state');
    assert.ok(object(state));
    instance['state'] = { ...state, ...patch };
    if (callback !== undefined) invoke(instance, callback);
  };
  return instance;
}

function publicContracts() {
  const temporary = fs.mkdtempSync(path.join(root, 'node_modules/.cache/hap-dropdown-contract-'));
  const source = `import Dropdown, { type DropdownItem, type DropdownProps } from '${root}/src/ming-ui/components/Dropdown';
import merchantInvoice from '${root}/src/api/merchantInvoice';
import worksheetSetting from '${root}/src/api/worksheetSetting';
// @ts-expect-error API IDs follow the actual string protocol.
merchantInvoice.getTaxInfoForDropdownList({ projectId: 5 });
// @ts-expect-error Untyped results require response validation before use.
merchantInvoice.getSimpleInvoiceProducts({ taxNo: 'tax' }).then(value => value.map(x => x));
// @ts-expect-error Settings are opaque before decoding.
worksheetSetting.getInvoiceSetting({ worksheetId: 'sheet' }).then(value => value.taxNo);
// @ts-expect-error Save scene flags must be booleans.
worksheetSetting.saveInvoiceSetting({ taxNo: 'tax', scenes: { payment: 5 } });
const opaque: DropdownItem = { value: { id: 'opaque' }, text: 'Opaque' };
const defaults: DropdownProps = {
  data: [opaque],
  onChange: value => {
    // @ts-expect-error Unspecified dropdown values are unknown, never any.
    value.id;
  },
};
const typed: DropdownProps<number, { value?: number; text?: string; custom?: boolean }> = {
  data: [{ value: 1, text: 'One', custom: true }],
  onChange: value => {
    const result: number | undefined = value;
    void result;
  },
};
const missing: DropdownProps<number> = {
  // @ts-expect-error Clearing a dropdown can emit undefined.
  onChange: (value: number) => { void value; },
};
export const inferred = <Dropdown data={[{ value: 1, text: 'One', extra: true }]} value={1}
  onChange={value => { const n: number | undefined = value; void n; }}
  renderItem={item => { const extra: boolean = item.extra; void extra; return item.text; }} />;
export const inferredOpaque = <Dropdown data={[{ value: { id: 'opaque' }, text: 'Opaque' }]} value={{ id: 'opaque' }}
  onChange={value => { const id: string | undefined = value?.id; void id; }} />;
export const noModel = <Dropdown onChange={value => {
  // @ts-expect-error An unspecified component value must remain unknown.
  value.id;
}} />;
export const grouped = <Dropdown<number, { value: number; text: string; extra: boolean }>
  data={[[{ value: 1, text: 'One', extra: true }], { value: 2, text: 'Two', extra: false }]}
  onChange={value => { const n: number | undefined = value; void n; }}
  renderItem={item => { const b: boolean = item.extra; void b; return item.text; }} />;
const wrongChildren: DropdownItem<number> = {
  // @ts-expect-error Nested choices follow the same value model.
  children: [{ value: 'wrong' }],
};
void wrongChildren;
void Dropdown; void defaults; void typed; void missing;
`;
  try {
    const file = path.join(temporary, 'contract.tsx');
    fs.writeFileSync(file, source);
    fs.writeFileSync(path.join(temporary, 'styles.d.ts'), "declare module '*.less';\n");
    fs.writeFileSync(
      path.join(temporary, 'tsconfig.json'),
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [file, path.join(temporary, 'styles.d.ts'), path.join(root, 'types/global.d.ts')],
        exclude: [],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/@typescript/native/bin/tsc'),
        '-p',
        path.join(temporary, 'tsconfig.json'),
        '--pretty',
        'false',
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
    assert.equal(result.signal, null);
    assert.equal(result.error, undefined);
    assert.ok(result.status === 0 || result.status === 1);
    const headers = result.stdout.split('\n').filter(line => /^\S.*error TS\d+:/.test(line));
    assert.ok(result.status === 0 || headers.length > 0, result.stdout + result.stderr);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(headers, [], result.stdout + result.stderr);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

const loaded = loadDropdown();
const Dropdown = read(loaded, 'default');
assert.equal(typeof Dropdown, 'function');

const before = process.env['DROPDOWN_BEFORE_REV'];
const previous = before ? read(loadDropdown(before), 'default') : undefined;
const appearances: Record<string, unknown>[] = [
  {},
  { data: [{ value: 'a', text: 'Alpha' }], value: 'a' },
  { data: [[{ value: 0, text: 'Zero' }], [{ value: 1, text: 'One' }]], value: 0 },
  { data: [{ value: false, text: 'False' }], value: false },
  { data: [{ value: '', text: 'Empty' }], value: '' },
  { defaultValue: 'a', data: [{ value: 'a', text: 'Alpha' }], cancelAble: true },
  { border: true, disabled: true, className: 'custom', style: { width: 100 } },
  { renderPointer: () => React.createElement('span', null, 'Pointer') },
  { value: 'missing', data: [], renderError: () => React.createElement('span', null, 'Missing') },
  { value: 'a', data: [{ value: 'a', text: 'Alpha' }], renderTitle: () => 'Custom title' },
];
for (const props of appearances) {
  const current = instantiate(Dropdown, props);
  const element = invoke(current, read(current, 'render'));
  assert.ok(React.isValidElement(element));
  const markup = ReactDOM.renderToStaticMarkup(element);
  if (previous) {
    const historical = instantiate(previous, props);
    const oldElement = invoke(historical, read(historical, 'render'));
    assert.ok(React.isValidElement(oldElement));
    assert.equal(markup, ReactDOM.renderToStaticMarkup(oldElement));
  }
}
for (const props of [
  {
    data: [
      { value: 'a', text: 'Alpha', title: 'Title' },
      { isTip: true, text: 'Tip' },
    ],
  },
  { data: [[{ value: 'a', text: 'Alpha' }], [], [{ value: 'b', text: 'Beta' }]], hiddenValue: ['b'] },
  { data: [], itemLoading: true },
  { data: [], children: React.createElement('span', null, 'Additional content') },
]) {
  for (const keywords of ['', 'no-match']) {
    const current = instantiate(Dropdown, props);
    const state = read(current, 'state');
    assert.ok(object(state));
    current['state'] = { ...state, showMenu: true, keywords };
    const element = invoke(current, read(current, 'render'));
    assert.ok(React.isValidElement(element));
    if (previous) {
      const historical = instantiate(previous, props);
      const oldState = read(historical, 'state');
      assert.ok(object(oldState));
      historical['state'] = { ...oldState, showMenu: true, keywords };
      const oldElement = invoke(historical, read(historical, 'render'));
      assert.ok(React.isValidElement(oldElement));
      assert.equal(ReactDOM.renderToStaticMarkup(element), ReactDOM.renderToStaticMarkup(oldElement));
    }
  }
}

const emitted: unknown[] = [];
const data = [[{ value: 'grouped', text: 'Grouped' }], { value: 'plain', text: 'Plain' }] as const;
const instance = instantiate(Dropdown, {
  data,
  defaultValue: 'grouped',
  placeholder: 'Choose',
  renderValue: '{{value}}',
  onChange: (value: unknown) => emitted.push(value),
  onVisibleChange: () => {},
});
assert.equal(invoke(instance, read(instance, 'getTextFromDataById'), data, 'grouped'), 'Grouped');
assert.equal(invoke(instance, read(instance, 'checkIsNull'), [[], [{ value: 'x' }]]), false);
assert.equal(invoke(instance, read(instance, 'checkIsNull'), [[], []]), true);

invoke(instance, read(instance, 'handleChange'), {}, data[0][0]);
assert.deepEqual([...emitted], ['grouped']);
invoke(instance, read(instance, 'handleChange'), {}, { value: 'disabled', disabled: true });
invoke(instance, read(instance, 'handleChange'), {}, { value: 'tip', isTip: true });
assert.deepEqual([...emitted], ['grouped'], 'Disabled and tip rows cannot select');

const unknownValue = { id: 'opaque' };
const frozen = Object.freeze({ value: unknownValue, text: 'Opaque' });
const list = invoke(instance, read(instance, 'renderListItem'), [frozen]);
assert.ok(Array.isArray(list));
const fragment = list[0];
assert.ok(React.isValidElement<Record<string, unknown>>(fragment));
const fragmentChildren = fragment.props['children'];
assert.ok(Array.isArray(fragmentChildren));
const menuItem = fragmentChildren[1];
assert.ok(React.isValidElement<Record<string, unknown>>(menuItem));
assert.equal(menuItem.props['value'], undefined, 'Opaque values must not be forwarded to a native value prop');
assert.equal(menuItem.props['data-value'], unknownValue, 'Opaque values remain available for selection');
assert.equal(frozen.value, unknownValue, 'Rendering must not mutate caller data');

const disabled = instantiate(Dropdown, {
  data: [{ value: 'x', text: 'X' }],
  value: 'x',
  cancelAble: true,
  disabled: true,
  onChange: (value: unknown) => emitted.push(value),
  onVisibleChange: () => {},
});
function clear(instance: unknown) {
  const pointer = invoke(instance, read(instance, 'displayPointer'));
  assert.ok(React.isValidElement<Record<string, unknown>>(pointer));
  const body = pointer.props['children'];
  assert.ok(React.isValidElement<Record<string, unknown>>(body));
  const children = body.props['children'];
  assert.ok(Array.isArray(children));
  const icons = children[1];
  assert.ok(React.isValidElement<Record<string, unknown>>(icons));
  const iconChildren = icons.props['children'];
  assert.ok(Array.isArray(iconChildren));
  const clearIcon = iconChildren[0];
  assert.ok(React.isValidElement<Record<string, unknown>>(clearIcon));
  invoke(undefined, clearIcon.props['onClick'], { stopPropagation: () => {} });
}
clear(disabled);
assert.deepEqual([...emitted], ['grouped'], 'Disabled dropdown cannot clear its value');

const clearing = instantiate(Dropdown, {
  value: 0,
  cancelAble: true,
  onChange: (value: unknown) => emitted.push(value),
});
clear(clearing);
assert.equal(read(read(clearing, 'state'), 'value'), undefined);
assert.deepEqual([...emitted], ['grouped', undefined]);
const controlled = instantiate(Dropdown, { value: 'a' });
invoke(controlled, read(controlled, 'handleChange'), {}, { value: 'b' });
assert.equal(read(read(controlled, 'state'), 'value'), 'a');
const noChange = instantiate(Dropdown, { defaultValue: 'a', noChangeValue: true, selectClose: false });
invoke(noChange, read(noChange, 'handleChange'), {}, { value: 'b' });
assert.equal(read(read(noChange, 'state'), 'value'), 'a');
const selected = instantiate(Dropdown, { defaultValue: 'a', currentItemClass: 'selected', selectClose: false });
invoke(selected, read(selected, 'handleChange'), {}, { value: 'b' });
const selectedList = invoke(selected, read(selected, 'renderListItem'), [{ value: 'b', text: 'B' }]);
assert.ok(Array.isArray(selectedList));
const selectedFragment = selectedList[0];
assert.ok(React.isValidElement<Record<string, unknown>>(selectedFragment));
const selectedChildren = selectedFragment.props['children'];
assert.ok(Array.isArray(selectedChildren));
const selectedMenuItem = selectedChildren[1];
assert.ok(React.isValidElement<Record<string, unknown>>(selectedMenuItem));
assert.equal(selectedMenuItem.props['className'], 'selected', 'Uncontrolled selections should update their highlight');
const searches: unknown[] = [];
let focused = 0;
const searching = instantiate(Dropdown, { onSearch: (word: unknown) => searches.push(word) });
searching['search'] = { focus: () => focused++ };
invoke(searching, read(searching, 'handleClick'));
assert.deepEqual(searches, [undefined]);
assert.equal(focused, 1);
assert.equal(read(read(searching, 'state'), 'showMenu'), true);
const searchState = read(searching, 'state');
assert.ok(object(searchState));
searching['state'] = { ...searchState, keywords: 'ALP' };
assert.equal(invoke(searching, read(searching, 'filterFun'), { text: 'Alpha' }), true);
assert.equal(invoke(searching, read(searching, 'filterFun'), { text: 'Beta' }), false);
assert.equal(
  invoke(searching, read(searching, 'filterFun'), { text: React.createElement('span'), searchText: 'Alpha' }),
  true,
);
const groupedError = instantiate(Dropdown, { data, value: 'grouped', renderError: () => 'WRONG' });
const groupedPointer = invoke(groupedError, read(groupedError, 'displayPointer'));
assert.ok(React.isValidElement(groupedPointer));
assert.ok(!ReactDOM.renderToStaticMarkup(groupedPointer).includes('WRONG'));
assert.equal(read(read(instantiate(Dropdown, { popupVisible: true }), 'state'), 'showMenu'), true);

publicContracts();
console.log(
  JSON.stringify({
    renderings: appearances.length,
    historicalAB: !!previous,
    groupedSelection: true,
    immutableInput: true,
    disabledClear: true,
    controlledSelection: true,
    search: true,
    publicTypeContracts: true,
  }),
);
