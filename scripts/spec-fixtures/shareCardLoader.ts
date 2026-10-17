/** Complete real share-card modules and actual type-2 dynamic helpers; controlled hooks/leaves/network only. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const parser = require('@babel/parser');
const { ROOT, transformSync } = require('../spec-harness.ts');
const React = require('react');
const lodash = require('lodash');
const BASE = '2dbd49a058a2ab0d4a06215b3167792b0a73f18e';
const REL = 'src/pages/FormSet/containers/Share/ShareCardSet/index.tsx';
const INPUT = 'src/pages/FormSet/containers/Share/ShareCardSet/Input.tsx';
const SHAS = {
  [REL]: '63b25e50d8deaf04f1b375b0d64a9633a3d720b5026193649fe35f2b73042e14',
  [INPUT]: '415dbaeb279f5770e061c962acdcb48532e176a2f72244fc1ef8c57c6c26957a',
  'src/components/Form/core/formUtils/index.ts': 'bf9afc9fce26b856844d0ea3f4cf0aa036a555251a33ce7099a1170d88dec342',
};
function historical(rel) {
  const text = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(text).digest('hex'), SHAS[rel]);
  return text;
}
const old = historical(REL),
  current = fs.readFileSync(path.join(ROOT, REL), 'utf8');
const oldInput = historical(INPUT),
  currentInput = fs.readFileSync(path.join(ROOT, INPUT), 'utf8');
const compile = (source, rel = REL) =>
  transformSync(source, { filename: path.join(ROOT, rel), comments: false, compact: true }).code;
const parse = source => parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
function declaration(source, name) {
  const item = parse(source).program.body.find(item => {
    const n = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    return (
      n &&
      (n.type === 'FunctionDeclaration' ? n.id?.name === name && n.body : n.declarations?.some(d => d.id.name === name))
    );
  });
  assert.ok(item, name);
  return source.slice(item.start, item.end).replace(/^export /, '');
}
function expression(source, name) {
  let result;
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.type === 'VariableDeclarator' && n.id?.name === name) result = n.init;
    Object.values(n).forEach(walk);
  }
  walk(parse(source));
  assert.ok(result, name);
  return source.slice(result.start, result.end);
}
const globals = fs.readFileSync(path.join(ROOT, 'src/common/global.ts'), 'utf8');
const safeNode = parse(globals).program.body.find(
  n => n.expression?.left?.object?.name === 'window' && n.expression.left.property?.name === 'safeParse',
);
assert.ok(safeNode);
const host: { safeParse?: (value: unknown, fallback?: string) => unknown } = {};
const parseErrors = [];
new Function('window', 'console', compile(globals.slice(safeNode.start, safeNode.end), 'src/common/global.ts'))(host, {
  error: e => parseErrors.push(e.message),
});
const safeParse = host.safeParse;
const modules = new Map();
function realModule(rel) {
  if (modules.has(rel)) return modules.get(rel);
  const mod = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    'safeParse',
    '_l',
    compile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel),
  )(
    mod,
    mod.exports,
    name => {
      if (name === 'moment') return require('moment');
      throw Error(`Unexpected value dependency ${name}`);
    },
    safeParse,
    x => x,
  );
  modules.set(rel, mod.exports);
  return mod.exports;
}
const value = realModule('src/pages/FormSet/containers/Share/ShareCardSet/value.ts');
const constants = realModule('src/components/ShareCardConfig/config.ts');
const boundary = realModule('src/components/Form/core/formUtils/valueBoundary.ts');
const dynamicRel = 'src/components/Form/core/formUtils/index.ts';
const dynamicSource = fs.readFileSync(path.join(ROOT, dynamicRel), 'utf8');
assert.equal(dynamicSource, historical(dynamicRel));
const common = fs.readFileSync(path.join(ROOT, 'src/utils/common.ts'), 'utf8');
const helperErrors = [];
const dynamicCode = [
  declaration(common, 'accMul'),
  ...['getCurrentValue', 'parseStaticValue', 'getDynamicValue'].map(n => declaration(dynamicSource, n)),
].join('\n');
const getDynamicValue = new Function(
  '_',
  'moment',
  'safeParse',
  'console',
  'md',
  'window',
  ...Object.keys(boundary),
  compile(dynamicCode, dynamicRel) + ';return getDynamicValue;',
)(
  lodash,
  require('moment'),
  safeParse,
  { log: e => helperErrors.push(String(e)) },
  { global: { Account: {} } },
  { worksheetControlsCache: {} },
  ...Object.values(boundary),
);
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
    factories.set(key, new Function('module', 'exports', 'require', 'md', '_l', 'alert', compile(source, rel)));
  return factories.get(key);
}
function renderer(source, props = {}, options: { input?: boolean; immediate?: boolean } = {}) {
  const states = [],
    refs = [],
    deps = [],
    pending = [],
    effects = [],
    layouts = [],
    requests = [],
    events = [];
  let cursor = 0,
    style = 0;
  const ref = { current: null };
  const api = {
    getShareCardSetting: args => request('load', args),
    shareCardSetting: args => request('save', args),
  };
  function request(kind, args) {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    const entry = { kind, args, resolve, reject };
    requests.push(entry);
    events.push([kind, args]);
    return promise;
  }
  const hooks = {
    ...React,
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [
        states[i],
        next => {
          events.push(['set', i, typeof next === 'function' ? 'updater' : next]);
          if (options.immediate) states[i] = typeof next === 'function' ? next(states[i]) : next;
          else pending.push([i, next]);
        },
      ];
    },
    useRef: initial => {
      const i = cursor++;
      if (!(i in refs)) refs[i] = { current: initial };
      return refs[i];
    },
    useEffect: (fn, dependencies) => {
      const i = cursor++;
      if (!deps[i] || dependencies.some((v, j) => !Object.is(v, deps[i][j]))) {
        deps[i] = dependencies;
        effects.push(fn);
      }
    },
    useImperativeHandle: (r, make) => {
      cursor++;
      layouts.push(() => {
        if (r) r.current = make();
      });
    },
  };
  const mod: { exports: Record<string, any> } = { exports: {} };
  factory(source, options.input ? INPUT : REL)(
    mod,
    mod.exports,
    name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'lodash' || name === 'classnames') return require(name);
      if (name === 'ming-ui')
        return Object.fromEntries(['Button', 'Icon', 'LoadDiv', 'QiniuUpload', 'Input'].map(k => [k, leaf(k)]));
      if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
      if (name === 'src/api/worksheetSetting') return api;
      if (name === 'src/components/Form/core/formUtils') return { getDynamicValue };
      if (name === 'src/components/ShareCardConfig/config') return constants;
      if (name === 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue')
        return leaf('DynamicDefaultValue');
      if (name === 'styled-components') return { __esModule: true, default: { div: () => leaf('InputWrap') } };
      if (name === './Input') return leaf('ShareInput');
      if (name === './style') return { Con: leaf('Con'), UploadBtn: leaf('UploadBtn') };
      if (name === './value') return value;
      throw Error(`Uncontrolled share-card dependency ${name}`);
    },
    { global: { FileStoreConfig: { pubHost: 'https://files.example.test' } } },
    s => s,
    (...args) => events.push(['alert', ...args]),
  );
  const component = mod.exports.default;
  let ownProps = {
    worksheetId: 'sheet',
    appId: 'app',
    type: constants.SHARECARDTYPS.RECORD,
    controls: [],
    worksheetInfo: { worksheetName: 'Sheet' },
    handleSettingChanged: () => events.push(['changed']),
    ...props,
  };
  function render() {
    for (const [i, next] of pending.splice(0)) states[i] = typeof next === 'function' ? next(states[i]) : next;
    cursor = 0;
    const tree = options.input ? component(ownProps) : component.render(ownProps, ref);
    layouts.splice(0).forEach(fn => fn());
    return tree;
  }
  function flushEffects() {
    effects.splice(0).forEach(fn => fn());
  }
  return {
    render,
    flushEffects,
    requests,
    events,
    ref,
    states,
    refs,
    pending,
    setProps: patch => {
      ownProps = { ...ownProps, ...patch };
    },
  };
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
const drain = () => new Promise(resolve => setImmediate(resolve));
function dynamicProducer(onChange, data = { type: 2 }) {
  const source = fs.readFileSync(
    path.join(ROOT, 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/index.tsx'),
    'utf8',
  );
  const setting = fs.readFileSync(path.join(ROOT, 'src/pages/widgetConfig/util/setting.ts'), 'utf8');
  return new Function(
    '_',
    'update',
    'onChange',
    'data',
    compile(
      declaration(setting, 'handleAdvancedSettingChange') +
        '\nconst actual=' +
        expression(source, 'handleDynamicValueChange') +
        ';',
    ) + ';return actual;',
  )(lodash, require('immutability-helper'), onChange, data);
}
module.exports = {
  ROOT,
  BASE,
  REL,
  INPUT,
  old,
  current,
  oldInput,
  currentInput,
  compile,
  parse,
  declaration,
  expression,
  renderer,
  nodes,
  tree,
  drain,
  value,
  constants,
  getDynamicValue,
  helperErrors,
  parseErrors,
  dynamicProducer,
};
