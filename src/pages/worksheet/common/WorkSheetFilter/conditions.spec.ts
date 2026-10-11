import type { ComponentType, ReactNode } from 'react';
import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const sc: typeof import('styled-components/dist/index') = require('styled-components');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const generate: typeof import('@babel/generator').default = require('@babel/generator').default;
const lodash: typeof import('lodash') = require('lodash');
const moment: typeof import('moment') = require('moment');
const root = path.resolve(__dirname, '../../../../..');
const beforeDirectory = process.env['CONDITIONS_BEFORE_DIR'];
const base = 'src/pages/worksheet/common/WorkSheetFilter';
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture receiver');
  return Reflect.get(value, key);
}
function call(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Missing actual method ' + key);
  return Reflect.apply(fn, value, args);
}
function node(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map(node);
  throw new TypeError('Invalid render result');
}
function state(value: unknown): Record<string, unknown> {
  const result = read(value, 'state');
  if (!object(result)) throw new TypeError('Invalid actual state');
  return result;
}
interface ElementView {
  type: unknown;
  props: Record<string, unknown>;
}
function walk(value: unknown): ElementView[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!object(value) || !object(value['props'])) return [];
  return [{ type: value['type'], props: value['props'] }, ...walk(value['props']['children'])];
}
function find(value: unknown, predicate: (element: ElementView) => boolean): ElementView {
  const found = walk(value).find(predicate);
  if (!found) throw new Error('Missing actual rendered element');
  return found;
}
function event(value: ElementView, name: string, args: unknown[] = []): unknown {
  return call(value.props, name, args);
}
class Component extends React.Component<Record<string, unknown>, Record<string, unknown>> {
  override state: Record<string, unknown> = {};
  override setState(update: unknown, callback?: () => void): void {
    const patch = typeof update === 'function' ? Reflect.apply(update, this, [this.state, this.props]) : update;
    if (!object(patch)) throw new TypeError('Invalid actual state patch');
    Object.assign(this.state, patch);
    callback?.();
  }
}
class FixtureElement {}
const translate = (text: string, ...args: unknown[]) =>
  args.length ? text.replace(/%(\d+)/g, (_, i: string) => String(args[Number(i)])) : text.replace(/%\d{5}$/, '');
function selectedSource(relative: string, names: string[]): string {
  const parsed = harness.parser.parse(fs.readFileSync(path.join(root, relative), 'utf8'), { sourceType: 'module' });
  const found: string[] = [];
  for (const entry of parsed.program.body) {
    const declaration = entry.type === 'ExportNamedDeclaration' ? entry.declaration : entry;
    if (!declaration) continue;
    if (declaration.type === 'FunctionDeclaration' && declaration.id && names.includes(declaration.id.name))
      found.push(generate(declaration).code);
    if (
      declaration.type === 'VariableDeclaration' &&
      declaration.declarations.some(d => d.id.type === 'Identifier' && names.includes(d.id.name))
    )
      found.push(generate(declaration).code);
  }
  assert.equal(found.length, names.length, 'Every helper is extracted from the actual producer');
  return found.join('\n') + '\nmodule.exports={' + names.join(',') + '};';
}
interface Fixture {
  enums: unknown;
  boundary: unknown;
  creates(name: string, props: Record<string, unknown>): unknown;
  groups(props: Record<string, unknown>): unknown;
  html(value: unknown): { html: string; css: string };
  dropdown: unknown;
  select: unknown;
  add: unknown;
  input: unknown;
  condition: unknown;
  focuses: unknown[];
}
function fixture(before = false): Fixture {
  const cache = new Map<string, unknown>();
  const focuses: unknown[] = [];
  const globals = {
    _l: translate,
    md: { global: { Account: { accountId: 'mine', isPortal: false } } },
    window: { md: { global: { Account: { isPortal: false } } } },
    document: { body: {} },
    Element: FixtureElement,
    alert: (...args: unknown[]) => focuses.push(['alert', ...args]),
    $: (target: unknown) => ({
      length: target === 'menu-target' ? 1 : 0,
      closest: () => ({ length: target instanceof FixtureElement ? (Reflect.get(target, 'menu') ? 1 : 0) : 0 }),
      eq() {
        return this;
      },
      find() {
        return this;
      },
      focus() {
        focuses.push(['focus', target]);
      },
    }),
  };
  function dropdown(props: Record<string, unknown>): ReactNode {
    return React.createElement(
      'div',
      {
        className: props['className'],
        'data-ui': 'dropdown',
        'data-value': String(props['value'] ?? props['defaultValue']),
        'data-disabled': String(props['disabled']),
        'data-options': JSON.stringify(props['data']),
      },
      typeof props['renderTitle'] === 'function' ? node(call(props, 'renderTitle')) : null,
    );
  }
  function input(props: Record<string, unknown>): ReactNode {
    return React.createElement('input', {
      className: typeof props['className'] === 'string' ? props['className'] : undefined,
      disabled: Boolean(props['disabled']),
      defaultValue: typeof props['defaultValue'] === 'string' ? props['defaultValue'] : undefined,
    });
  }
  function ui(props: Record<string, unknown>): ReactNode {
    return React.createElement('span', { className: props['className'] }, node(props['text']), node(props['children']));
  }
  function add(props: Record<string, unknown>): ReactNode {
    return React.createElement(
      'div',
      { 'data-ui': 'add', 'data-count': Array.isArray(props['columns']) ? props['columns'].length : 0 },
      node(props['children']),
    );
  }
  function menu(props: Record<string, unknown>): ReactNode {
    return React.createElement('ul', { className: props['className'] }, node(props['children']));
  }
  function item(props: Record<string, unknown>): ReactNode {
    return React.createElement(
      'li',
      { className: props['className'], 'data-disabled': String(props['disabled']) },
      node(props['children']),
    );
  }
  function trigger(props: Record<string, unknown>): ReactNode {
    return React.createElement(
      'div',
      { 'data-ui': 'trigger', 'data-open': String(props['popupVisible']) },
      node(props['children']),
      node(props['popup']),
    );
  }
  let styledIndex = 0;
  function styled<P extends object>(component: ComponentType<P>) {
    return sc.default(component).withConfig({ componentId: 'condition-fixture-' + styledIndex++ });
  }
  Object.defineProperty(styled, 'div', {
    get: () => sc.default.div.withConfig({ componentId: 'condition-fixture-' + styledIndex++ }),
  });
  function compile(source: string, filename: string, extra: Record<string, unknown> = {}): unknown {
    const result: { exports: unknown } = { exports: {} };
    const transformed = harness.transformSync(source, {
      filename,
      comments: false,
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
    });
    assert.ok(transformed?.code);
    new Function('module', 'exports', 'require', ...Object.keys(globals), ...Object.keys(extra), transformed.code)(
      result,
      result.exports,
      (name: string): unknown => {
        if (name === 'react') return { ...React, Component };
        if (['react/jsx-runtime', 'lodash', 'moment', 'classnames', 'prop-types'].includes(name)) return require(name);
        if (name === 'antd') return require('antd');
        if (name === 'src/utils/typedStyled' || name === 'styled-components')
          return { __esModule: true, default: styled };
        if (name === 'ming-ui') return { Dropdown: dropdown, Input: input, Icon: ui, VCenterIconText: ui };
        if (name === 'ming-ui/antd-components')
          return {
            Tooltip: (p: Record<string, unknown>) =>
              React.createElement(
                'span',
                { title: typeof p['title'] === 'string' ? p['title'] : undefined },
                node(p['children']),
              ),
          };
        if (name === 'worksheet/components/Basics')
          return {
            VerticalMiddle: (p: Record<string, unknown>) =>
              React.createElement('div', { className: p['className'] }, node(p['children'])),
          };
        if (name === 'src/pages/widgetConfig/util') return widgetUtil;
        if (name === 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util') return custom;
        if (name === 'ming-ui/components/Menu') return { __esModule: true, default: menu };
        if (name === 'ming-ui/components/MenuItem') return { __esModule: true, default: item };
        if (name === '@rc-component/trigger') return { __esModule: true, default: trigger };
        if (name === './AddCondition') return { __esModule: true, default: add };
        if (name === './contents')
          return {
            __esModule: true,
            default: (key: unknown, props: Record<string, unknown>) =>
              React.createElement('div', {
                'data-editor': String(key),
                'data-dynamic': String(props['isDynamicsource']),
                'data-disabled': String(props['disabled']),
                'data-range': String(props['dateRange']),
                onChange: props['onChange'],
                control: props['control'],
                relationColumns: props['relationColumns'],
                currentColumns: props['currentColumns'],
                globalSheetControls: props['globalSheetControls'],
                relateSheetList: props['relateSheetList'],
                widgetControlData: props['widgetControlData'],
                values: props['values'],
              }),
          };
        if (name === '../enum' || name === './enum') return load(path.join(__dirname, 'enum.ts'));
        if (name === '../util' || name === './util') return util;
        if (name === './Condition') return load(path.join(__dirname, 'components/Condition.tsx'));
        if (name === './ConditionV2') return load(path.join(__dirname, 'components/ConditionV2.tsx'));
        if (name === './wrapDisableClick') return load(path.join(__dirname, 'components/wrapDisableClick.tsx'));
        if (name === '../conditionBoundary') return load(path.join(__dirname, 'conditionBoundary.ts'));
        if (name === './filterModelBoundary') return load(path.join(__dirname, 'filterModelBoundary.ts'));
        throw new Error('Unstubbed real dependency ' + name);
      },
      ...Object.values(globals),
      ...Object.values(extra),
    );
    return result.exports;
  }
  function load(filename: string): unknown {
    if (cache.has(filename)) return cache.get(filename);
    const historical =
      before &&
      beforeDirectory &&
      ['Condition', 'ConditionV2', 'ConditionsGroup', 'FilterItem'].includes(path.basename(filename, '.tsx'));
    const actual = historical ? path.join(beforeDirectory || '', path.basename(filename)) : filename;
    const exports = compile(fs.readFileSync(actual, 'utf8'), filename);
    cache.set(filename, exports);
    return exports;
  }
  const enums = load(path.join(__dirname, 'enum.ts'));
  const widget = compile(
    selectedSource('src/pages/widgetConfig/config/widget.ts', ['SYSTEM_DATE_CONTROL', 'WIDGETS_TO_API_TYPE_ENUM']),
    'widget.ts',
  );
  const utilNames = [
    'getTypeKey',
    'getConditionType',
    'getFilterTypes',
    'getConditionOverrideValue',
    'formatDateValue',
    'filterMoment',
    'checkConditionAvailable',
    'getDefaultFilterType',
    'getDefaultCondition',
  ];
  assert.ok(object(enums));
  assert.ok(object(widget));
  const util = compile(selectedSource(base + '/util.ts', utilNames), 'util.ts', {
    ...enums,
    ...widget,
    _: lodash,
    includes: lodash.includes,
    get: lodash.get,
    moment,
    filterConditionEvaluation: read(load(path.join(__dirname, 'filterModelBoundary.ts')), 'filterConditionEvaluation'),
  });
  const custom = compile(
    selectedSource('src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util.ts', ['isCustomOptions']),
    'custom.ts',
    { _: lodash },
  );
  // The fixture only replaces icon metadata; show-field filtering runs its actual implementation.
  const widgetUtil = compile(
    selectedSource('src/pages/widgetConfig/util/index.ts', ['filterOnlyShowField', 'isOtherShowFeild']),
    'widget-util.ts',
    { _: lodash },
  );
  assert.ok(object(widgetUtil));
  Reflect.set(widgetUtil, 'getIconByType', (type: unknown) => String(type));
  const classes = new Map<string, unknown>();
  for (const name of ['Condition', 'ConditionV2', 'FilterItem'])
    classes.set(name, read(load(path.join(__dirname, 'components/' + name + '.tsx')), 'default'));
  const group = read(load(path.join(__dirname, 'components/ConditionsGroup.tsx')), 'default');
  const ant: typeof import('antd') = require('antd');
  return {
    enums,
    boundary: load(path.join(__dirname, 'conditionBoundary.ts')),
    dropdown,
    select: ant.Select,
    add,
    input,
    condition: classes.get('ConditionV2'),
    focuses,
    creates(name, props) {
      const C = classes.get(name);
      if (typeof C !== 'function') throw new Error(name);
      return Reflect.construct(C, [props]);
    },
    groups(props) {
      if (typeof group !== 'function') throw new Error('Missing group');
      return Reflect.apply(group, undefined, [props]);
    },
    html(value) {
      const sheet = new sc.ServerStyleSheet();
      try {
        return { html: ReactDOM.renderToStaticMarkup(sheet.collectStyles(node(value))), css: sheet.getStyleTags() };
      } finally {
        sheet.seal();
      }
    },
  };
}
const current = fixture();
const before = beforeDirectory ? fixture(true) : undefined;
const observations: unknown[] = [];
function observe(label: string, action: (fixture: Fixture) => unknown): unknown {
  const after = action(current);
  if (before) assert.deepEqual(after, action(before), label);
  observations.push(label);
  return after;
}
const F = read(current.enums, 'FILTER_CONDITION_TYPE');
const changes: unknown[] = [];
const conditionProps = (type: number, from?: string | number): Record<string, unknown> => ({
  condition: {
    controlId: 'c',
    controlType: type,
    conditionGroupType: call(current.boundary, 'conditionGroupType', [{ type }]),
    type: read(F, 'EQ'),
    values: ['a'],
    value: '10',
    keyStr: 'k',
  },
  control: { controlId: 'c', type, controlName: 'Field', enumDefault: type === 29 ? 2 : 1, dataSource: 'options' },
  canEdit: true,
  index: 0,
  conditionsLength: 2,
  from,
  onChange: (value: unknown) => changes.push(value),
  onDelete: () => changes.push('delete'),
  onUpdateFilter: (value: unknown) => changes.push(value),
  conditionGroupType: call(current.boundary, 'conditionGroupType', [{ type }]),
});
for (const name of ['Condition', 'ConditionV2']) {
  for (const type of [2, 6, 9, 10, 11, 14, 15, 16, 19, 24, 26, 27, 28, 29, 35, 36, 46, 48]) {
    for (const from of [undefined, 'relateSheet', 'rule', 'subTotal', 'fastFilter', 0]) {
      for (const canEdit of [false, true]) {
        observe(name + ' render ' + [type, from, canEdit].join(':'), fixture => {
          const props = { ...conditionProps(type, from), canEdit };
          const value = fixture.creates(name, props);
          call(value, 'componentDidMount');
          return { ...fixture.html(call(value, 'render')), state: state(value) };
        });
      }
    }
  }
  for (const shape of [
    { control: undefined },
    { control: { type: 2 }, condition: { controlType: 2, type: 2 } },
    { index: 1, relationType: undefined, conditionsLength: undefined },
  ]) {
    observe(name + ' missing ' + JSON.stringify(shape), fixture =>
      fixture.html(call(fixture.creates(name, { ...conditionProps(2), ...shape }), 'render')),
    );
  }
  for (const next of [read(F, 'ISNULL'), read(F, 'HASVALUE'), read(F, 'BETWEEN'), undefined]) {
    observe(name + ' type ' + String(next), fixture => {
      const calls: unknown[] = [];
      const instance = fixture.creates(name, {
        ...conditionProps(6, 'relateSheet'),
        onChange: (v: unknown) => calls.push(v),
      });
      call(instance, 'changeConditionType', [next]);
      return { calls, state: state(instance) };
    });
  }
  for (const selected of [1, 2]) {
    observe(name + ' dynamic ' + selected, fixture => {
      const calls: unknown[] = [];
      const instance = fixture.creates(name, {
        ...conditionProps(2, 'relateSheet'),
        onChange: (v: unknown) => calls.push(v),
      });
      event(
        find(call(instance, 'render'), e => e.type === fixture.select),
        'onChange',
        [selected],
      );
      return { calls, state: state(instance) };
    });
  }
  observe(name + ' delete', fixture => {
    const calls: unknown[] = [];
    const instance = fixture.creates(name, { ...conditionProps(2), onDelete: () => calls.push('delete') });
    event(
      find(
        call(instance, 'render'),
        e => typeof e.props['className'] === 'string' && e.props['className'].startsWith('deleteBtn'),
      ),
      'onClick',
    );
    return calls;
  });
}
for (const type of [2, 15, 46]) {
  for (const valueType of [1, 2, undefined]) {
    observe('URL valueType ' + type + ':' + valueType, fixture => {
      const calls: unknown[] = [];
      const instance = fixture.creates('ConditionV2', {
        ...conditionProps(type),
        urlParams: ['q', 'date'],
        onChange: (v: unknown) => calls.push(v),
      });
      event(
        find(call(instance, 'renderControl'), e => e.type === fixture.dropdown),
        'onChange',
        [valueType],
      );
      return { calls, state: state(instance), html: fixture.html(call(instance, 'renderControl')) };
    });
  }
  for (const cid of ['', 'q', 'removed']) {
    observe('URL parameter ' + type + ':' + cid, fixture => {
      const calls: unknown[] = [];
      const props = conditionProps(type);
      const c = props['condition'];
      assert.ok(object(c));
      const instance = fixture.creates('ConditionV2', {
        ...props,
        condition: { ...c, dynamicSource: [{ rcid: 'url', cid, staticValue: '' }] },
        urlParams: ['q'],
        onChange: (v: unknown) => calls.push(v),
      });
      const rendered = call(instance, 'renderControl');
      const parameter = find(rendered, e => Array.isArray(e.props['data']) && e.props['renderTitle'] !== undefined);
      event(parameter, 'onChange', ['q']);
      return { calls, state: state(instance), html: fixture.html(rendered) };
    });
  }
}
observe('date retained range', fixture => {
  const calls: unknown[] = [];
  const props = conditionProps(15, 'relateSheet');
  const c = props['condition'];
  assert.ok(object(c));
  const instance = fixture.creates('ConditionV2', {
    ...props,
    condition: { ...c, minValue: '2024-01-01', maxValue: '2024-02-02' },
    onChange: (v: unknown) => calls.push(v),
  });
  call(instance, 'changeConditionType', [read(F, 'DATE_BETWEEN')]);
  assert.equal(read(calls[0], 'minValue'), '2024-01-01');
  assert.equal(read(calls[0], 'maxValue'), '2024-02-02');
  return calls;
});
for (const isSingleFilter of [true, false]) {
  for (const canEdit of [true, false]) {
    observe('group callbacks ' + isSingleFilter + ':' + canEdit, fixture => {
      const control = { type: 2, controlId: 'c', controlName: 'Field' };
      const conditions = [0, 1, 2].map(i => ({
        id: 'id' + i,
        controlId: 'c',
        controlType: 2,
        conditionGroupType: 1,
        type: 2,
        keyStr: 'k' + i,
      }));
      const calls: unknown[] = [];
      const value = fixture.groups({
        controls: [control],
        conditions,
        isSingleFilter,
        canEdit,
        conditionSpliceType: 1,
        isGroup: true,
        conditionsGroupsLength: 2,
        filterError: ['error-class', false, undefined],
        onAdd: (v: unknown) => calls.push(['add', v]),
        onChange: (v: unknown, index: unknown) => calls.push(['change', v, index]),
        onDelete: (i: unknown) => calls.push(['delete', i]),
        onUpdateGroup: (v: unknown) => calls.push(['group', v]),
        filterAddConditionControls: (controls: unknown) => controls,
      });
      const children = walk(value).filter(e => e.type === fixture.condition);
      assert.equal(children.length, 3);
      for (const child of children) {
        assert.equal(child.props['canEdit'], true, 'Original group child hardcodes canEdit before the final override');
        assert.notEqual(child.props['control'], control, 'Original cloned control identity remains');
        event(child, 'onChange', [{ value: 0 }]);
        event(child, 'onDelete');
      }
      event(
        find(value, e => e.type === fixture.dropdown),
        'onChange',
        [2],
      );
      event(
        find(value, e => e.type === fixture.add),
        'onAdd',
        [control],
      );
      return { calls, html: fixture.html(value) };
    });
  }
}
observe('group final props spread retains identity', fixture => {
  const override = () => undefined;
  const value = fixture.groups({
    conditions: [{ controlType: 2, controlId: 'c' }],
    controls: [{ type: 2, controlId: 'c' }],
    onChange: () => undefined,
    onDelete: () => undefined,
    onAdd: () => undefined,
    onUpdateGroup: () => undefined,
    conditionProps: { canEdit: false, onChange: override },
  });
  const child = find(value, e => e.type === fixture.condition);
  assert.equal(child.props['onChange'], override);
  assert.equal(child.props['canEdit'], false);
  return fixture.html(value);
});
const itemProps = (filterType: number, expanded: boolean, unsaved: boolean): Record<string, unknown> => ({
  filter: {
    id: 'f',
    name: 'Filter',
    type: filterType,
    createAccountId: 'mine',
    relationType: 1,
    conditions: [{ controlId: 'c', controlType: 2, conditionGroupType: 1, type: 2, values: ['text'], keyStr: 'k' }],
  },
  columns: [{ controlId: 'c', controlName: 'Field', type: 2 }],
  expanded,
  unsaved,
  isCharge: true,
  hideFilter: () => undefined,
  onExpand: () => undefined,
  onDelete: () => undefined,
  onCopy: () => undefined,
  onRename: () => undefined,
  onUpdateFilterType: () => undefined,
  onFilter: () => undefined,
  onSave: () => undefined,
  onSaveNew: () => undefined,
  onSaveAs: () => undefined,
  addCondition: () => undefined,
  updateCondition: () => undefined,
  deleteCondition: () => undefined,
  updateFilter: () => undefined,
});
for (const type of [1, 2, 3])
  for (const expanded of [false, true])
    for (const unsaved of [false, true]) {
      observe('FilterItem render ' + [type, expanded, unsaved].join(':'), fixture =>
        fixture.html(call(fixture.creates('FilterItem', itemProps(type, expanded, unsaved)), 'render')),
      );
    }
for (const label of ['保存', '保存为', '复制', '重命名', '设为公共筛选', '删除']) {
  observe('FilterItem menu ' + label, fixture => {
    const calls: unknown[] = [];
    const props = itemProps(1, true, label === '保存为');
    const filter = props['filter'];
    for (const key of ['onSave', 'onSaveAs', 'onCopy', 'onRename', 'onUpdateFilterType', 'onDelete'])
      props[key] = (v: unknown) => calls.push([key, v]);
    const instance = fixture.creates('FilterItem', props);
    const focus: unknown[] = [];
    assert.ok(object(instance));
    Reflect.set(instance, 'title', {
      querySelector: () => ({ select: () => focus.push('select'), focus: () => focus.push('focus') }),
    });
    const popup = find(call(instance, 'renderOperate', [1]), e => e.props['popup'] !== undefined).props['popup'];
    const child = walk(popup).find(
      e =>
        walk(e.props['children']).length > 0 &&
        Array.isArray(e.props['children']) &&
        e.props['children'].includes(label),
    );
    assert.ok(child, label);
    event(child, 'onClick');
    if (['保存', '保存为', '复制', '删除'].includes(label))
      assert.equal(read(calls[0], '1'), filter, 'Callbacks retain filter reference');
    return { calls, state: state(instance), focus };
  });
}
observe('FilterItem rename empty/equal/trimmed blur and enter', fixture => {
  const calls: unknown[] = [];
  const props = itemProps(1, true, false);
  props['onRename'] = (v: unknown) => calls.push(v);
  const instance = fixture.creates('FilterItem', props);
  call(instance, 'renameFilter', ['']);
  call(instance, 'renameFilter', ['Filter']);
  Reflect.set(state(instance), 'nameIsEditing', true);
  const input = find(call(instance, 'render'), e => e.type === fixture.input);
  event(input, 'onBlur', [{ currentTarget: { value: ' New ' } }]);
  event(input, 'onKeyDown', [{ keyCode: 13, currentTarget: { value: ' Another ' } }]);
  assert.deepEqual(calls, ['New', 'Another']);
  return { calls, state: state(instance) };
});
for (const menu of [false, true]) {
  observe('FilterItem title selection target ' + menu, fixture => {
    const calls: unknown[] = [];
    const props = itemProps(1, true, false);
    props['onFilter'] = () => calls.push('filter');
    props['hideFilter'] = () => calls.push('hide');
    props['onExpand'] = () => calls.push('expand');
    const instance = fixture.creates('FilterItem', props);
    const target = new FixtureElement();
    Reflect.set(target, 'menu', menu);
    const rendered = call(instance, 'render');
    event(
      find(rendered, e => typeof e.props['className'] === 'string' && e.props['className'].startsWith('filterItem ')),
      'onClick',
      [{ target }],
    );
    assert.deepEqual(calls, menu ? [] : ['filter', 'hide']);
    event(
      find(rendered, e => e.props['className'] === 'slideIcon'),
      'onClick',
      [{ stopPropagation: () => calls.push('stop') }],
    );
    return calls;
  });
}
observe('legacy relation selector clear emits explicit undefined', fixture => {
  const calls: unknown[] = [];
  const instance = fixture.creates('Condition', {
    ...conditionProps(2),
    onUpdateFilter: (v: unknown) => calls.push(v),
  });
  event(
    find(call(instance, 'renderOption'), e => e.type === fixture.dropdown),
    'onChange',
    [undefined],
  );
  assert.deepEqual(calls, [{ relationType: undefined }]);
  return calls;
});
observe('URL clear retains explicit undefined cid and date range', fixture => {
  const calls: unknown[] = [];
  const props = conditionProps(15);
  const c = props['condition'];
  assert.ok(object(c));
  const instance = fixture.creates('ConditionV2', {
    ...props,
    condition: { ...c, dynamicSource: [{ cid: 'q', rcid: 'url' }] },
    urlParams: ['q'],
    onChange: (v: unknown) => calls.push(v),
  });
  event(
    find(call(instance, 'renderControl'), e => e.props['renderTitle'] !== undefined),
    'onChange',
    [undefined],
  );
  assert.deepEqual(calls, [
    { dynamicSource: [{ cid: undefined, rcid: 'url', staticValue: '' }], isDynamicsource: true, dateRange: 0 },
  ]);
  return calls;
});
observe('condition editor forwards array and callback identity', fixture => {
  const props = conditionProps(2);
  const c = props['condition'];
  assert.ok(object(c));
  const onChange = () => undefined;
  const columns = [{ controlId: 'related', type: 2 }];
  const opaque = { sdk: ['unchanged'] };
  const instance = fixture.creates('ConditionV2', {
    ...props,
    onChange,
    columns,
    currentColumns: columns,
    globalSheetControls: columns,
    relateSheetList: opaque,
    widgetControlData: opaque,
  });
  const value = find(call(instance, 'renderControl'), e => e.props['data-editor'] !== undefined);
  assert.equal(value.props['data-dynamic'], String(state(instance)['isDynamicsource']));
  // The actual callee recording seam receives the original arrays/function.
  // Inspect its React element before ReactDOM executes that seam.
  const child = find(
    call(instance, 'renderControl'),
    e => typeof e.props['onChange'] === 'function' && e.props['control'] !== undefined,
  );
  assert.equal(child.props['onChange'], onChange);
  assert.equal(child.props['relationColumns'], columns);
  assert.equal(child.props['currentColumns'], columns);
  assert.equal(child.props['globalSheetControls'], columns);
  assert.equal(child.props['relateSheetList'], opaque);
  assert.equal(child.props['widgetControlData'], opaque);
  assert.equal(child.props['values'], c['values']);
  return fixture.html(call(instance, 'renderControl'));
});
const errors = ['invalid', false, null, undefined];
assert.equal(call(current.boundary, 'conditionErrorRows', [errors]), errors);
for (const invalid of [['bad', true], {}, [3]])
  assert.throws(() => call(current.boundary, 'conditionErrorRows', [invalid]), TypeError);
for (const invalid of ['1', {}, null, []])
  assert.throws(() => call(current.boundary, 'conditionNumber', [invalid]), TypeError);
for (const invalid of [2, {}, null, []])
  assert.throws(() => call(current.boundary, 'conditionParameter', [invalid]), TypeError);
assert.equal(call(current.boundary, 'conditionNumber', [NaN]), NaN);
assert.equal(call(current.boundary, 'conditionParameter', [undefined]), undefined);
assert.equal(call(current.boundary, 'conditionKey', ['key']), 'key');
assert.throws(() => call(current.boundary, 'conditionGroupType', [{ type: -1 }]), TypeError);
assert.equal(call(current.boundary, 'conditionGroupType', [undefined]), '');
console.log(
  JSON.stringify({ actualComponentObservations: observations.length, historicalAB: Boolean(before), components: 4 }),
);
