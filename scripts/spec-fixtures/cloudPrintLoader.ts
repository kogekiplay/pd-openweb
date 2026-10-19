/** Complete historical/current CloudPrint, DynamicRender, DrawerFooter and worksheet API.
 * UI leaves and hook scheduling are controlled; lodash, input callbacks and API routing are real.
 * No printer, credential, template, browser window or production transport is invoked.
 */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const { ROOT, transformSync } = require('../spec-harness.ts');
const { nodes, tree } = require('./rangeDropdownLoader.ts');
const React = require('react'),
  _ = require('lodash');
const BASE = 'd591854605446ba0ebde1d43227ca86d4a190d2d';
const MAIN = 'src/pages/FormSet/components/CloudPrint/index.tsx',
  DYNAMIC = 'src/components/DynamicRender/index.tsx',
  FOOTER = 'src/pages/FormSet/components/DrawerFooter.tsx',
  API = 'src/api/worksheet.ts';
const hashes = {
  [MAIN]: '3f1adc75888408ccef74a7bfc9185bfd88fee72c4a3293ddfcd3e4573533e067',
  [DYNAMIC]: 'bbc4bfe25d94f79d5d99f45b48f8fcff403e55a507c77a90792ccaae4c64e7cc',
  [FOOTER]: 'ba615a295df37cd235b34d48dc39eb078bcce4a41d407897540bea9c972c1150',
  [API]: '04a4701abab44ef62e19fe83bf528511cddb81e4d0275c7f0f3aaff12f882cbd',
};
const old = {},
  current = {};
for (const rel of [MAIN, DYNAMIC, FOOTER, API]) {
  old[rel] = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  if (hashes[rel]) assert.equal(crypto.createHash('sha256').update(old[rel]).digest('hex'), hashes[rel]);
  current[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
const compile = (s, rel) => transformSync(s, { filename: path.join(ROOT, rel), comments: false }).code;
const leaves = new Map(),
  factories = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const C = () => null;
    C.displayName = name;
    leaves.set(name, C);
  }
  return leaves.get(name);
}
function hooks() {
  const states = [],
    deps = [],
    memos = [],
    pending = [],
    effects = [],
    cleanups = [];
  let cursor = 0;
  const changed = (i, next) =>
    !deps[i] || !next || next.length !== deps[i].length || next.some((v, j) => !Object.is(v, deps[i][j]));
  const runtime = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], update => pending.push([i, update])];
    },
    useMemo(fn, next) {
      const i = cursor++;
      if (changed(i, next)) {
        memos[i] = fn();
        deps[i] = next;
      }
      return memos[i];
    },
    useCallback(fn, next) {
      return runtime.useMemo(() => fn, next);
    },
    useEffect(fn, next) {
      const i = cursor++;
      if (changed(i, next)) {
        deps[i] = next;
        effects.push([i, fn]);
      }
    },
  };
  return {
    runtime,
    states,
    render(C, props) {
      cursor = 0;
      return C(props);
    },
    effects() {
      for (const [i, fn] of effects.splice(0)) {
        if (cleanups[i]) cleanups[i]();
        cleanups[i] = fn();
      }
    },
    flush() {
      let turns = 0;
      while (pending.length) {
        assert.ok(++turns < 100, 'state update loop');
        const [i, update] = pending.shift();
        states[i] = typeof update === 'function' ? update(states[i]) : update;
      }
    },
  };
}
function factory(s, rel) {
  const key = rel + s;
  if (!factories.has(key))
    factories.set(
      key,
      new Function(
        'module',
        'exports',
        'require',
        '_l',
        'alert',
        'window',
        'console',
        compile(s, rel) + (rel === MAIN ? ';exports.helpers={getAnalysisResult,getControls,currentFieldValue};' : ''),
      ),
    );
  return factories.get(key);
}
function controls() {
  return [
    { controlId: 'text', controlName: 'Text', type: 2 },
    {
      controlId: 'relation',
      controlName: 'Related',
      type: 29,
      relationControls: [
        { controlId: 'child', controlName: 'Child', type: 6 },
        { controlId: 'ignored', type: 19 },
      ],
    },
    { controlId: 'formula', controlName: 'Formula', type: 30, sourceControl: { type: 2 } },
    {
      controlId: 'sub',
      controlName: 'Subtable',
      type: 34,
      relationControls: [{ controlId: 'subText', controlName: 'Sub text', type: 2 }],
    },
    { controlId: 'unsupported', type: 19 },
    { controlName: 'Missing id', type: 2 },
  ];
}
const metadata = () =>
  _.cloneDeep(JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/spec-fixtures/cloudPrintMetadata.json'), 'utf8')));
const validData = () => {
  const data = metadata();
  data.find(f => f.fieldKey === 'name').value = '  Template  ';
  data.find(f => f.fieldKey === 'sn').value = 'printer';
  data.find(f => f.fieldKey === 'templateId').value = 'template';
  const map = data.find(f => f.fieldKey === 'renderData');
  map.value = [{ fromKey: 'code', isDetail: false, toControlId: 'text', fromTableName: 'Main', legacy: 'retained' }];
  map.fromField.fields = [{ text: 'code', desc: 'Code', sheetIndex: 0, sheetName: 'Main' }];
  map.systemField.fields = [{ controlId: 'text', controlName: 'Text', legacy: 'retained' }];
  return data;
};
function renderer(version = 'current', provided = {}) {
  const source = version === 'old' ? old : current,
    events = [],
    requests = [],
    errors = [],
    win = { open: link => events.push(['window', link]) };
  const mainHooks = hooks();
  const transport = (service, method, args, options) => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options, resolve, reject });
    events.push(['request', service, method, args]);
    return promise;
  };
  const api = { exports: {} };
  new Function('module', 'exports', 'mdyAPI', compile(source[API], API))(api, api.exports, transport);
  function load(rel, runtime = mainHooks.runtime) {
    const m: { exports: Record<string, any> } = { exports: {} };
    factory(source[rel], rel)(
      m,
      m.exports,
      n => {
        if (n === 'react') return runtime;
        if (n === 'react/jsx-runtime' || n === 'lodash' || n === 'classnames') return require(n);
        if (n === 'src/api/worksheet') return api.exports;
        if (n === 'src/components/DynamicRender') return leaf('DynamicRender');
        if (n === '../DrawerFooter') return leaf('DrawerFooter');
        if (n === 'styled-components') return { __esModule: true, default: { div: () => leaf('FooterWrap') } };
        if (n === 'antd') return { Select: leaf('Select') };
        if (n === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
        if (n === 'ming-ui')
          return Object.fromEntries(
            ['Dialog', 'Icon', 'LoadDiv', 'Radio', 'ScrollView', 'Input'].map(k => [k, leaf(k)]),
          );
        if (n.endsWith('.less')) return {};
        throw Error('Unexpected cloud-print dependency ' + n);
      },
      s => s,
      (...args) => events.push(['alert', ...args]),
      win,
      { error: error => errors.push([error.name, error.message]) },
    );
    return m.exports;
  }
  const main = load(MAIN);
  let props = {
    worksheetInfo: {
      worksheetId: 'sheet',
      projectId: 'project',
      name: 'Worksheet',
      template: { controls: controls() },
    },
    type: 'new',
    onClose: () => events.push(['close']),
    getPrintData: () => events.push(['refresh']),
    ...provided,
  };
  const render = () => mainHooks.render(main.default, props);
  const data = () => nodes(render(), 'DynamicRender')[0]?.props.data;
  return {
    render,
    data,
    events,
    requests,
    errors,
    helpers: main.helpers,
    states: mainHooks.states,
    effects: () => mainHooks.effects(),
    flush: () => mainHooks.flush(),
    props: () => props,
    setProps(patch) {
      props = { ...props, ...patch };
    },
    dynamic() {
      const h = hooks(),
        mod = load(DYNAMIC, h.runtime),
        childProps = nodes(render(), 'DynamicRender')[0].props;
      return {
        render: () => h.render(mod.default, childProps),
        effects: () => h.effects(),
        flush: () => h.flush(),
        props: childProps,
      };
    },
    footer() {
      return load(FOOTER).default(nodes(render(), 'DrawerFooter')[0].props);
    },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function create(version = 'current', data = metadata(), provided = {}) {
  const h = renderer(version, provided);
  h.render();
  h.effects();
  h.flush();
  assert.equal(h.requests[0].method, 'LoadCloudPrintDatas');
  h.requests[0].resolve(data);
  await tick();
  h.flush();
  h.render();
  return h;
}
function edit(version = 'current', data = validData(), provided = {}) {
  const h = renderer(version, { type: 'edit', templateData: { id: 'print', cloudExtraParams: data }, ...provided });
  h.render();
  h.effects();
  h.flush();
  h.render();
  return h;
}
function outcome(fn) {
  try {
    return { value: fn() };
  } catch (e) {
    return { error: [e.name, e.message] };
  }
}
module.exports = {
  BASE,
  MAIN,
  DYNAMIC,
  FOOTER,
  API,
  old,
  current,
  compile,
  renderer,
  create,
  edit,
  metadata,
  validData,
  controls,
  nodes,
  tree,
  outcome,
  tick,
};
