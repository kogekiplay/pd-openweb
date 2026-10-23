const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync, jsxRuntimeFrom } = require('../../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const moment = require('moment');

interface Source {
  cid?: string | number;
  rcid?: string;
  staticValue?: string | number;
}
interface Control {
  type?: number;
  controlId?: string;
  enumDefault?: number;
  enumDefault2?: number;
  dataSource?: string;
  sourceControlType?: number;
  sourceControl?: Control;
  default?: unknown;
  advancedSetting?: Record<string, string>;
  relationControls?: Control[];
  showControls?: string[];
}
interface Node {
  type: unknown;
  props: Record<string, unknown>;
}
interface Instance {
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  render: () => Node;
  [method: string]: unknown;
}
const noOp = () => {};
const node = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): Node => ({
  type,
  props: { ...props, ...(children.length ? { children } : {}) },
});
class Component {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(value: Record<string, unknown>) {
    this.state = { ...this.state, ...value };
  }
}
const parse = (value: unknown) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
const stubs: Record<string, unknown> = {
  lodash,
  moment,
  xss: require('xss'),
  'prop-types': require('prop-types'),
  'react-redux': { shallowEqual: (a: unknown, b: unknown) => a === b },
  react: {
    Component,
    createRef: () => ({ current: null }),
    useRef: () => ({ current: null }),
    useState: (value: unknown) => [value, noOp],
    useEffect: noOp,
    useMemo: (factory: () => unknown) => factory(),
    Fragment: 'fragment',
  },
  'react/jsx-runtime': jsxRuntimeFrom(node),
  antd: { Input: 'input', Modal: 'modal', Dropdown: 'dropdown' },
  classnames: require('classnames'),
  'immutability-helper': require('immutability-helper'),
  'styled-components': { __esModule: true, default: Object.assign(() => () => 'styled', { div: () => 'styled' }) },
  'ming-ui': {
    Dialog: 'dialog',
    RichText: 'richtext',
    Icon: 'icon',
    TagTextarea: 'tag-editor',
    MdAntDatePicker: 'date-picker',
    MdAntDateRangePicker: 'date-range',
    MdAntTimePicker: 'time-picker',
    MdAntTimeRangePicker: 'time-range',
  },
  'ming-ui/components/CityPicker': { __esModule: true, default: 'city-picker' },
  'worksheet/components/ChildTable': { __esModule: true, default: 'child-table' },
  'src/pages/widgetConfig/styled/style.less': {},
  '../components': {
    DynamicInput: 'dynamic-input',
    OtherField: 'field',
    OtherFieldList: 'field-list',
    SelectOtherField: 'source-selector',
    ClickAwayMenu: 'selection-menu',
  },
  '../styled': { DynamicValueInputWrap: 'input-wrap', WrapMaxOrMin: 'range-wrap', OptionControl: 'option' },
  '../../../../styled': { DropdownContent: 'menu-wrap', SettingItem: 'setting-item' },
  '../../../../util/setting': {
    getDatePickerConfigs: (control: Control) => ({
      mode: control.type === 16 ? 'datetime' : 'date',
      formatMode: control.type === 16 ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD',
    }),
    getOptions: (control: { options?: unknown[] }) => control.options || [],
    handleAdvancedSettingChange: (control: Control, setting: object) => ({
      ...control,
      advancedSetting: { ...control.advancedSetting, ...setting },
    }),
  },
  'src/pages/widgetConfig/util/setting': {
    handleAdvancedSettingChange: (control: Control, setting: object) => ({
      ...control,
      advancedSetting: { ...control.advancedSetting, ...setting },
    }),
  },
  'src/utils/control': {
    formatNumberFromInput: (value: unknown) => String(value ?? '').replace(/[^0-9.-]/g, ''),
    checkCellIsEmpty: (value: unknown) => value === undefined || value === null || value === '',
    renderText: (control: { value?: unknown }) => control.value,
  },
  'src/utils/controlCommon': { transferValue: (value: unknown) => [{ staticValue: value }] },
  'src/pages/widgetConfig/util': {
    isSheetDisplay: (control: Control) => control.type === 29 && control.enumDefault === 2,
  },
  'src/pages/widgetConfig/config/widget': { SYS: ['rowid'] },
  'src/pages/widgetConfig/util/data': { getConcatenateControls: (controls: Control[]) => controls },
  'src/components/OptionChip': { OptionChip: 'option-chip' },
  uuid: { v4: () => 'fixed-id' },
};
function load<Model>(filename: string, environment: Record<string, unknown> = {}): Model {
  const compiled = transformFileSync(filename, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
  const moduleLike: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', '_l', 'safeParse', 'document', 'md', 'window', compiled.code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (name === 'src/pages/widgetConfig/util/subListWorksheetCache') return load(path.resolve(__dirname, '../../../util/subListWorksheetCache.ts'), environment);
      throw new Error(`Unexpected input dependency ${name}`);
    },
    (text: string, ...args: unknown[]) =>
      args.reduce<string>((value, arg, index) => value.replace(`%${index}`, String(arg)), text),
    parse,
    { body: {}, querySelector: () => null },
    { global: { FileStoreConfig: { pictureHost: '/picture' } } },
    environment,
  );
  return moduleLike.exports as Model;
}
function find(value: unknown, type: unknown): Node | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = find(child, type);
      if (found) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object' || !('type' in value) || !('props' in value)) return undefined;
  const current = value as Node;
  return current.type === type ? current : find(current.props['children'], type);
}
function call(target: object, key: string, ...args: unknown[]) {
  const method: unknown = Reflect.get(target, key);
  assert.equal(typeof method, 'function');
  return Reflect.apply(method as (...args: unknown[]) => unknown, target, args);
}
function invoke(node: Node | undefined, key: string, ...args: unknown[]) {
  assert.ok(node);
  return call(node.props, key, ...args);
}
const root = __dirname;
const config = load<Record<string, unknown>>(path.join(root, 'config.ts'));
stubs['../config'] = config;
stubs['./config'] = config;
stubs['src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/config.js'] = config;
const boundaries = load<Record<string, unknown>>(path.join(root, 'dynamicTypes.ts'));
stubs['../dynamicTypes'] = boundaries;
stubs['../../dynamicTypes'] = boundaries;
stubs['./dynamicTypes'] = boundaries;
const utilities = load<Record<string, unknown>>(path.join(root, 'util.ts'));
stubs['../util'] = utilities;

// Independent field-type expectations, with missing-mode source transformation preserved.
const fields = [
  { controlId: 'text', type: 2 },
  { controlId: 'number', type: 6 },
  { controlId: 'date', type: 15 },
  { controlId: 'member', type: 26, enumDefault: 0 },
  { controlId: 'department', type: 27 },
  { controlId: 'derived-number', type: 30, sourceControlType: 6 },
];
const selected = (type: number, from?: number) =>
  (call(utilities, 'getControls', { data: { type }, controls: fields, from }) as Control[]).map(
    value => value.controlId,
  );
assert.deepEqual(selected(6), ['number', 'derived-number']);
assert.deepEqual(selected(6, 6), ['number']);
assert.deepEqual(selected(15), ['date']);
assert.deepEqual(selected(27), ['member', 'department']);
assert.deepEqual(call(utilities, 'getControls', {}), []);
assert.equal(call(utilities, 'showClear', { type: 5 }, [{ staticValue: '{"accountId":"user-self"}' }]), true);
assert.equal(call(utilities, 'showClear', { type: 5 }, [{ staticValue: 0 }]), false);
assert.equal(call(boundaries, 'dynamicRecordId', '["record"]'), 'record');
assert.equal(call(boundaries, 'dynamicRecordId', '[{"rowid":"record","path":"[\\"A\\",\\"B\\"]"}]'), 'record');
assert.equal(call(boundaries, 'dynamicRecordId', 'invalid'), undefined);

const emitted: Source[][] = [];
const changed: Control[] = [];
const props = {
  data: { type: 15, controlId: 'control', advancedSetting: {} },
  dynamicValue: [],
  onDynamicValueChange: (value: Source[]) => emitted.push(value),
  onChange: (value: Control) => changed.push(value),
  clearOldDefault: noOp,
  allControls: [],
};
const create = (name: string, extra: object = {}) => {
  const module = load<{ default: new (props: object) => Instance }>(path.join(root, 'inputTypes', name));
  return new module.default({ ...props, ...extra });
};
for (const name of ['DateInput.tsx', 'TimeInput.tsx']) {
  const instance = create(name, { data: { type: name.startsWith('Date') ? 15 : 46 } });
  if (name.startsWith('Date')) call(instance, 'handleDateChange', moment('2026-10-13'));
  else call(instance, 'handleTimeChange', moment('12:34', 'HH:mm'), 'HH:mm');
  assert.equal(emitted.at(-1)?.[0]?.staticValue, name.startsWith('Date') ? '2026-10-13' : '12:34');
  if (name.startsWith('Date')) call(instance, 'handleDateChange', [moment('2026-10-13'), null]);
  else call(instance, 'handleTimeChange', [moment('12:34', 'HH:mm'), null], 'HH:mm');
  assert.deepEqual(emitted.at(-1), []);
  assert.doesNotThrow(() => call(instance, 'onTriggerClick'));
}

// Clearing a region has no final tree item; the original access-before-check threw.
const area = load<{ default: (props: object) => Node }>(path.join(root, 'inputTypes/AreaInput.tsx')).default(props);
invoke(find(area, 'city-picker'), 'callback', []);
assert.deepEqual(emitted.at(-1), []);
invoke(find(area, 'city-picker'), 'callback', [{ id: 'CN-34', path: '中国 / 安徽' }]);
assert.deepEqual(JSON.parse(String(emitted.at(-1)?.[0]?.staticValue)), { code: 'CN-34', name: '中国 / 安徽' });

const custom = create('SubSheet/CustomDefaultValue.tsx', {
  data: { type: 34, showControls: ['count', 'checked'] },
  onClose: noOp,
  dynamicValue: [{ staticValue: '[{"rowid":"r1","count":2}]' }],
});
invoke(find(custom.render(), 'child-table'), 'onChange', { rows: [{ rowid: 'r1', count: 0, checked: false }] });
invoke(find(custom.render(), 'dialog'), 'onOk');
const saved = JSON.parse(changed.at(-1)?.advancedSetting?.['defsource'] || '[]');
assert.deepEqual(JSON.parse(saved[0].staticValue), [
  { count: 0, checked: false, pid: '', rowid: 'r1', childrenids: '' },
]);
invoke(find(custom.render(), 'child-table'), 'onChange', { rows: [] });
invoke(find(custom.render(), 'dialog'), 'onOk');
assert.equal(changed.at(-1)?.advancedSetting?.['defsource'], '[]');

// A zero switch value is a static value and must render the same label as serialized "0".
stubs['../styled'] = {
  ...(stubs['../styled'] as object),
  OtherFieldList: 'field-list-wrap',
  FieldInfo: 'person',
  RelateControl: 'related',
  DynamicTextWrap: 'text-wrap',
  OtherFieldWrap: 'field-wrap',
};
stubs['./OtherField'] = { __esModule: true, default: 'field' };
const list = load<{ default: (props: object) => Node }>(path.join(root, 'components/OtherFieldList.tsx'));
const numericZero = list.default({ ...props, data: { type: 36 }, dynamicValue: [{ staticValue: 0 }] });
assert.equal(find(numericZero, 'field')?.props['text'], '不选中');
const text = load<{ default: (props: object) => Node }>(path.join(root, 'components/DynamicText.tsx'));
assert.ok(
  JSON.stringify(text.default({ ...props, data: { type: 36 }, dynamicValue: [{ staticValue: 0 }] })).includes('不选中'),
);
stubs['src/pages/widgetConfig/config/widget'] = { SYS: ['rowid'], SYS_CONTROLS: ['rowid'] };
stubs['../../../../config/widget'] = { SYSTEM_CONTROL: [], SYSTEM_PERSON_CONTROL: [], WORKFLOW_SYSTEM_CONTROL: [] };
stubs['../../../../util'] = { getIconByType: () => 'text' };
stubs['src/pages/widgetConfig/styled'] = { SelectFieldsWrap: 'fields-wrap' };
stubs['ming-ui/components/ClickAway'] = { __esModule: true, default: { wrap: (component: unknown) => component } };
const fieldModule = load<{ default: new(props: object) => Instance }>(path.join(root, 'components/SelectFields.tsx'));
const fieldSelector = new fieldModule.default({ ...props, controls: fields });
assert.equal(call(fieldSelector, 'getOtherCount', [{ list: [{ id: 'phone' }] }, { list: [] }]), 1, 'a first-group match must not be discarded by the next empty group');

stubs['ming-ui/antd-components'] = { Tooltip: 'tooltip' };
const field = load<{ default: (props: object) => Node }>(path.join(root, 'components/OtherField.tsx'));
const beforeDelete = emitted.length;
const stale = field.default({ ...props, data: { type: 6 }, controls: fields, globalSheetInfo: {}, item: { cid: 'stale' }, dynamicValue: [{ cid: 'number' }] });
const close = find(stale, 'i');
invoke(close, 'onClick', { stopPropagation: noOp });
assert.equal(emitted.length, beforeDelete, 'a stale field must not splice the last configured source');
for (const name of ['TextInput.tsx', 'ArrayInput.tsx']) {
  const tagInput = create(name);
  const textUpdates: string[] = [];
  tagInput['$tagtextarea'] = { view: {}, setValue: (value: string) => textUpdates.push(value), insertColumnTag: () => { throw new Error('Empty selection must not insert an empty field tag'); } };
  call(tagInput, 'handleDynamicValue', []);
  assert.deepEqual(textUpdates, ['']);
  assert.deepEqual(emitted.at(-1), []);
}
console.log(
  'dynamic input lifecycle: filters, date/time clear, region clear, static zero and sublist falsy/empty saves passed',
);
