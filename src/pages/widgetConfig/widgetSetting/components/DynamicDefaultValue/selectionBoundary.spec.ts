import type { ReactElement } from 'react';

// Node-only test contracts: product modules are dynamically compiled by spec-harness.
interface FormControl {
  type?: number;
  enumDefault?: number;
  advancedSetting?: Record<string, string>;
}
interface DynamicValueSource {
  cid?: string | number;
  rcid?: string;
  staticValue?: string | number;
  isAsync?: boolean;
}
interface DynamicFieldSelection {
  fieldId?: string;
  relateSheetControlId?: string;
  type?: number;
}
interface DynamicSourceMenuItem {
  key: string | number;
  id?: string;
  text?: string;
  value?: string;
}
interface SelectOtherFieldProps {
  data: FormControl;
  onDynamicValueChange: (value: DynamicValueSource[]) => void;
  onChange?: (control: FormControl) => void;
  defaultType?: string | boolean;
  from?: string | number;
  fromRange?: boolean;
  withDY?: boolean;
}

const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../../scripts/spec-harness.ts');
const react: typeof import('react') = require('react');
const lodash: typeof import('lodash') = require('lodash');

type SelectState = {
  isDynamic: boolean;
  filedVisible: boolean;
  searchVisible: boolean;
  fxVisible: boolean;
  showPopupType: string;
};
interface Selector {
  props: SelectOtherFieldProps;
  state: SelectState;
  setState: (change: Partial<SelectState>) => void;
  getCurrentField: (control: FormControl) => DynamicSourceMenuItem[];
  insertField: (field: DynamicFieldSelection) => void;
  handleAction: (item: DynamicSourceMenuItem) => void;
  handleActionForLinkParam: (value: string) => void;
  handleActionForDY: (value: number | string) => void;
  triggerClick: () => void;
  render: () => ReactElement;
}
interface Config {
  CURRENT_TYPES: Record<number, DynamicSourceMenuItem[]>;
  OTHER_FIELD_LIST: DynamicSourceMenuItem[];
  CUSTOM_PHP_TYPES: Record<number, DynamicSourceMenuItem[]>;
  DYNAMIC_FROM_MODE: Record<string, number>;
}
const noop = () => {};
const readSetting = (control: FormControl, key?: string) => {
  if (!key) return control.advancedSetting || {};
  const value = control.advancedSetting?.[key];
  if (!value) return '';
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
const stubs: Record<string, unknown> = {
  react,
  'react/jsx-runtime': require('react/jsx-runtime'),
  lodash,
  classnames: require('classnames'),
  'prop-types': require('prop-types'),
  'styled-components': require('styled-components'),
  '@rc-component/trigger': { __esModule: true, default: 'trigger' },
  'ming-ui': { Menu: 'menu', MenuItem: 'menu-item' },
  'ming-ui/antd-components': { Tooltip: 'tooltip' },
  'src/pages/widgetConfig/util': {
    isSheetDisplay: (control: FormControl) => control.type === 29 && control.enumDefault === 2,
  },
  '../../../../util/setting': {
    getAdvanceSetting: readSetting,
    handleAdvancedSettingChange: (control: FormControl, changes: object) => ({
      ...control,
      advancedSetting: { ...control.advancedSetting, ...changes },
    }),
  },
  '../../CustomEvent/config': { ACTION_VALUE_ENUM: { SET_VALUE: 'set' } },
  '../../FunctionEditorDialog': { __esModule: true, default: 'formula-dialog' },
  '../../SearchWorksheet/SearchWorksheetDialog': { __esModule: true, default: 'search-dialog' },
  '../styled': { SelectOtherFieldWrap: 'source-button' },
  './SelectFields': { __esModule: true, default: 'field-selector' },
  'rc-trigger/assets/index.css': {},
  'src/pages/worksheet/common/ViewConfig/components/fastFilter/util.js': {
    getDaterange: (settings: Record<string, unknown>) =>
      settings['daterange'] ? JSON.parse(String(settings['daterange'])) : undefined,
  },
};
function load<Model>(filename: string): Model {
  const compiled = transformFileSync(filename, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
  const moduleLike: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', '_l', 'document', compiled.code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      throw new Error(`Unexpected selector dependency: ${name}`);
    },
    (text: string) => text,
    { body: 'body-fallback' },
  );
  return moduleLike.exports as Model;
}
const config = load<Config>(path.join(__dirname, 'config.ts'));
stubs['../config'] = config;
stubs['src/pages/worksheet/common/ViewConfig/components/fastFilter/config.js'] = load<{ DATE_TYPE: unknown }>(
  path.resolve(__dirname, '../../../../worksheet/common/ViewConfig/components/fastFilter/config.ts'),
);
const { default: Select } = load<{ default: new (props: SelectOtherFieldProps) => Selector }>(
  path.join(__dirname, 'components/SelectOtherField.tsx'),
);
const sources = load<{
  dynamicValueSources: (value: unknown) => DynamicValueSource[];
  readDynamicValueSources: (control: FormControl) => DynamicValueSource[];
}>(path.join(__dirname, 'dynamicTypes.ts'));

function make(extra: Partial<SelectOtherFieldProps> = {}) {
  const emitted: DynamicValueSource[][] = [];
  const changed: FormControl[] = [];
  const instance = new Select({
    data: { type: 2 },
    onDynamicValueChange: value => emitted.push(value),
    onChange: value => changed.push(value),
    ...extra,
  });
  instance.setState = change => {
    instance.state = { ...instance.state, ...change };
  };
  return { instance, emitted, changed };
}
function element(value: unknown, type: string): ReactElement<Record<string, unknown>> | undefined {
  if (!react.isValidElement<Record<string, unknown>>(value)) return undefined;
  if (value.type === type) return value;
  const children: unknown = value.props['children'];
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = element(child, type);
    if (found) return found;
  }
  return undefined;
}

// Actual menu constants and callback methods, with independent expected wire payloads.
for (const [key, expected] of [
  ['dept', { departmentName: 'current', departmentId: 'user-departments' }],
  ['role', { organizeName: 'current', organizeId: 'user-role' }],
  ['user', { accountId: 'user-self', name: 'current' }],
] as const) {
  const { instance, emitted } = make();
  instance.state.isDynamic = true;
  instance.handleAction({ key, id: 'user-self', text: 'current' });
  assert.deepEqual(JSON.parse(String(emitted[0]?.[0]?.staticValue)), expected);
  assert.equal(emitted[0]?.[0]?.isAsync, key !== 'user');
  assert.equal(instance.state.isDynamic, false);
}
for (const key of [
  'location',
  'ocr',
  'keyword',
  'waterMask',
  'h5waterMask',
  'empty',
  'codeResult',
  'triggerTime',
  'triggerDepartment',
  'triggerOrg',
  'triggerUser',
  'printTemp',
]) {
  const { instance, emitted } = make();
  instance.handleAction({ key, id: 'wire-id' });
  assert.deepEqual(emitted, [[{ rcid: '', cid: 'wire-id', staticValue: '' }]]);
}
for (const [target, selected, async] of [
  [26, 27, true],
  [27, 26, true],
  [48, 26, true],
  [2, 15, false],
] as const) {
  const { instance, emitted } = make({ data: { type: target } });
  instance.insertField({ fieldId: 'field', relateSheetControlId: 'parent', type: selected });
  assert.deepEqual(emitted[0], [{ cid: 'field', rcid: 'parent', staticValue: '', isAsync: async }]);
}
for (const [defaultType, stateKey] of [
  ['dynamicsrc', 'searchVisible'],
  ['defaultfunc', 'fxVisible'],
] as const) {
  const { instance } = make({ defaultType });
  instance.triggerClick();
  assert.equal(instance.state[stateKey], true);
}
const date = make();
date.instance.handleAction({ key: 'date', value: '2', id: 'current' });
assert.deepEqual(date.emitted[0], [{ rcid: '', cid: '', staticValue: '2', time: 'current' }]);
date.instance.handleAction({ key: 'time', value: '2' });
assert.deepEqual(date.emitted[1], [{ rcid: '', cid: '', staticValue: '2' }]);

const originalMenu = JSON.stringify(config.OTHER_FIELD_LIST);
const range = make({ fromRange: true });
for (let i = 0; i < 4; i++) {
  assert.deepEqual(
    range.instance.getCurrentField({ type: 2 }).map(item => item.key),
    [1, 'dept', 2, 3],
  );
  assert.equal(
    JSON.stringify(config.OTHER_FIELD_LIST),
    originalMenu,
    'member-range menus must not mutate shared defaults',
  );
}
assert.deepEqual(
  make()
    .instance.getCurrentField({ type: 2 })
    .map(item => item.key),
  [1, 2, 3],
);
assert.deepEqual(make({ from: config.DYNAMIC_FROM_MODE['CUSTOM_PHP'] }).instance.getCurrentField({ type: 6 }), []);
assert.doesNotThrow(() => make({ from: 'subList' }).instance.getCurrentField({ type: 2 }));
const fast = make({ from: config.DYNAMIC_FROM_MODE['FAST_FILTER'] });
for (const type of [26, 27, 48]) assert.deepEqual(fast.instance.getCurrentField({ type }), config.CURRENT_TYPES[type]);

for (const identifier of [1, '1']) {
  const { instance, emitted } = make({
    from: config.DYNAMIC_FROM_MODE['FAST_FILTER'],
    withDY: true,
    data: { type: 15, advancedSetting: { daterange: JSON.stringify([identifier, null, {}, false]) } },
  });
  instance.state = { ...instance.state, showPopupType: 'DY_DATE', isDynamic: true };
  const trigger = element(instance.render(), 'trigger');
  assert.ok(trigger);
  assert.equal((trigger.props['getPopupContainer'] as () => unknown)(), 'body-fallback');
  const popup = (trigger.props['popup'] as () => ReactElement)();
  const items = react.Children.toArray(popup.props['children']);
  assert.equal(items.length, 1);
  const item = element(items[0], 'menu-item');
  assert.ok(item);
  (item.props['onClick'] as (event: object) => void)({ stopPropagation: noop });
  assert.deepEqual(emitted[0], [{ cid: identifier, rcid: 'dateRange', staticValue: '', isAsync: true }]);
}
const emptyRange = make({ from: config.DYNAMIC_FROM_MODE['FAST_FILTER'], withDY: true });
emptyRange.instance.state.showPopupType = 'DY_DATE';
assert.doesNotThrow(() => (element(emptyRange.instance.render(), 'trigger')?.props['popup'] as () => unknown)());
const link = make();
link.instance.handleActionForLinkParam('customer');
assert.deepEqual(link.emitted[0], [{ cid: 'customer', rcid: 'url', staticValue: '', isAsync: true }]);

const valid = [
  { cid: 'field', rcid: 'parent', staticValue: 'value', extra: { preserved: true } },
  { cid: 1, rcid: 'dateRange', staticValue: '' },
  { staticValue: 3 },
];
assert.equal(sources.dynamicValueSources(valid), valid, 'valid source array identity and metadata must survive');
assert.equal(sources.dynamicValueSources(valid)[0], valid[0]);
for (const invalid of [null, '{}', {}, [null], [{ cid: {} }], [{ staticValue: NaN }], [{ isAsync: 'true' }]])
  assert.deepEqual(sources.dynamicValueSources(invalid), []);
assert.deepEqual(
  sources.dynamicValueSources([valid[0], null]),
  [valid[0]],
  'invalid slots must not remove valid sources',
);

// The general field decoder reproduces the lost numeric date ID. This UI reads its own wire protocol.
const general = load<{ decodeKnownSetting: (key: string, value: unknown) => unknown }>(
  path.resolve(__dirname, '../../../../../utils/advancedSettingBoundary.ts'),
);
assert.deepEqual(general.decodeKnownSetting('defsource', [valid[1]]), []);
assert.deepEqual(sources.readDynamicValueSources({ advancedSetting: { defsource: JSON.stringify([valid[1]]) } }), [
  valid[1],
]);
for (const wire of ['', '{', '{}', 'null'])
  assert.deepEqual(sources.readDynamicValueSources({ advancedSetting: { defsource: wire } }), []);

stubs['react'] = { ...react, useEffect: noop, useState: (value: unknown) => [value, noop] };
stubs['../dynamicTypes'] = sources;
stubs['src/utils/common'] = { htmlEncodeReg: (value: string) => value || '' };
stubs['src/pages/widgetConfig/util/setting'] = stubs['../../../../util/setting'];
stubs['src/utils/controlCommon'] = { getAdvanceSetting: readSetting };
stubs['../../../../util/advancedSettingBoundary'] = load(
  path.resolve(__dirname, '../../../util/advancedSettingBoundary.ts'),
);
stubs['../styled'] = { DynamicInputStyle: 'dynamic-tag' };
const { default: DynamicInput } = load<{ default: (props: object) => ReactElement }>(
  path.join(__dirname, 'components/DynamicInput.tsx'),
);
const { renderToStaticMarkup } = require('react-dom/server');
for (const [id, label] of [
  [1, '今天'],
  ['2', '昨天'],
] as const) {
  const data = {
    type: 15,
    advancedSetting: {
      defsource: JSON.stringify([{ cid: id, rcid: 'dateRange', staticValue: '' }]),
      daterange: JSON.stringify([id]),
    },
  };
  const html = renderToStaticMarkup(DynamicInput({ data, onChange: noop }));
  assert.ok(html.includes(label), `selected date ${id} must survive parsing and render its label`);
  assert.ok(!html.includes('已删除'));
}
const deleted = renderToStaticMarkup(
  DynamicInput({ data: { type: 15, advancedSetting: { defsource: JSON.stringify([valid[1]]) } }, onChange: noop }),
);
assert.ok(deleted.includes('已删除'));

// Exercise the actual input registry and entry, including normalized lightweight caller props.
for (const name of [
  'AreaInput',
  'ArrayInput',
  'AttachmentInput',
  'CascaderSheet',
  'DateInput',
  'DepartmentInput',
  'EmailInput',
  'LocationInput',
  'NumberInput',
  'ObjectInput',
  'OptionInput',
  'PhoneInput',
  'RelateSheet',
  'RichInput',
  'RoleInput',
  'ScoreInput',
  'SubSheet',
  'SwitchInput',
  'TextInput',
  'TimeInput',
  'UserInput',
])
  stubs[`./${name}`] = { __esModule: true, default: name === 'DateInput' ? 'date-input' : 'other-input' };
const registry = load<{ isDynamicInputType: (type: string) => boolean }>(path.join(__dirname, 'inputTypes/index.ts'));
assert.equal(registry.isDynamicInputType('date'), true);
for (const name of ['toString', '__proto__', 'constructor', 'unregistered'])
  assert.equal(registry.isDynamicInputType(name), false);
stubs['./inputTypes'] = registry;
stubs['./dynamicTypes'] = sources;
stubs['./config'] = config;
stubs['src/pages/widgetConfig/config/widget'] = { SYS: [] };
stubs['src/pages/widgetConfig/util/data'] = { getConcatenateControls: () => [] };
stubs['./util'] = load(path.join(__dirname, 'util.ts'));
stubs['../../../util/advancedSettingBoundary'] = stubs['../../../../util/advancedSettingBoundary'];
stubs['../../../util/setting'] = stubs['../../../../util/setting'];
stubs['../../../styled'] = { SettingItem: 'setting-item' };
stubs['src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/config.js'] = config;
const { default: Entry } = load<{ default: (props: object) => ReactElement }>(path.join(__dirname, 'index.tsx'));
for (const id of [1, '2']) {
  let saved: FormControl | undefined;
  const data = {
    type: 15,
    advancedSetting: { defsource: JSON.stringify([{ cid: id, rcid: 'dateRange', staticValue: '' }]) },
  };
  const input = element(
    Entry({
      data,
      onChange: (control: FormControl) => {
        saved = control;
      },
    }),
    'date-input',
  );
  assert.ok(input);
  assert.equal(input.props['defaultType'], true, 'numeric date-range IDs must select the dynamic display');
  assert.deepEqual(input.props['dynamicValue'], [{ cid: id, rcid: 'dateRange', staticValue: '' }]);
  assert.deepEqual(input.props['allControls'], []);
  (input.props['onDynamicValueChange'] as (value: DynamicValueSource[]) => void)([
    { cid: id, rcid: 'dateRange', staticValue: '' },
  ]);
  assert.deepEqual(JSON.parse(saved?.advancedSetting?.defsource || '[]'), [
    { cid: id, rcid: 'dateRange', staticValue: '' },
  ]);
}
console.log('dynamic source menus, action payloads, date/link wire identity and malformed boundaries passed');
