/** Complete real list/editor/API modules; only UI leaves, hook scheduling, DOM and transport are controlled. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const { ROOT, transformSync } = require('../spec-harness.ts');
const React = require('react');
const BASE = '68fdab3fa207592a9945e2a9ec8ff655489968bf';
const LIST = 'src/pages/FormSet/containers/FormIndexSetting.tsx',
  EDITOR = 'src/pages/worksheet/common/CreateIndex/index.tsx',
  API = 'src/api/worksheet.ts';
const hashes = {
  [LIST]: '6617bd1f7db9562cd6f983d0c9a088572c5cecae0008c54bccb0ca71ad6c6090',
  [EDITOR]: 'fbb44572588a8b65ae0c224c6189c48f919e644f438021b72e8daac1a15a6991',
  [API]: '266d2251b76bb2632ef1fb52151072142fcdaf7f4725cdffa5e9395ac94acf5f',
};
const old = {},
  current = {},
  compiled = new Map<string, string>();
for (const file of [LIST, EDITOR, API]) {
  old[file] = cp.execFileSync('git', ['show', `${BASE}:${file}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(old[file]).digest('hex'), hashes[file]);
  current[file] = fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function compile(source, file) {
  const key = file + source;
  if (!compiled.has(key))
    compiled.set(key, transformSync(source, { filename: path.join(ROOT, file), comments: false }).code);
  return compiled.get(key);
}
const leaves = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const C = () => null;
    C.displayName = name;
    leaves.set(name, C);
  }
  return leaves.get(name);
}
function nodes(root, kind) {
  const result = [];
  function visit(n) {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!React.isValidElement(n)) return;
    if ((typeof n.type === 'string' ? n.type : n.type.displayName || n.type.name) === kind) result.push(n);
    visit(n.props.children);
  }
  visit(root);
  return result;
}
function tree(value) {
  if (typeof value === 'function') return '[function]';
  if (React.isValidElement(value)) {
    const props = {};
    for (const [key, val] of Object.entries(value.props)) if (key !== 'ref') props[key] = tree(val);
    return {
      type: typeof value.type === 'string' ? value.type : value.type.displayName || value.type.name || 'Fragment',
      key: value.key,
      props,
    };
  }
  if (Array.isArray(value)) return value.map(tree);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tree(v)]));
  return value;
}
function host(version = 'current', provided = {}, options: { syncFailure?: string } = {}) {
  const source = version === 'old' ? old : current,
    states = [],
    effects = [],
    deps = [],
    events = [],
    requests = [];
  let cursor = 0;
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [
        states[i],
        update => {
          states[i] = typeof update === 'function' ? update(states[i]) : update;
        },
      ];
    },
    useEffect(fn, next) {
      const i = cursor++;
      if (!deps[i] || next.length !== deps[i].length || next.some((v, j) => !Object.is(v, deps[i][j]))) {
        deps[i] = next;
        effects.push(fn);
      }
    },
  };
  function transport(service, method, args, opts) {
    if (method === options.syncFailure) throw Error('index transport failed synchronously');
    let resolve, reject;
    const p = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options: opts, resolve, reject });
    events.push(['request', service, method, args]);
    return p;
  }
  const api = { exports: {} };
  new Function('module', 'exports', 'mdyAPI', compile(source[API], API))(api, api.exports, transport);
  const styled = Object.fromEntries(['div', 'span'].map(n => [n, () => leaf(`styled.${n}`)]));
  const select = leaf('Select');
  select.Option = leaf('Option');
  const translate = (s, ...args) => s.replace(/%(\d+)/g, (_m, n) => String(args[Number(n)]));
  function load(file) {
    const mod: { exports: Record<string, any> } = { exports: {} };
    new Function('module', 'exports', 'require', '_l', 'alert', 'document', compile(source[file], file))(
      mod,
      mod.exports,
      name => {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime' || name === 'lodash' || name === 'classnames') return require(name);
        if (name === 'styled-components') return { __esModule: true, default: styled };
        if (name === 'antd') return { Drawer: leaf('Drawer'), Input: leaf('Input'), Select: select };
        if (name === '@rc-component/trigger') return leaf('Trigger');
        if (name === 'ming-ui')
          return Object.fromEntries(['Icon', 'LoadDiv', 'Support', 'Checkbox'].map(n => [n, leaf(n)]));
        if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
        if (name === 'src/api/worksheet') return api.exports;
        if (name === 'worksheet/common/CreateIndex') return leaf('CreateIndex');
        if (name === '../components/MoreOption') return leaf('MoreOption');
        if (name === 'src/pages/FormSet/components/DrawerFooter') return leaf('DrawerFooter');
        if (name.endsWith('.less')) return {};
        throw Error('Unexpected index dependency ' + name);
      },
      translate,
      (...args) => events.push(['alert', ...args]),
      { body: { host: 'body' } },
    );
    return mod.exports.default;
  }
  const List = load(LIST),
    Editor = load(EDITOR);
  let props = { worksheetInfo: { worksheetId: 'sheet', appId: 'app' }, ...provided };
  return {
    events,
    requests,
    states,
    render() {
      cursor = 0;
      return List(props);
    },
    effects() {
      effects.splice(0).forEach(fn => fn());
    },
    setProps(patch) {
      props = { ...props, ...patch };
    },
    editor(patch = {}) {
      const p = {
        isEdit: false,
        currentIndexInfo: {},
        selectedIndexList: [{ fieldId: 'a', indexType: '1', type: 0 }],
        worksheetAvailableFields: fields(),
        appId: 'app',
        worksheetId: 'sheet',
        worksheetRowIndexLimit: 5,
        getIndexesInfo: () => events.push(['refresh']),
        indexList: [],
        onClose: () => events.push(['close']),
        getFieldObjById: id => fields().find(f => f.id === id) || {},
        ...patch,
      };
      const e = new Editor(p);
      e.setState = update => {
        const delta = typeof update === 'function' ? update(e.state, e.props) : update;
        e.state = { ...e.state, ...delta };
      };
      return e;
    },
  };
}
function fields() {
  return [
    { id: 'a', name: 'Alpha', type: 0, controlType: 2 },
    { id: 'b', name: 'Beta', type: 1, controlType: 6 },
    { id: 'c', name: 'Choice', type: 3, controlType: 9 },
  ];
}
function index(patch = {}) {
  return {
    indexConfigId: 'idx',
    worksheetId: 'source-sheet',
    customeIndexName: 'Index',
    indexFields: [{ fieldId: 'a', indexType: '1', isSystem: false, isDelete: false }],
    uniqueIndex: false,
    wildcardIndex: false,
    sparseIndex: false,
    backgroundIndex: true,
    indexStateId: 1,
    isSystem: false,
    ...patch,
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
module.exports = { BASE, LIST, EDITOR, API, old, current, compile, host, fields, index, nodes, tree, settle };
