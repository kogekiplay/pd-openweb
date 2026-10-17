const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { transformFileSync, transformSync } = require('../../../../../scripts/spec-harness.ts');
const React = require('react');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../../..');
const CustomFields = () => null;
const Popup = () => null;
const Button = () => null;
const Modal = () => null;
const IconBtn = () => null;
let uploading = false;
const alerts: unknown[][] = [];
global._l = (text: string) => text;
global.alert = (...args: unknown[]) => alerts.push(args);
global.window = { innerWidth: 1366, innerHeight: 900, activeTableId: 'underlying-table' };
Object.assign(globalThis, { $: () => ({ find: () => ({ length: uploading ? 1 : 0 }) }) });
class FixtureElement {}
Object.assign(globalThis, { HTMLElement: FixtureElement });

interface ElementFixture {
  type: unknown;
  props: Record<string, unknown>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function find(value: unknown, predicate: (node: ElementFixture) => boolean): ElementFixture | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const result = find(child, predicate);
      if (result) return result;
    }
  } else if (object(value) && object(value['props'])) {
    const node = { type: value['type'], props: value['props'] };
    if (predicate(node)) return node;
    return find(node.props['children'], predicate);
  }

  return undefined;
}

function invoke(node: ElementFixture | undefined, key: string, ...args: unknown[]) {
  if (!node) throw new Error('Missing rendered control');
  const callback = node.props[key];
  if (typeof callback !== 'function') throw new Error('Missing handler ' + key);
  return callback(...args);
}

function load(file: string, imports: Record<string, unknown>) {
  const target = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', 'require', transformFileSync(path.join(__dirname, file)).code)(
    target,
    target.exports,
    (name: string) => {
      if (name in imports) return imports[name];
      throw new Error('Unstubbed row interaction import: ' + name);
    },
  );
  return target.exports['default'];
}

interface DetailInstance {
  state: Record<string, unknown>;
  setState(value: Record<string, unknown>, callback?: () => void): void;
  formcon: { current: unknown };
  customwidget: { current: unknown };
  handleSave(nextContinue?: boolean, switchSave?: boolean, ignoreAlert?: boolean): false | undefined;
  handleClose(): void;
  render(): unknown;
}
const Detail = load('RowDetail.tsx', {
  react: React,
  'react/jsx-runtime': require('react/jsx-runtime'),
  'react-redux': { shallowEqual: require('react-redux').shallowEqual },
  lodash,
  'prop-types': require('prop-types'),
  'worksheet/common/recordInfo/RecordInfoContext': React.createContext({}),
  'src/components/Form': CustomFields,
  'src/utils/control': { isRelateRecordTableControl: () => false },
}) as new (props: Record<string, unknown>) => DetailInstance;

function scenario(mobile: boolean, fresh: boolean, invalid: boolean) {
  const saves: unknown[][] = [],
    switches: unknown[] = [];
  let closed = 0,
    next = 0;
  const props = {
    title: 'Child row',
    visible: true,
    mobileIsEdit: true,
    data: { rowid: fresh ? 'temp-row' : 'existing-row', text: 'before' },
    controls: [{ controlId: 'text', type: 2 }],
    onSave: (...args: unknown[]) => saves.push(args),
    onClose: () => closed++,
    openNextRecord: () => next++,
    onSwitch: (value: unknown) => switches.push(value),
    onDelete() {},
    switchDisabled: { next: true },
    allowDelete: true,
  };
  const detail = new Detail(props);

  detail.setState = (value, callback) => {
    detail.state = { ...detail.state, ...value };
    callback?.();
  };

  detail.formcon.current = { querySelector: () => (uploading ? new FixtureElement() : null) };
  const submitOptions: unknown[] = [];
  detail.customwidget.current = {
    dataFormat: { getUpdateControlIds: () => ['text'] },
    getSubmitData: (options: unknown) => {
      submitOptions.push(options);
      return { fullData: [{ controlId: 'text', value: 'after' }], error: invalid };
    },
  };
  const effects: Array<() => void | (() => void)> = [];
  const Module = load(mobile ? 'RowDetailMobileModal.tsx' : 'RowDetailModal.tsx', {
    react: {
      useRef: () => ({ current: detail }),
      useEffect: (effect: () => void | (() => void)) => effects.push(effect),
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'antd-mobile': { Popup, Button, ActionSheet: { show: () => ({ close() {} }) } },
    classnames: require('classnames'),
    lodash,
    'prop-types': require('prop-types'),
    './RowDetail': Detail,
    'ming-ui': { Button, Modal, ScrollView: () => null },
    'ming-ui/antd-components': { Tooltip: () => null },
    'worksheet/common/recordInfo/RecordForm/IconBtn.jsx': IconBtn,
    'src/utils/common': { browserIsMobile: () => false },
  }) as (props: Record<string, unknown>) => unknown;
  const tree = Module(props);

  if (mobile) {
    assert.equal(find(tree, node => node.type === Popup)?.props['onClose'], props.onClose);
    if (fresh) {
      invoke(
        find(tree, node => node.type === Button && node.props['children'] === '继续创建'),
        'onClick',
      );
      assert.equal(next, invalid ? 0 : 1);
      assert.equal(closed, invalid ? 0 : 1);
    } else {
      invoke(
        find(tree, node => node.type === Button && node.props['children'] === '上一条'),
        'onClick',
      );
      assert.deepEqual(switches, invalid ? [] : [{ prev: true }]);
      invoke(
        find(tree, node => node.type === Button && node.props['children'] === '下一条'),
        'onClick',
      );
      assert.equal(switches.length, invalid ? 0 : 1, 'disabled next never switches');
      uploading = true;
      const submitted = submitOptions.length;
      invoke(
        find(tree, node => node.type === Button && node.props['children'] === '上一条'),
        'onClick',
      );
      assert.equal(submitOptions.length, submitted, 'uploading blocks both save and row navigation');
      uploading = false;
      invoke(
        find(tree, node => String(node.props['className']).includes('icon-cancel')),
        'onClick',
      );
      assert.equal(
        closed,
        invalid ? 1 : 2,
        'mobile cancel retains the existing save-close and wrapper-close callbacks',
      );
      assert.deepEqual(submitOptions.at(-1), { ignoreAlert: true });
    }
  } else {
    const cleanup = effects[0]?.();
    assert.equal(window.activeTableId, undefined);
    const close = find(tree, node => node.type === IconBtn && !String(node.props['className']).includes('delete'));
    uploading = true;
    invoke(close, 'onClick');
    assert.equal(closed, 0, 'desktop close waits for uploading attachment');
    uploading = false;
    invoke(close, 'onClick');
    assert.equal(closed, 1);
    if (typeof cleanup !== 'function') throw new Error('Missing focus restoration cleanup');
    cleanup();
    assert.equal(window.activeTableId, 'underlying-table');
  }

  return saves.length;
}

for (const invalid of [false, true]) {
  for (const fresh of [false, true]) {
    scenario(true, fresh, invalid);
    scenario(false, fresh, invalid);
  }
}

// Drive the actual Form uniqueness consumer with the RowDetail-rendered callback.
const actions = fs.readFileSync(path.join(root, 'src/components/Form/store/actions.tsx'), 'utf8');

function functionSource(name: string) {
  const start = actions.indexOf('export const ' + name + ' =');
  assert.ok(start >= 0);
  const end = actions.indexOf('\nexport const ', start + 1);
  return actions.slice(start, end < 0 ? undefined : end).replace('export const ', 'const ');
}

const code = transformSync(
  functionSource('updateUniqueErrorItemsAction') +
    '\n' +
    functionSource('checkControlUniqueAction') +
    '\nmodule.exports = checkControlUniqueAction;',
  { filename: 'unique-consumer.tsx' },
).code;
const target = { exports: undefined as unknown };
new Function('module', '_', 'FORM_ERROR_TYPE', code)(target, lodash, { UNIQUE: 'UNIQUE' });
const validate = target.exports as (dispatch: (value: unknown) => void, options: Record<string, unknown>) => void;

for (const answer of [true, false, undefined]) {
  const calls: unknown[][] = [];
  const instance = new Detail({
    data: { rowid: 'existing-row' },
    controls: [],
    handleUniqueValidate: (...args: unknown[]) => {
      calls.push(args);
      return answer;
    },
  });
  const form = find(instance.render(), node => node.type === CustomFields);
  if (!form) throw new Error('Missing row form');
  const uniqueErrorItems = [{ controlId: 'text', errorType: 'UNIQUE', showError: true }];
  const updates: unknown[] = [];
  validate(value => updates.push(value), {
    props: { checkCellUnique: form.props['checkCellUnique'] },
    getState: () => ({ uniqueErrorItems }),
    controlId: 'text',
    controlValue: 'candidate',
  });
  assert.deepEqual(calls[0]?.slice(0, 3), ['text', 'candidate', 'existing-row']);
  assert.equal(uniqueErrorItems.length, answer === true ? 0 : 2, 'actual consumer respects the callback return value');
  assert.deepEqual(updates[0], { type: 'SET_UNIQUE_ERROR_ITEMS', payload: uniqueErrorItems });
}

assert.ok(alerts.length >= 4, 'upload guards display feedback');
console.log('Child row interactions: 8 mobile/desktop modal paths and 3 real uniqueness consumer outcomes passed');
