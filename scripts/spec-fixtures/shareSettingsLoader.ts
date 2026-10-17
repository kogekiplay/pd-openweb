/** Full historical/current sharing UI and actual worksheet API wrapper; hooks/leaves and transport controlled. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const { ROOT, transformSync } = require('../spec-harness.ts');
const React = require('react');
const BASE = '3f2a7c8ac82c24fe19ea6a7b801283b4e34f5fb7',
  REL = 'src/pages/FormSet/containers/Share/index.tsx';
const previous = cp.execFileSync('git', ['show', `${BASE}:${REL}`], { cwd: ROOT, encoding: 'utf8' });
assert.equal(
  crypto.createHash('sha256').update(previous).digest('hex'),
  'e20c70e3c7fb566532b27653890351158cb637cc98eab997a3c90e50121b3bd7',
);
const current = fs.readFileSync(path.join(ROOT, REL), 'utf8');
const compile = (source, rel = REL) =>
  transformSync(source, { filename: path.join(ROOT, rel), comments: false, compact: true }).code;
function moduleValue(rel) {
  const mod = { exports: {} };
  new Function('module', 'exports', compile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel))(mod, mod.exports);
  return mod.exports;
}
const settings = moduleValue('src/pages/FormSet/containers/Share/settings.ts');
const constants = moduleValue('src/components/ShareCardConfig/config.ts');
const apiCode = compile(fs.readFileSync(path.join(ROOT, 'src/api/worksheet.ts'), 'utf8'), 'src/api/worksheet.ts');
const sources = new Map();
function sourceFactory(source) {
  if (!sources.has(source))
    sources.set(source, new Function('module', 'exports', 'require', '_l', 'alert', compile(source)));
  return sources.get(source);
}
const leaves = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const f = () => null;
    f.displayName = name;
    leaves.set(name, f);
  }
  return leaves.get(name);
}
function renderer(source, provided = {}, options: { immediate?: boolean } = {}) {
  const states = [],
    deps = [],
    pending = [],
    effects = [],
    events = [],
    requests = [];
  let cursor = 0,
    style = 0;
  const hooks = {
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [
        states[i],
        patch => {
          events.push(['state', i, patch]);
          if (options.immediate) states[i] = typeof patch === 'function' ? patch(states[i]) : patch;
          else pending.push([i, patch]);
        },
      ];
    },
    useEffect: (fn, dependencies) => {
      const i = cursor++;
      if (!deps[i] || dependencies.some((x, j) => !Object.is(x, deps[i][j]))) {
        deps[i] = dependencies;
        effects.push(fn);
      }
    },
  };
  const api = { exports: {} };
  new Function('module', 'exports', 'mdyAPI', apiCode)(api, api.exports, (service, method, args, requestOptions) => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options: requestOptions, resolve, reject });
    events.push(['request', service, method, args, requestOptions]);
    return promise;
  });
  const mod: { exports: Record<string, any> } = { exports: {} };
  sourceFactory(source)(
    mod,
    mod.exports,
    name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'classnames') return require(name);
      if (name === 'styled-components')
        return { __esModule: true, default: { div: () => leaf(`styled-${style++}`), button: () => leaf('Tab') } };
      if (name === 'ming-ui')
        return Object.fromEntries(
          ['Button', 'Icon', 'LoadDiv', 'Radio', 'ScrollView', 'Switch'].map(k => [k, leaf(k)]),
        );
      if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
      if (name === 'src/api/worksheet') return api.exports;
      if (name === 'src/components/ShareCardConfig/config') return constants;
      if (name === 'src/pages/Role/PortalCon/components/SelectExDrop') return leaf('SelectExDrop');
      if (name === './ShareCardSet') return leaf('ShareCardSetting');
      if (name === './settings') return settings;
      throw Error(`Unexpected sharing dependency ${name}`);
    },
    x => x,
    (...args) => events.push(['alert', ...args]),
  );
  let props = {
    worksheetId: 'sheet',
    worksheetInfo: {
      worksheetId: 'sheet',
      name: 'Sheet',
      appId: 'app',
      advancedSetting: { other: 'keep' },
      views: [
        { viewId: 'v1', worksheetId: 'sheet', name: 'One' },
        { viewId: 'system', worksheetId: 'system', name: 'System' },
        { viewId: 'v2', worksheetId: 'sheet', name: 'Two' },
      ],
    },
    worksheetControls: [
      { controlId: 'text', type: 2 },
      { controlId: 'number', type: 6 },
      { controlId: 'money', type: 8 },
      { controlId: 'email', type: 5 },
      { controlId: 'combo', type: 32 },
      { controlId: 'hidden', type: 40 },
      { controlId: 'missing' },
    ],
    onChange: next => events.push(['onChange', next]),
    ...provided,
  };
  function render() {
    for (const [i, patch] of pending.splice(0)) states[i] = typeof patch === 'function' ? patch(states[i]) : patch;
    cursor = 0;
    return mod.exports.default(props);
  }
  function flushEffects() {
    effects.splice(0).forEach(fn => fn());
  }
  return {
    render,
    flushEffects,
    states,
    pending,
    events,
    requests,
    props,
    setProps: patch => {
      props = { ...props, ...patch };
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
module.exports = { ROOT, BASE, REL, previous, current, compile, renderer, nodes, tree, drain, settings };
