import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../../');
function object(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: PropertyKey): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture receiver');
  return value[key];
}
function call(value: unknown, key: PropertyKey, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Invalid fixture callable');
  return Reflect.apply(fn, value, args);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid fixture array');
  return value;
}
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function walk(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!object(value) || !object(value['props'])) return [];
  const node = { type: value['type'], props: value['props'] };
  return [node, ...walk(node.props['children'])];
}
interface Effect {
  deps: unknown[];
  cleanup?: (() => void) | undefined;
}
class Hooks {
  values: unknown[] = [];
  effects = new Map<number, Effect>();
  pending: Array<() => void> = [];
  cursor = 0;
  dirty = false;
  tree: unknown;
  readonly component: (props: Record<string, unknown>) => unknown;
  readonly props: Record<string, unknown>;
  constructor(component: (props: Record<string, unknown>) => unknown, props: Record<string, unknown>) {
    this.component = component;
    this.props = props;
  }
  render() {
    current = this;
    this.cursor = 0;
    this.dirty = false;
    this.tree = this.component(this.props);
    this.pending.splice(0).forEach(fn => fn());
    return this.tree;
  }
  flush() {
    for (let n = 0; this.dirty; n++) {
      assert.ok(n < 20, 'Hook effects must settle');
      this.render();
    }
    return this.tree;
  }
  unmount() {
    this.effects.forEach(effect => effect.cleanup?.());
  }
}
let current: Hooks;
const react = {
  Fragment: 'Fragment',
  useState(initial: unknown) {
    const host = current,
      index = host.cursor++;
    if (!(index in host.values)) host.values[index] = initial;
    return [
      host.values[index],
      (value: unknown) => {
        const next = typeof value === 'function' ? Reflect.apply(value, undefined, [host.values[index]]) : value;
        if (Object.is(host.values[index], next)) return;
        host.values[index] = next;
        host.dirty = true;
      },
    ];
  },
  useEffect(fn: () => unknown, deps: unknown[]) {
    const host = current,
      index = host.cursor++,
      old = host.effects.get(index);
    if (old && deps.every((value, i) => Object.is(value, old.deps[i]))) return;
    host.pending.push(() => {
      old?.cleanup?.();
      const cleanup = fn();
      host.effects.set(index, {
        deps,
        cleanup: typeof cleanup === 'function' ? () => Reflect.apply(cleanup, undefined, []) : undefined,
      });
    });
  },
};
const parses: unknown[] = [];
function parse(value: unknown): unknown {
  parses.push(value);
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}
Object.assign(globalThis, { _l: (text: string) => text, safeParse: parse });
const cache = new Map<string, unknown>();
const producerDirectory = 'src/pages/worksheet/common/WorkSheetFilter';
function load(relative: string): unknown {
  const file = harness.resolveSpecTarget(path.resolve(root, relative));
  if (cache.has(file)) return cache.get(file);
  const module: { exports: unknown } = { exports: {} };
  const transformed = harness.transformFileSync(file);
  if (!transformed?.code) throw new TypeError('Missing fixture source');
  new Function('module', 'exports', 'require', transformed.code)(module, module.exports, (name: string): unknown => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime')
      return {
        jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
        jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
      };
    if (['lodash', 'moment', 'immutability-helper'].includes(name) || name.startsWith('@babel/runtime/'))
      return require(name);
    if (name === 'antd') return { Select: Object.assign(() => null, { Option: 'SelectOption' }) };
    if (name === '@mingdaocom/json-view') return { __esModule: true, default: 'JsonView' };
    if (name === 'ming-ui') return { Dialog: 'Dialog', Icon: 'Icon' };
    if (name.startsWith('ming-ui/components/')) return { __esModule: true, default: name.split('/').at(-1) };
    if (name === 'styled-components' || name === 'src/utils/typedStyled')
      return { __esModule: true, default: { div: () => 'Wrapper' } };
    if (name === 'worksheet/common/WorkSheetFilter/common/FilterConfig')
      return { __esModule: true, default: 'FilterConfig' };
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), name)));
    if (file.includes(producerDirectory) && name.startsWith('src/')) return {};
    throw new Error('Unexpected filter fixture dependency ' + name);
  });
  cache.set(file, module.exports);
  return module.exports;
}
function node(host: Hooks, type: unknown): Tree {
  const found = walk(host.tree).find(item => item.type === type);
  assert.ok(found, String(type));
  return found;
}
const source = load('src/pages/worksheetApi/components/FiltersGenerate/index.tsx');
const utils = load('src/pages/worksheetApi/core/utils.ts');
const boundary = load('src/pages/worksheetApi/core/filterBoundary.ts');
const model = load(producerDirectory + '/model.ts');
function host(props: Record<string, unknown> = {}): Hooks {
  const fn = read(source, 'default');
  if (typeof fn !== 'function') throw new TypeError('Missing actual component');
  const instance = new Hooks(props => Reflect.apply(fn, undefined, [props]), props);
  instance.render();
  const opener = walk(instance.tree).find(item => item.props['className'] === 'filterBtn Hand textSecondary');
  assert.ok(opener);
  call(opener.props, 'onClick');
  instance.flush();
  return instance;
}
function change(host: Hooks, payload?: unknown) {
  call(node(host, 'FilterConfig').props, 'onConditionsChange', payload === undefined ? [] : [payload]);
  host.flush();
}
function version(host: Hooks, value: 'apiV2' | 'apiV3') {
  const select = walk(host.tree).find(item => item.props['value'] === 'apiV2' || item.props['value'] === 'apiV3');
  assert.ok(select);
  call(select.props, 'onChange', [value]);
  host.flush();
}
function result(host: Hooks): unknown {
  return node(host, 'JsonView').props['data'];
}
function producer(conditions: unknown[], grouped = false): unknown {
  return call(model, 'formatForSave', [
    { isGroup: grouped, conditionsGroups: [{ spliceType: 2, conditionSpliceType: 1, conditions }] },
    { noCheck: true, returnFullValues: true },
  ]);
}
const columns = [{ controlId: 'text', type: 2 }];
const permits = [{ type: 2, state: true, viewIds: [] }];
const h = host({ controls: columns, sheetSwitchPermit: permits, projectId: 'project', appId: 'app' });
assert.equal(node(h, 'FilterConfig').props['columns'], columns);
assert.equal(node(h, 'FilterConfig').props['sheetSwitchPermit'], permits);
const rawValues = ['{"id":"row","name":"Title"}'];
const emitted = producer([
  { controlId: 'relation', controlType: 29, type: 24, values: ['row'], fullValues: rawValues },
]);
assert.equal(read(array(emitted)[0], 'values'), rawValues);
change(h, emitted);
const v2 = array(result(h));
assert.deepEqual(read(v2[0], 'values'), ['row']);
assert.equal(node(h, 'FilterConfig').props['conditions'], result(h), 'Inverse editor receives the same state array');
assert.equal(read(array(emitted)[0], 'values'), rawValues, 'Producer source was not mutated');
version(h, 'apiV3');
assert.deepEqual(
  read(array(read(result(h), 'children'))[0], 'value'),
  [],
  'Version switching preserves the old normalized-state behavior',
);
change(h, emitted);
assert.deepEqual(read(array(read(result(h), 'children'))[0], 'value'), ['row']);
const range = producer([{ controlId: 'number', controlType: 6, type: 11, minValue: 0, maxValue: '2.50', value: 0 }]);
change(h, range);
assert.deepEqual(read(array(read(result(h), 'children'))[0], 'value'), [0, '2.50']);
const clearedDateRange = producer([{ controlId: 'date', controlType: 15, type: 31, minValue: null, maxValue: null }]);
change(h, clearedDateRange);
assert.deepEqual(read(array(read(result(h), 'children'))[0], 'value'), [null, null]);
const grouped = producer([{ controlId: 'rating', controlType: 28, type: 2, values: ['5'] }], true);
change(h, grouped);
const child = array(read(result(h), 'children'))[0];
assert.equal(read(child, 'logic'), 'AND');
assert.deepEqual(read(array(read(child, 'children'))[0], 'value'), ['5']);
assert.equal(read(array(read(child, 'children'))[0], 'operator'), 'eq');
const prior = result(h),
  priorConditions = node(h, 'FilterConfig').props['conditions'];
for (const malformed of [
  null,
  {},
  [null],
  [{ dataType: '29' }],
  [{ controlId: 2 }],
  [{ values: {} }],
  [{ value: {} }],
  [{ minValue: [] }],
  [{ isGroup: 'true' }],
  [{ isGroup: true, groupFilters: [null] }],
]) {
  change(h, malformed);
  assert.equal(result(h), prior);
  assert.equal(node(h, 'FilterConfig').props['conditions'], priorConditions);
  const errorNode = walk(h.tree).find(item => item.props['role'] === 'alert');
  assert.ok(errorNode);
  assert.equal(errorNode.props['children'], '筛选条件格式错误，请检查后重试');
}
change(h, grouped);
assert.equal(
  walk(h.tree).some(item => item.props['role'] === 'alert'),
  false,
  'A real subsequent editor event recovers',
);
const beforeNullParse = result(h);
change(h, [{ controlId: 'member', dataType: 26, filterType: 2, values: ['null'] }]);
const parsedError = walk(h.tree).find(item => item.props['role'] === 'alert');
assert.ok(parsedError);
assert.equal(parsedError.props['children'], '筛选条件格式错误，请检查后重试');
assert.equal(result(h), beforeNullParse, 'A formatter failure cannot publish empty success');
version(h, 'apiV2');
assert.equal(
  walk(h.tree).some(item => item.props['role'] === 'alert'),
  false,
);
version(h, 'apiV3');
assert.ok(walk(h.tree).some(item => item.props['role'] === 'alert'));
change(h, [{ isGroup: true, groupFilters: [] }]);
assert.deepEqual(result(h), {});
assert.deepEqual(node(h, 'FilterConfig').props['conditions'], []);
change(h);
assert.deepEqual(result(h), {});
version(h, 'apiV2');
change(h, [{ isGroup: true }]);
assert.deepEqual(result(h), []);
const nested = [
  {
    isGroup: true,
    spliceType: 2,
    groupFilters: [
      {
        isGroup: true,
        spliceType: 1,
        groupFilters: [{ controlId: 'leaf', spliceType: 2, filterType: 6, values: ['x'] }],
      },
    ],
  },
];
assert.equal(call(boundary, 'filterItems', [nested]), nested);
assert.equal(read(array(read(call(utils, 'formatFilters', [nested]), 'children'))[0], 'type'), 'group');
const opaque = { unused: () => 'same reference' },
  values = ['a', 'b'];
const input = [{ controlId: 'text', dataType: 2, filterType: 2, values, opaque }];
change(h, input);
assert.equal(read(array(result(h))[0], 'values'), values);
assert.equal(read(array(result(h))[0], 'opaque'), opaque);
const undefinedOwn = { controlId: 'text', dataType: 2, values, value: undefined, opaque };
change(h, [undefinedOwn]);
const stripped = array(result(h))[0];
assert.ok(object(stripped));
assert.equal(Object.hasOwn(stripped, 'value'), false);
assert.equal(Object.hasOwn(undefinedOwn, 'value'), true);
const sparse: unknown[] = [];
sparse.length = 1;
const cycle: { isGroup: boolean; groupFilters: unknown[] } = { isGroup: true, groupFilters: [] };
cycle.groupFilters.push(cycle);
assert.throws(() => call(boundary, 'filterItems', [sparse]), TypeError);
assert.throws(() => call(boundary, 'filterItems', [[cycle]]), TypeError);
assert.deepEqual(call(utils, 'formatFilters', [[]]), {});
assert.deepEqual(call(utils, 'formatFilters', [null]), {});
assert.equal(call(utils, 'convertControl', [29]), 'Relation');
assert.equal(call(utils, 'convertControl', ['29']), 'CustomField');
assert.equal(call(utils, 'convertControl', [null]), 'CustomField');
const rawObject = { id: false, extra: opaque };
assert.deepEqual(call(source, 'normalizeValues', [[rawObject, 'null', '0', '{bad', '{"id":0}', '{"id":false}']]), [
  false,
  'null',
  '0',
  '{bad',
  0,
  false,
]);
const originalParsedId = Object.getOwnPropertyDescriptor(Number.prototype, 'id');
try {
  Object.defineProperty(Number.prototype, 'id', {
    configurable: true,
    get() {
      return 'boxed-number';
    },
  });
  assert.deepEqual(call(source, 'normalizeValues', [['12']]), ['boxed-number']);
  const formatted = call(utils, 'formatFilters', [[{ dataType: 26, filterType: 2, values: ['12'] }]]);
  assert.deepEqual(read(array(read(formatted, 'children'))[0], 'value'), ['boxed-number']);
} finally {
  if (originalParsedId) Object.defineProperty(Number.prototype, 'id', originalParsedId);
  else Reflect.deleteProperty(Number.prototype, 'id');
}
call(node(h, 'Dialog').props, 'onCancel');
h.flush();
assert.equal(
  walk(h.tree).some(item => item.type === 'Dialog'),
  false,
);
h.unmount();
const independent = host();
assert.deepEqual(result(independent), []);
independent.unmount();
console.log(
  'Actual FilterConfig producer → hook/event → API2/API3 JSON, recursive groups, identities, invalid/recovery and coercion passed',
);
