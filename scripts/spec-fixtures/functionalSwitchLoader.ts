/** Actual full switch/range/delete modules with an observation hook; UI, DOM, storage and transport controlled. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const { ROOT, transformSync } = require('../spec-harness.ts'),
  React = require('react'),
  lodash = require('lodash'),
  parser = require('@babel/parser');
const BASE = '4e470d710c554cfc9f1d2e917dfde10e7b54c133';
const REL = 'src/pages/FormSet/containers/FunctionalSwitch/index.tsx',
  RANGE = 'src/pages/FormSet/components/Range.tsx',
  DELETE = 'src/pages/FormSet/components/DelAutoIdDialog.tsx';
const SHAS = {
  [REL]: '82fb54846afa51a328d8948c097d6e91688d24618ae91b74c6c14ad948dcc8fb',
  [RANGE]: 'a7d0e979e3a8627aa4e797bce4e750826f609f1f8f390ad9e5073675eddfd26c',
  [DELETE]: '66c7063e0324b1befa32c572c865fdf9018bc0ac3b90b7dcf8baa0334034c035',
};
function historical(rel) {
  const source = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), SHAS[rel]);
  return source;
}
const previous = historical(REL),
  current = fs.readFileSync(path.join(ROOT, REL), 'utf8'),
  oldRange = historical(RANGE),
  currentRange = fs.readFileSync(path.join(ROOT, RANGE), 'utf8'),
  oldDelete = historical(DELETE),
  currentDelete = fs.readFileSync(path.join(ROOT, DELETE), 'utf8');
const compile = (source, rel = REL) =>
  transformSync(source, { filename: path.join(ROOT, rel), comments: false, compact: true }).code;
const parse = source => parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const leaves = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const C = () => null;
    C.displayName = name;
    leaves.set(name, C);
  }
  return leaves.get(name);
}
function config() {
  const mod: { exports: Record<string, any> } = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    '_l',
    compile(
      fs.readFileSync(path.join(ROOT, 'src/pages/FormSet/containers/FunctionalSwitch/config.tsx'), 'utf8'),
      'src/pages/FormSet/containers/FunctionalSwitch/config.tsx',
    ),
  )(
    mod,
    mod.exports,
    name => {
      if (name === 'react/jsx-runtime') return require(name);
      throw Error(name);
    },
    s => s,
  );
  return mod.exports;
}
const constants = config();
const apiCode = compile(fs.readFileSync(path.join(ROOT, 'src/api/worksheet.ts'), 'utf8'), 'src/api/worksheet.ts');
const processCode = compile(
  fs.readFileSync(path.join(ROOT, 'src/pages/workflow/api/process.ts'), 'utf8'),
  'src/pages/workflow/api/process.ts',
);
const baseCode = compile(
  fs.readFileSync(path.join(ROOT, 'src/pages/workflow/api/base.ts'), 'utf8'),
  'src/pages/workflow/api/base.ts',
);
const cookies = fs.readFileSync(path.join(ROOT, 'src/common/cookies.ts'), 'utf8');
const cookieNode = parse(cookies).program.body.find(
  n => n.expression?.left?.object?.name === 'window' && n.expression.left.property?.name === 'safeLocalStorageSetItem',
);
assert.ok(cookieNode);
const factories = new Map();
function factory(source, rel) {
  const key = rel + source;
  if (!factories.has(key)) {
    let observed = source;
    if (rel === REL) {
      const needle = '  return (\n    <React.Fragment>';
      assert.equal(source.split(needle).length - 1, 1);
      observed = source.replace(
        needle,
        '  capture({edit,strRight,closeRangeDiaFn,renderSwitch,getSwitchData});\n' + needle,
      );
    }
    factories.set(
      key,
      new Function(
        'module',
        'exports',
        'require',
        '_l',
        'alert',
        'localStorage',
        'safeLocalStorageSetItem',
        '$',
        'capture',
        compile(observed, rel),
      ),
    );
  }
  return factories.get(key);
}
function renderer(
  source,
  provided = {},
  options: {
    kind?: 'main' | 'delete';
    immediate?: boolean;
    storage?: Record<string, string>;
    nearest?: boolean;
    top?: number;
  } = {},
) {
  const states = [],
    deps = [],
    pending = [],
    effects = [],
    requests = [],
    events = [],
    confirms = [];
  let cursor = 0,
    observed = {};
  const transport = (service, method, args, requestOptions) => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options: requestOptions, resolve, reject });
    events.push(['request', service, method, args]);
    return promise;
  };
  const api = { exports: {} };
  new Function('module', 'exports', 'mdyAPI', apiCode)(api, api.exports, transport);
  const process = { exports: {} };
  const baseModule = { exports: {} };
  new Function('module', 'exports', 'location', '__api_server__', 'md', baseCode)(
    baseModule,
    baseModule.exports,
    { href: 'https://host.example.test' },
    { workflow: 'https://workflow.example.test' },
    { global: { Config: {} } },
  );
  const jquery = target => ({
    closest: () => ({ length: options.nearest === false ? 0 : 1, position: () => ({ top: options.top ?? 36 }) }),
  });
  jquery.extend = (...args) => lodash.assign(...args);
  new Function('module', 'exports', 'require', 'mdyAPI', '$', processCode)(
    process,
    process.exports,
    name => {
      assert.equal(name, './base');
      return baseModule.exports;
    },
    transport,
    jquery,
  );
  const storage = {
    getItem: key => {
      events.push(['storage-read', key]);
      return options.storage?.[key] ?? null;
    },
    setItem: (...args) => {
      events.push(['storage-write', ...args]);
    },
    removeItem: key => events.push(['storage-remove', key]),
  };
  const win: { localStorage: typeof storage; safeLocalStorageSetItem?: (...args: unknown[]) => void } = {
    localStorage: storage,
  };
  new Function('window', 'console', compile(cookies.slice(cookieNode.start, cookieNode.end), 'src/common/cookies.ts'))(
    win,
    { log: error => events.push(['storage-error', String(error)]) },
  );
  const hooks = {
    ...React,
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [
        states[i],
        next => {
          events.push(['state', i, next]);
          if (options.immediate) states[i] = typeof next === 'function' ? next(states[i]) : next;
          else pending.push([i, next]);
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
  const Dialog = leaf('Dialog');
  Dialog.confirm = value => {
    confirms.push(value);
    events.push(['confirm']);
    return () => events.push(['confirm-close']);
  };
  const mod: { exports: Record<string, any> } = { exports: {} };
  factory(source, options.kind === 'delete' ? DELETE : REL)(
    mod,
    mod.exports,
    name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'lodash' || name === 'classnames') return require(name);
      if (name === 'ming-ui')
        return {
          Dialog,
          ...Object.fromEntries(['Button', 'Icon', 'LoadDiv', 'ScrollView', 'Switch'].map(k => [k, leaf(k)])),
        };
      if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
      if (name === 'src/api/worksheet') return api.exports;
      if (name === 'src/pages/workflow/api/process') return process.exports;
      if (name === 'styled-components') return { __esModule: true, default: { div: () => leaf('DeleteWrap') } };
      if (name === '../../components/DelAutoIdDialog') return leaf('DelDialog');
      if (name === '../../components/Range') return leaf('Range');
      if (name === './config') return constants;
      if (name.endsWith('.less')) return {};
      throw Error('Unexpected functional dependency ' + name);
    },
    (text, ...args) => text.replace(/%(\d+)/g, (_m, i) => String(args[Number(i)])),
    (...args) => events.push(['alert', ...args]),
    storage,
    win.safeLocalStorageSetItem,
    jquery,
    value => {
      observed = value;
    },
  );
  let props =
    options.kind === 'delete'
      ? {
          show: true,
          worksheetId: 'sheet',
          companyId: 'company',
          onClose: () => events.push(['close']),
          delCallback: () => events.push(['deleted']),
          ...provided,
        }
      : {
          worksheetId: 'sheet',
          worksheetInfo: {
            views: [
              { viewId: 'v1', worksheetId: 'sheet', name: 'One' },
              { viewId: 'system', worksheetId: 'system', name: 'System' },
              { viewId: undefined, worksheetId: 'sheet', name: 'Missing' },
            ],
            projectId: 'company',
            appId: 'app',
            closeAutoID: false,
          },
          ...provided,
        };
  function render() {
    for (const [i, next] of pending.splice(0)) states[i] = typeof next === 'function' ? next(states[i]) : next;
    cursor = 0;
    return mod.exports.default(props);
  }
  function flushEffects() {
    effects.splice(0).forEach(fn => fn());
  }
  return {
    render,
    flushEffects,
    requests,
    states,
    events,
    confirms,
    pending,
    props,
    helpers: () => observed,
    setProps: patch => {
      props = { ...props, ...patch };
    },
    module: mod.exports,
  };
}
function range(
  source,
  provided = {},
  options: {
    width?: number;
    chat?: unknown;
    list?: unknown;
    containerHeight?: number;
    elWidth?: number;
    elHeight?: number;
  } = {},
) {
  const events = [],
    timers = [];
  const win = {
    innerWidth: options.width ?? 1000,
    addEventListener: (...args) => events.push(['addEvent', ...args]),
    removeEventListener: (...args) => events.push(['removeEvent', ...args]),
  };
  const container = { offsetHeight: options.containerHeight ?? 400 };
  const list = Object.hasOwn(options, 'list') ? options.list : { width: 300, left: 20 };
  const chat = Object.hasOwn(options, 'chat') ? options.chat : { width: 40 };
  const doc = {
    querySelector: selector => {
      events.push(['query', selector]);
      if (selector === '.switchBoxCon') return container;
      if (selector === '.switchBoxCon ul') return list ? { getBoundingClientRect: () => list } : null;
      if (selector === '#chat') return chat ? { getBoundingClientRect: () => chat } : null;
      throw Error('Unexpected query ' + selector);
    },
  };
  const mod: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'require', '_l', 'document', 'window', 'setTimeout', compile(source, RANGE))(
    mod,
    mod.exports,
    name => {
      if (name === 'react' || name === 'react/jsx-runtime' || name === 'lodash') return require(name);
      if (name === 'styled-components') return { __esModule: true, default: { div: () => leaf('RangeBox') } };
      if (name === 'ming-ui') return Object.fromEntries(['Checkbox', 'Icon', 'Radio'].map(k => [k, leaf(k)]));
      if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
      if (name === 'ming-ui/components/ClickAway') return { wrap: C => C };
      throw Error('Unexpected range dependency ' + name);
    },
    s => s,
    doc,
    win,
    fn => {
      timers.push(fn);
      return timers.length;
    },
  );
  const props = {
    data: { viewIds: ['v1'] },
    diaRang: false,
    showDialog: true,
    hasViewRange: true,
    roleType: 0,
    top: 30,
    text: { allview: 'All', assignview: 'Selected' },
    views: [
      { viewId: 'v1', worksheetId: 'sheet', name: 'One' },
      { viewId: 'v2', worksheetId: 'sheet', name: 'Two' },
      { viewId: undefined, worksheetId: 'sheet', name: 'Missing' },
      { viewId: 'system', worksheetId: 'system', name: 'System' },
    ],
    otherSet: true,
    closeFn: () => events.push(['close']),
    change: value => events.push(['role', value]),
    changeViewRange: value => events.push(['range', value]),
    changeOtherSet: value => events.push(['other', value]),
    ...provided,
  };
  const instance = new mod.exports.default(props);
  const element = { offsetWidth: options.elWidth ?? 320, offsetHeight: options.elHeight ?? 200, style: {} };
  instance.el = element;
  return { instance, props, element, events, timers, flushTimers: () => timers.splice(0).forEach(fn => fn()) };
}
function rows() {
  return constants.allSwitchKeys.map(type => ({
    type,
    state: true,
    roleType: 0,
    viewIds: [],
    displayFlowChart: 0,
    extension: { type },
  }));
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
function businessState(value) {
  if (!value || typeof value !== 'object') return value;
  const { loadError, ...rest } = value;
  return rest;
}
function businessEvents(events) {
  return events.map(e => (e[0] === 'state' && e[1] === 4 ? ['state', 4, businessState(e[2])] : e));
}
const drain = () => new Promise(resolve => setImmediate(resolve));
module.exports = {
  ROOT,
  BASE,
  REL,
  RANGE,
  DELETE,
  previous,
  current,
  oldRange,
  currentRange,
  oldDelete,
  currentDelete,
  compile,
  renderer,
  range,
  rows,
  nodes,
  tree,
  businessState,
  businessEvents,
  constants,
  drain,
};
