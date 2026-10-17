/** Actual complete dropdown modules, actual safeParse and exact getShowViews declaration; UI/hook host isolated. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict'),
  parser = require('@babel/parser');
const { ROOT, transformSync } = require('../spec-harness.ts'),
  React = require('react');
const BASE = '201bf01d9509949bc770121cb27f4578a2d23483',
  BUTTON = 'src/pages/FormSet/components/BtnRangeDrop.tsx',
  PRINT = 'src/pages/FormSet/components/RangeDrop.tsx',
  UTIL = 'src/pages/worksheet/views/util.ts';
const PARENT = 'src/pages/FormSet/containers/Print/PrintSortableItem.tsx';
const SHAS = {
  [BUTTON]: '112ff2a01b072a3ca59b151fe0d038a7ba1b5252dc917fd612929b140b0920e4',
  [PRINT]: '35b3c097ee853f0c83a927ccd0efe9564ed62faa614e40ea8842964c9ed89cc7',
  [UTIL]: '522373438524aa3d301025c9dac99e38a848c31ce2d16a47679042efceda72cf',
  [PARENT]: '4bd9e7486012bf6b75a6f9381976795aa981d032719a8928a7e211225d859087',
};
function historical(rel) {
  const s = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(s).digest('hex'), SHAS[rel]);
  return s;
}
const oldButton = historical(BUTTON),
  button = fs.readFileSync(path.join(ROOT, BUTTON), 'utf8'),
  oldPrint = historical(PRINT),
  print = fs.readFileSync(path.join(ROOT, PRINT), 'utf8'),
  oldParent = historical(PARENT);
const compile = (source, rel = BUTTON) =>
  transformSync(source, { filename: path.join(ROOT, rel), comments: false, compact: true }).code;
const parse = source => parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
function declaration(source, name) {
  const n = parse(source).program.body.find(item => {
    const d = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    return d && (d.id?.name === name || d.declarations?.some(x => x.id.name === name));
  });
  assert.ok(n, name);
  return source.slice(n.start, n.end).replace(/^export /, '');
}
const global = fs.readFileSync(path.join(ROOT, 'src/common/global.ts'), 'utf8'),
  safeNode = parse(global).program.body.find(
    n => n.expression?.left?.object?.name === 'window' && n.expression.left.property?.name === 'safeParse',
  );
assert.ok(safeNode);
const safeHost: { safeParse?: (value: unknown, fallback?: string) => unknown } = {};
const parseErrors = [];
new Function('window', 'console', compile(global.slice(safeNode.start, safeNode.end), 'src/common/global.ts'))(
  safeHost,
  { error: e => parseErrors.push(e.message) },
);
const safeParse = safeHost.safeParse;
function helper(source) {
  return new Function(compile(declaration(source, 'getShowViews'), UTIL) + ';return getShowViews;')();
}
const oldHelper = helper(historical(UTIL)),
  getShowViews = helper(fs.readFileSync(path.join(ROOT, UTIL), 'utf8'));
const valuesModule: { exports: Record<string, any> } = { exports: {} };
new Function(
  'module',
  'exports',
  compile(
    fs.readFileSync(path.join(ROOT, 'src/pages/FormSet/components/rangeValues.ts'), 'utf8'),
    'src/pages/FormSet/components/rangeValues.ts',
  ),
)(valuesModule, valuesModule.exports);
const leaves = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const f = () => null;
    f.displayName = name;
    leaves.set(name, f);
  }
  return leaves.get(name);
}
const factories = new Map();
function factory(source, rel) {
  const key = rel + source;
  if (!factories.has(key))
    factories.set(key, new Function('module', 'exports', 'require', 'safeParse', '_l', compile(source, rel)));
  return factories.get(key);
}
function buttonRenderer(source, provided = {}, customParse = safeParse) {
  const deps = [],
    memo = [];
  let cursor = 0;
  const events = [];
  let nextStyle = 0;
  const mod: { exports: Record<string, any> } = { exports: {} };
  factory(source, BUTTON)(
    mod,
    mod.exports,
    name => {
      if (name === 'react')
        return {
          useMemo: (fn, dependencies) => {
            const i = cursor++;
            if (!deps[i] || dependencies.some((x, j) => !Object.is(x, deps[i][j]))) {
              deps[i] = dependencies;
              memo[i] = fn();
            }
            return memo[i];
          },
        };
      if (name === 'react/jsx-runtime' || name === 'lodash') return require(name);
      if (name === 'styled-components')
        return { __esModule: true, default: { div: () => leaf(`button-style-${nextStyle++}`) } };
      if (name === 'ming-ui') return Object.fromEntries(['Checkbox', 'Icon', 'Radio'].map(k => [k, leaf(k)]));
      if (name === 'src/pages/worksheet/views/util')
        return { getShowViews: source === oldButton ? oldHelper : getShowViews };
      if (name === './rangeValues') return valuesModule.exports;
      throw Error('Unexpected dropdown dependency ' + name);
    },
    customParse,
    s => s,
  );
  let props = {
    onClose: () => events.push(['close']),
    onChange: value => events.push(['change', value]),
    views: views(),
    data: {
      btnId: 'btn',
      isAllView: 0,
      writeObject: 1,
      writeType: 1,
      clickType: 1,
      advancedSetting: { detailviews: '["v1"]', listviews: '[]', keep: 'metadata' },
    },
    ...provided,
  };
  return {
    render: () => {
      cursor = 0;
      return mod.exports.default(props);
    },
    events,
    props,
    setProps: patch => {
      props = { ...props, ...patch };
    },
  };
}
function printInstance(source, provided = {}) {
  let nextStyle = 0;
  const events = [];
  const mod: { exports: Record<string, any> } = { exports: {} };
  factory(source, PRINT)(
    mod,
    mod.exports,
    name => {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === 'styled-components')
        return { __esModule: true, default: { div: () => leaf(`print-style-${nextStyle++}`) } };
      if (name === 'ming-ui') return Object.fromEntries(['Checkbox', 'Icon', 'Radio'].map(k => [k, leaf(k)]));
      if (name === 'ming-ui/components/ClickAway') return { wrap: C => C };
      throw Error('Unexpected print dropdown dependency ' + name);
    },
    safeParse,
    s => s,
  );
  const available = views();
  const props = {
    className: 'range',
    printData: { id: 'print', name: 'Template', range: 3, views: [available[0]] },
    views: available,
    setData: value => events.push(['set', value]),
    onClose: () => events.push(['close']),
    ...provided,
  };
  return { instance: new mod.exports.default(props), events, props };
}
function views() {
  return [
    { viewId: 'v1', worksheetId: 'sheet', viewType: 0, name: 'Table' },
    { viewId: 'tree', worksheetId: 'sheet', viewType: 2, name: 'Tree', advancedSetting: { hierarchyViewType: '3' } },
    {
      viewId: 'org',
      worksheetId: 'sheet',
      viewType: 2,
      name: 'Hierarchy',
      advancedSetting: { hierarchyViewType: '1' },
    },
    { viewId: 'v2', worksheetId: 'sheet', viewType: 1, name: 'Board' },
    { viewId: 'system', worksheetId: 'system', viewType: 0, name: 'System' },
    { viewId: undefined, worksheetId: 'sheet', viewType: 0, name: 'Missing' },
  ];
}
function nodes(value, name) {
  if (Array.isArray(value)) return value.flatMap(x => nodes(x, name));
  if (!React.isValidElement(value)) return [];
  const label = typeof value.type === 'string' ? value.type : value.type.displayName;
  return (label === name ? [value] : []).concat(...Object.values(value.props).map(x => nodes(x, name)));
}
function tree(value) {
  if (typeof value === 'function') return '[callback]';
  if (Array.isArray(value)) return value.map(tree);
  if (React.isValidElement(value))
    return {
      type:
        typeof value.type === 'string'
          ? value.type
          : value.type === React.Fragment
            ? 'Fragment'
            : value.type.displayName,
      key: value.key,
      props: tree(value.props),
    };
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Reflect.ownKeys(value)
        .filter(k => Object.prototype.propertyIsEnumerable.call(value, k))
        .map(k => [k, tree(value[k])]),
    );
  return value;
}
function outcome(fn) {
  try {
    return { value: fn() };
  } catch (e) {
    return { error: [e.name, e.message] };
  }
}
module.exports = {
  ROOT,
  BASE,
  BUTTON,
  PRINT,
  UTIL,
  PARENT,
  oldParent,
  oldButton,
  button,
  oldPrint,
  print,
  compile,
  parse,
  declaration,
  oldHelper,
  getShowViews,
  safeParse,
  parseErrors,
  values: valuesModule.exports,
  buttonRenderer,
  printInstance,
  views,
  nodes,
  tree,
  outcome,
};
