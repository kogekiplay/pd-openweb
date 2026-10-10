import type { ReactElement, ReactNode } from 'react';
import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const sc: typeof import('styled-components/dist/index') = require('styled-components');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const root = path.resolve(__dirname, '../../../../../..');
const directory = 'src/pages/worksheet/common/WorkSheetFilter';
const beforeRevision = process.env['FILTER_PANELS_BEFORE_REV'];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid panel fixture object');
  return Reflect.get(value, key);
}
function invoke(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Invalid panel fixture method ' + key);
  return Reflect.apply(fn, value, args);
}
function record(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new TypeError('Missing actual object');
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Missing actual array');
  return value;
}
function rendered(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value;
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map(rendered);
  throw new TypeError('Invalid actual React output');
}
function walk(value: unknown): Array<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...walk(value.props['children'])];
}
function shell(name: string) {
  return (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-fixture': name }, rendered(props['children']));
}
const Detail = shell('FilterDetail'),
  Condition = shell('Condition'),
  Add = shell('AddCondition');
const translated = (text: string) => text;
Object.assign(globalThis, {
  _l: translated,
  md: { global: { Account: { accountId: 'internal', isPortal: false } } },
  window: { md: { global: { Account: { isPortal: false } } } },
  safeParse: (value: unknown) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return {};
    }
  },
});

interface Effect {
  deps: unknown[];
  run: () => void;
}
class Hooks {
  state: unknown;
  dirty = false;
  effectIndex = 0;
  effects: Effect[] = [];
  pending: Array<() => void> = [];
  component: unknown;
  props: Record<string, unknown>;
  tree: unknown;
  dispatch: (action: unknown) => void = () => {
    throw new Error('Reducer is not mounted');
  };
  constructor(component: unknown, props: Record<string, unknown>) {
    this.component = component;
    this.props = props;
  }
  render() {
    active = this;
    this.dirty = false;
    this.effectIndex = 0;
    if (typeof this.component !== 'function') throw new TypeError('Missing actual hook component');
    this.tree = Reflect.apply(this.component, undefined, [this.props]);
    this.pending.splice(0).forEach(fn => fn());
  }
  flush() {
    for (let i = 0; this.dirty; i++) {
      assert.ok(i < 20, 'Panel effects must settle');
      this.render();
    }
  }
}
let active: Hooks;
const hookReact = {
  ...React,
  useReducer(reducer: (state: unknown, action: unknown) => unknown, initial: unknown) {
    const host = active;
    if (host.state === undefined) host.state = initial;
    host.dispatch = action => {
      const next = reducer(host.state, action);
      if (next !== host.state) {
        host.state = next;
        host.dirty = true;
      }
    };
    return [host.state, host.dispatch];
  },
  useEffect(run: () => void, deps: unknown[]) {
    const host = active,
      index = host.effectIndex++,
      previous = host.effects[index];
    if (previous && deps.length === previous.deps.length && deps.every((d, i) => Object.is(d, previous.deps[i])))
      return;
    host.effects[index] = { run, deps };
    host.pending.push(run);
  },
};
function fixture(before = false) {
  const cache = new Map<string, unknown>();
  // Stabilize the installed library's process-wide component counter across A/B loads.
  const styled = { div: sc.default.div.withConfig({ componentId: 'filter-panel-common' }) };
  function source(file: string) {
    return before && beforeRevision
      ? execFileSync('git', ['show', beforeRevision + ':' + file], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, file), 'utf8');
  }
  function evaluate(file: string, text: string): unknown {
    const result: { exports: unknown } = { exports: {} };
    const compiled = harness.transformSync(text, {
      filename: path.join(root, file),
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
      comments: false,
    });
    if (!compiled?.code) throw new TypeError('Missing real production Babel output');
    new Function('module', 'exports', 'require', compiled.code)(result, result.exports, (name: string): unknown => {
      if (name === 'react') return hookReact;
      if (name === 'react/jsx-runtime') return require(name);
      if (
        ['lodash', 'moment', 'immutability-helper', 'prop-types', 'classnames', 'react-redux'].includes(name) ||
        name.startsWith('@babel/runtime/')
      )
        return require(name);
      if (name === 'styled-components' || name === 'src/utils/typedStyled')
        return { __esModule: true, default: styled };
      if (name === '../components/FilterDetail') return { __esModule: true, default: Detail };
      if (name === '../components/Condition') return { __esModule: true, default: Condition };
      if (name === '../components/AddCondition') return { __esModule: true, default: Add };
      if (name === 'worksheet/constants/enum')
        return subset('src/pages/worksheet/constants/enum.ts', ['SYSTEM_CONTROLS']);
      if (name === 'src/pages/widgetConfig/config/widget')
        return subset('src/pages/widgetConfig/config/widget.ts', [
          'WIDGETS_TO_API_TYPE_ENUM',
          'ROW_ID_CONTROL',
          'SYSTEM_DATE_CONTROL',
          'WORKFLOW_SYSTEM_CONTROL',
        ]);
      if (name === 'src/pages/widgetConfig/util')
        return subset('src/pages/widgetConfig/util/index.ts', ['filterOnlyShowField', 'isOtherShowFeild']);
      if (name === 'src/pages/FormSet/config.js') return { permitList: { sysControlSwitch: 40 } };
      if (name === 'src/pages/FormSet/util.js')
        return {
          isOpenPermit: (_type: number, permits: unknown) =>
            Array.isArray(permits) && permits.some(p => read(p, 'state') === true),
        };
      if (name === 'src/api/worksheet')
        return {
          __esModule: true,
          default: new Proxy(
            {},
            {
              get() {
                return () => {
                  throw new Error('This panel scenario must not mutate backend');
                };
              },
            },
          ),
        };
      if (name === 'src/pages/widgetConfig/util/setting.js')
        return { getDatePickerConfigs: () => ({ formatMode: 'YYYY-MM-DD' }) };
      if (name === 'src/utils/common') return { browserIsMobile: () => false };
      if (name === 'src/utils/control') return { isRelateRecordTableControl: () => false };
      if (name === 'src/utils/project') return { dateServerZoneToAppZone: (value: unknown) => value };
      if (name === 'src/utils/subListStoreTypes') return { isRelateRecordTableStore: () => false };
      if (name.startsWith('.'))
        return load(path.relative(root, path.resolve(path.dirname(path.join(root, file)), name)));
      throw new Error('Unexpected actual panel dependency ' + name);
    });
    return result.exports;
  }
  function subset(file: string, names: string[]): unknown {
    const key = file + ':' + names.join(',');
    if (cache.has(key)) return cache.get(key);
    const text = source(file),
      ast = parser.parse(text, { sourceType: 'module', plugins: ['typescript'] });
    const declarations = ast.program.body.filter(
      item =>
        item.type === 'ExportNamedDeclaration' &&
        item.declaration?.type === 'VariableDeclaration' &&
        item.declaration.declarations.some(d => d.id.type === 'Identifier' && names.includes(d.id.name)),
    );
    assert.equal(declarations.length, names.length, 'Actual dependency declarations must exist');
    const selected = declarations
      .map(d => {
        if (d.start === null || d.start === undefined || d.end === null || d.end === undefined)
          throw new Error('Missing AST offsets');
        return text.slice(d.start, d.end);
      })
      .join('\n');
    const result = evaluate(file, selected);
    cache.set(key, result);
    return result;
  }
  function load(file: string): unknown {
    file = harness.resolveSpecTarget(path.join(root, file));
    file = path.relative(root, file);
    if (cache.has(file)) return cache.get(file);
    const result = evaluate(file, source(file));
    cache.set(file, result);
    return result;
  }
  const single = read(load(directory + '/common/SingleFilter.tsx'), 'default');
  const config = read(load(directory + '/common/FilterConfig.tsx'), 'default');
  function create(props: Record<string, unknown>): unknown {
    if (typeof single !== 'function') throw new TypeError('Missing real class');
    const instance: unknown = Reflect.construct(single, [props]);
    record(instance)['setState'] = (update: unknown) => {
      const state = record(read(instance, 'state'));
      Object.assign(state, record(update));
    };
    return instance;
  }
  return { create, config, load };
}
function find(tree: unknown, type: unknown) {
  const element = walk(tree).find(item => item.type === type);
  assert.ok(element, 'Missing actual child');
  return element.props;
}
function exercise(before = false) {
  const f = fixture(before),
    observations: unknown[] = [];
  const oldRandom = Math.random;
  Math.random = () => 0.25;
  try {
    for (const from of ['', 'rule', 'relateSheet', 'subTotal', 'custombutton']) {
      for (const controlType of [2, 6, 9, 15, 26, 36]) {
        const calls: unknown[] = [];
        const control = {
          controlId: 'field',
          controlName: '字段',
          type: controlType,
          row: 0,
          col: 0,
          options: [{ key: 'a', value: 'A' }],
        };
        const instance = f.create({
          from,
          canEdit: true,
          columns: [control],
          conditions: [],
          onConditionsChange: (items: unknown) => calls.push(items),
        });
        invoke(instance, 'addCondition', [control]);
        const conditions = array(read(read(instance, 'state'), 'conditions'));
        assert.equal(read(conditions[0], 'control'), control, 'Actual producer preserves source control ref');
        const tree = invoke(instance, 'render');
        const child = find(tree, Condition);
        invoke(child, 'onChange', [{ values: ['a'], value: '3', minValue: '1', maxValue: '5' }]);
        invoke(child, 'onUpdateFilter', [{ relationType: 2 }]);
        invoke(instance, 'deleteCondition', [0]);
        observations.push({
          from,
          controlType,
          calls,
          html: renderToStaticMarkup(rendered(tree)),
          state: read(instance, 'state'),
        });
      }
    }
    const callback: unknown[] = [];
    const host = new Hooks(f.config, {
      from: 'apiV2',
      canEdit: true,
      conditions: [],
      columns: [{ controlId: 'wf', type: 2, controlPermissions: '111' }],
      onConditionsChange: (value: unknown) => callback.push(value),
    });
    host.render();
    const actions = read(find(host.tree, Detail), 'actions');
    invoke(actions, 'editFilter', [
      { id: 'new-test', isGroup: true, conditionsGroups: [{ spliceType: 1, conditionSpliceType: 1, conditions: [] }] },
    ]);
    host.flush();
    // Start from a real reducer-owned condition before applying its update.
    invoke(actions, 'editFilter', [
      {
        id: 'new-test',
        isGroup: true,
        conditionsGroups: [
          {
            spliceType: 1,
            conditionSpliceType: 1,
            conditions: [{ controlId: 'x', controlType: 2, type: 1, values: ['first'] }],
          },
        ],
      },
    ]);
    host.flush();
    invoke(actions, 'updateCondition', [{ values: ['hello'] }, 0, 0]);
    host.flush();
    assert.equal(callback.length, 1);
    assert.equal(read(array(read(array(callback[0])[0], 'groupFilters'))[0], 'values') instanceof Array, true);
    invoke(actions, 'deleteCondition', [0, 0]);
    host.flush();
    assert.equal(callback.length, 2);
    observations.push({ hookCallbacks: callback, html: renderToStaticMarkup(rendered(host.tree)) });
    return observations;
  } finally {
    Math.random = oldRandom;
  }
}
const current = exercise();
if (beforeRevision)
  assert.deepEqual(
    current,
    exercise(true),
    'Actual panel constructor/events/reducer/effects/output must match old normal behavior',
  );
const fixtureCurrent = fixture(),
  invalid = fixtureCurrent.create({ conditions: [], onConditionsChange: () => {} });
assert.throws(() => invoke(invalid, 'relationTypeUpdate', [{ relationType: 'and' }]), TypeError);
assert.throws(
  () => invoke(fixtureCurrent.load(directory + '/filterModelBoundary'), 'filterConditionPatch', [{ values: 'bad' }]),
  TypeError,
);
console.log(
  `WorkSheetFilter panels: ${current.length} actual component/reducer scenarios passed${beforeRevision ? ' with historical production Babel A/B' : ''}`,
);
