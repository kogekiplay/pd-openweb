import type {
  ChoiceOption,
  DropdownMenuProps,
  DropdownOption,
  DropdownState,
  MenuState,
  MultipleDropdownProps,
} from './types';

const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');

interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
class Component<P, S extends object> {
  props: P;
  state: S = Object.create(null);
  constructor(props: P) {
    this.props = props;
  }
  setState(patch: Partial<S>, callback?: () => void) {
    Object.assign(this.state, patch);
    callback?.();
  }
}
interface Menu {
  props: DropdownMenuProps;
  state: MenuState;
  componentDidMount(): void;
  componentDidUpdate(props: DropdownMenuProps): void;
  componentWillUnmount(): void;
  itemOnClick(event: unknown, item: ChoiceOption): void;
  showSubItems(event: unknown, item: ChoiceOption): void;
  unCheckItem(event: unknown, item: DropdownOption): void;
  clearCheckedItems(event: unknown): void;
  back(event: unknown): void;
  updateFilterText(event: unknown): void;
  render(): Tree;
  search?: { focus(): void } | null;
}
interface Dropdown {
  props: MultipleDropdownProps;
  state: DropdownState;
  componentDidMount(): void;
  componentDidUpdate(props: MultipleDropdownProps): void;
  componentWillUnmount(): void;
  showMenu(): void;
  hideMenu(): void;
  toggleMenuOpened(): void;
  onChange(
    event: unknown,
    value: string | string[],
    label: string | undefined | Array<string | undefined>,
    autoHide: boolean,
  ): void;
  keyDownListener(event: unknown): void;
  clickListener(event: unknown): void;
  render(): Tree;
  root: FixtureNode | null;
  button: { getBoundingClientRect(): { top: number; height: number } } | null;
}
class FixtureNode {
  readonly child: boolean;
  constructor(child = false) {
    this.child = child;
  }
  contains(node: unknown) {
    return node instanceof FixtureNode && node.child;
  }
}
const listeners = new Map<string, unknown>();
const timerQueue = new Map<number, () => void>();
let timerId = 0;
const alerts: unknown[][] = [];
Object.assign(globalThis, {
  Node: FixtureNode,
  window: {
    innerHeight: 700,
    addEventListener(name: string, callback: unknown) {
      listeners.set(name, callback);
    },
    removeEventListener(name: string, callback: unknown) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  },
  _l: (text: string) => text,
  alert: (...args: unknown[]) => alerts.push(args),
});
const cache = new Map<string, unknown>();
function load(file: string): unknown {
  const full = path.join(__dirname, file),
    existing = cache.get(full);
  if (existing) return existing;
  const result = { exports: {} };
  new Function('module', 'exports', 'require', 'setTimeout', 'clearTimeout', transformFileSync(full).code)(
    result,
    result.exports,
    (name: string) => {
      if (name === 'react') return { Component, Fragment: 'Fragment' };
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
          jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
        };
      if (name === 'react-redux') return { shallowEqual: (a: unknown, b: unknown) => a === b };
      if (name === 'prop-types') return require('prop-types');
      if (name === 'classnames')
        return (...values: unknown[]) => values.filter(value => typeof value === 'string').join(' ');
      if (name === 'ming-ui/components/Icon') return { __esModule: true, default: 'Icon' };
      if (name === './menu') return load('menu.tsx');
      if (name === './boundary') return load('boundary.ts');
      if (name.endsWith('.less')) return {};
      throw new Error('Unexpected MultipleDropdown dependency ' + name);
    },
    (callback: () => void) => {
      const id = ++timerId;
      timerQueue.set(id, callback);
      return id;
    },
    (id: number) => timerQueue.delete(id),
  );
  cache.set(full, result.exports);
  return result.exports;
}
const menuModule = load('menu.tsx') as { default: new (props: DropdownMenuProps) => Menu };
const dropdownModule = load('dropdown.tsx') as { default: new (props: MultipleDropdownProps) => Dropdown };
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function walk(value: unknown): Tree[] {
  if (!record(value) || !('type' in value) || !record(value['props'])) return [];
  const node: Tree = { type: value['type'], props: value['props'] },
    children = node.props['children'];
  return [node, ...(Array.isArray(children) ? children : [children]).flatMap(walk)];
}
const calls: Array<{ event: unknown; value: string | string[]; label: unknown; autoHide: boolean }> = [];
const event = {
  prevented: 0,
  stopped: 0,
  preventDefault() {
    this.prevented++;
  },
  stopPropagation() {
    this.stopped++;
  },
};
const one: ChoiceOption = { value: 'one', label: 'One', opaque: { same: true } },
  two: ChoiceOption = { value: 'two', label: 'Two' },
  disabled: ChoiceOption = { value: 'disabled', label: 'Disabled', disabled: true };
const menuProps: DropdownMenuProps = {
  options: [one, two, disabled],
  multipleSelect: true,
  value: ['one'],
  onChange: (event, value, label, autoHide) => calls.push({ event, value, label, autoHide }),
};
const menu = new menuModule.default(menuProps);
menu.componentDidMount();
assert.equal(menu.state.checkedItems['one'], one, 'The original selected option/metadata reference is retained');
menu.itemOnClick(event, two);
assert.deepEqual(calls.at(-1)?.value, ['one', 'two']);
assert.equal(calls.at(-1)?.event, event);
assert.equal(calls.at(-1)?.autoHide, false);
menu.itemOnClick(event, disabled);
assert.deepEqual(calls.at(-1)?.value, ['one', 'two']);
menu.unCheckItem(event, one);
assert.deepEqual(calls.at(-1)?.value, ['two']);
menu.clearCheckedItems(event);
assert.deepEqual(calls.at(-1)?.value, []);
menu.props = { ...menuProps, maxSelectNum: 1 };
menu.itemOnClick(event, one);
const beforeMax = calls.length;
menu.itemOnClick(event, two);
assert.equal(calls.length, beforeMax);
assert.equal(alerts.length, 1);
const nested: ChoiceOption = {
  value: 'parent',
  label: 'Parent',
  items: [one, { type: 'divider' }, { type: 'header', label: 'Header' }, two],
};
const tree = new menuModule.default({
  options: [nested],
  multipleLevel: true,
  onChange: (event, value, label, autoHide) => calls.push({ event, value, label, autoHide }),
});
tree.componentDidMount();
const ancestry = tree.state.list;
tree.showSubItems(event, nested);
assert.equal(tree.state.list, ancestry);
assert.equal(tree.state.options, nested.items);
tree.itemOnClick(event, one);
assert.deepEqual(calls.at(-1)?.label, ['Parent', 'One']);
assert.equal(calls.at(-1)?.value, 'one');
assert.equal(calls.at(-1)?.autoHide, true);
tree.back(event);
assert.equal(tree.state.options, tree.props.options);
assert.equal(tree.state.list, ancestry);
const filter = new menuModule.default({ options: [one, two], filter: true, onChange() {} });
filter.componentDidMount();
filter.updateFilterText({ target: { value: 'on' } });
assert.deepEqual(filter.state.availOptions, [one]);
filter.updateFilterText({ target: { value: '' } });
assert.deepEqual(filter.state.availOptions, [one, two]);
const special: ChoiceOption = { value: 'constructor', label: 'Constructor' };
const proto = new menuModule.default({
  options: [special],
  multipleSelect: true,
  onChange: (_event, value) => {
    assert.deepEqual(value, ['constructor']);
  },
});
proto.componentDidMount();
proto.itemOnClick(event, special);
assert.equal(proto.state.checkedItems['constructor'], special);
let focused = 0;
filter.search = {
  focus() {
    focused++;
  },
};
const prior = filter.props;
filter.props = { ...prior, openMenu: true };
filter.componentDidUpdate(prior);
assert.equal(timerQueue.size, 1);
filter.componentWillUnmount();
timerQueue.forEach(callback => callback());
assert.equal(focused, 0);
const focusMenu = new menuModule.default({ options: [one], filter: true, onChange() {} });
focusMenu.search = {
  focus() {
    focused++;
  },
};
const focusPrevious = focusMenu.props;
focusMenu.props = { ...focusPrevious, openMenu: true };
focusMenu.componentDidUpdate(focusPrevious);
timerQueue.forEach(callback => callback());
timerQueue.clear();
assert.equal(focused, 1, 'An active opened filter focuses once');
focusMenu.props = focusPrevious;
focusMenu.componentDidUpdate({ ...focusPrevious, openMenu: true });
focusMenu.props = { ...focusPrevious, openMenu: true };
focusMenu.componentDidUpdate(focusPrevious);
const openedFocus = focusMenu.props;
focusMenu.props = { ...openedFocus, openMenu: false };
focusMenu.componentDidUpdate(openedFocus);
assert.equal(timerQueue.size, 0, 'Closing cancels queued focus');
focusMenu.props = { ...focusPrevious, openMenu: true };
focusMenu.componentDidUpdate(focusPrevious);
const enabledFocus = focusMenu.props;
focusMenu.props = { ...enabledFocus, disabled: true };
focusMenu.componentDidUpdate(enabledFocus);
assert.equal(timerQueue.size, 0, 'Disabling cancels queued focus');
focusMenu.componentWillUnmount();
const disabledMenuCalls = calls.length;
menu.props = { ...menu.props, disabled: true };
menu.itemOnClick(event, one);
menu.unCheckItem(event, one);
menu.clearCheckedItems(event);
assert.equal(calls.length, disabledMenuCalls, 'Disabled menu keeps selection and callbacks unchanged');
const order: string[] = [];
const drop = new dropdownModule.default({
  options: [one, two],
  value: 'one',
  label: 'One',
  onClick: (e, value) => {
    assert.equal(e, event);
    order.push('click:' + value);
  },
  onChange: (e, value) => {
    assert.equal(e, event);
    order.push('change:' + value);
  },
});
drop.componentDidMount();
drop.showMenu();
drop.onChange(event, 'one', 'One', true);
assert.deepEqual(order, ['click:one']);
assert.equal(drop.state.menuOpened, false);
drop.showMenu();
drop.onChange(event, 'two', 'Two', true);
assert.deepEqual(order, ['click:one', 'click:two', 'change:two']);
drop.showMenu();
drop.keyDownListener({ keyCode: 27 });
assert.equal(drop.state.menuOpened, false);
drop.root = new FixtureNode();
drop.showMenu();
drop.clickListener({ target: new FixtureNode(true) });
assert.equal(drop.state.menuOpened, true);
drop.clickListener({ target: new FixtureNode() });
assert.equal(drop.state.menuOpened, false);
drop.showMenu();
drop.clickListener({ target: {} });
assert.equal(drop.state.menuOpened, false);
drop.button = { getBoundingClientRect: () => ({ top: 600, height: 40 }) };
assert.ok(String(drop.render().props['className']).includes('menu-top'));
const oldProps = drop.props;
drop.props = { ...oldProps, disabled: true };
drop.showMenu();
drop.state.menuOpened = true;
drop.componentDidUpdate(oldProps);
assert.equal(drop.state.menuOpened, false);
drop.toggleMenuOpened();
assert.equal(drop.state.menuOpened, false);
const callbackCount = order.length;
drop.onChange(event, 'one', 'One', true);
assert.equal(order.length, callbackCount);
const legacy = new menuModule.default({ options: [one], value: ['one'], multipleSelect: false, onChange() {} });
legacy.componentDidMount();
assert.equal(
  legacy.state.checkedItems['one'],
  null,
  'Legacy single-mode array initialization keeps strict scalar lookup semantics',
);
const emptyLegacy = new menuModule.default({ options: [one], value: [], multipleSelect: false, onChange() {} });
emptyLegacy.componentDidMount();
assert.equal(
  Object.hasOwn(emptyLegacy.state.checkedItems, ''),
  true,
  'Legacy single-mode empty array keeps its stringified dictionary key',
);
assert.equal(emptyLegacy.state.checkedItems[''], null);
assert.throws(() => new menuModule.default({ options: Array(1), onChange() {} }), TypeError);
const optionBoundary = load('boundary.ts') as { dropdownOptions(value: unknown): DropdownOption[] };
for (const malformed of [
  [{ value: 1 }],
  [{ value: 'one', label: { text: 'One' } }],
  [{ value: 'one', disabled: 'true' }],
  [{ value: 'one', items: {} }],
  [{ value: 'one', type: 'button' }],
  [{}],
]) {
  assert.throws(() => optionBoundary.dropdownOptions(malformed), TypeError);
}
const aliasOptions: DropdownOption[] = [
  { value: 'first', items: [one] },
  { value: 'second', items: [one] },
];
assert.equal(
  optionBoundary.dropdownOptions(aliasOptions),
  aliasOptions,
  'Valid shared subtree references are retained',
);
const unlabeled = new menuModule.default({ options: [{ value: 'unlabeled' }], filter: true, onChange() {} });
unlabeled.componentDidMount();
assert.throws(
  () => unlabeled.updateFilterText({ target: { value: 'query' } }),
  TypeError,
  'Missing labels preserve the prior filtering failure rather than invent an empty label',
);
const cycle: ChoiceOption = { value: 'cycle', label: 'Cycle' };
cycle.items = [cycle];
assert.throws(() => new menuModule.default({ options: [cycle], onChange() {} }), TypeError);
[menu, tree, proto, legacy, emptyLegacy, unlabeled].forEach(item => item.componentWillUnmount());
drop.componentWillUnmount();
assert.equal(listeners.size, 0);
console.log('Actual MultipleDropdown menu/selection/nesting/search/disabled/event/order/reference/lifecycle passed');
