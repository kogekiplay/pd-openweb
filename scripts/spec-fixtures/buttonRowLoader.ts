/** Complete real row/menu/List/API modules; React scheduling, UI leaves, transport, DOM and Dialog are controlled. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const h = require('./rangeDropdownLoader.ts');
const { ROOT, compile, parse, nodes, tree } = h;
const BASE = '2d7ad35ee9421a2e68b5b7c184315ea574b8a945';
const ROW = 'src/pages/FormSet/components/BtnTd.tsx',
  MENU = 'src/pages/FormSet/components/CustomBtnMoreOption.tsx',
  MORE = 'src/pages/FormSet/components/MoreOption.tsx',
  LIST = 'src/pages/FormSet/containers/CustomBtnFormSet/List.tsx';
const hashes = {
  [ROW]: '1ba8fcb1b0b8fd9b1641a3bbe1fe091ea8bf34222cac02b9b54e2fcedc405176',
  [MENU]: '94d12dc93493114cdf4b729454c4d996b50605be57f59e98be17dbe265823f1c',
  [MORE]: 'd1f423d2d324966b06e1bc38cea496580966dfb6c9f1834e6f300f42b8c41df9',
  [LIST]: '0048b0c7151f8f48cce6e7ce7b67ebca22eccf174ce9f4bd0d53de8f5bbff889',
};
function historical(rel) {
  const s = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(s).digest('hex'), hashes[rel], rel);
  return s;
}
const old = Object.fromEntries([ROW, MENU, MORE, LIST].map(rel => [rel, historical(rel)]));
const current = Object.fromEntries(
  [ROW, MENU, MORE, LIST].map(rel => [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')]),
);
const apiCode = compile(fs.readFileSync(path.join(ROOT, 'src/api/worksheet.ts'), 'utf8'), 'src/api/worksheet.ts');
const configRel = 'src/pages/worksheet/common/ViewConfig/components/customBtn/config.ts';
const configCode = compile(fs.readFileSync(path.join(ROOT, configRel), 'utf8'), configRel);
const setStateCode = fs.readFileSync(require.resolve('react-use/lib/useSetState'), 'utf8');
assert.equal(
  crypto.createHash('sha256').update(setStateCode).digest('hex'),
  'fd3c98fa879a695e337796e400249326f83d0b63310f4b2d120d15ed133f3457',
);
const factories = new Map(),
  leaves = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const c = () => null;
    c.displayName = name;
    leaves.set(name, c);
  }
  return leaves.get(name);
}
function factory(source, rel) {
  const key = rel + source;
  if (!factories.has(key))
    factories.set(
      key,
      new Function(
        'module',
        'exports',
        'require',
        'mdyAPI',
        'safeParse',
        '_l',
        'alert',
        'document',
        compile(source, rel),
      ),
    );
  return factories.get(key);
}
function renderer(
  version = 'current',
  provided = {},
  options: { parse?: (...args: any[]) => any; syncFailure?: string } = {},
) {
  const source = version === 'old' ? old : current,
    states = [],
    refs = [],
    deps = [],
    callbacks = [],
    effects = [],
    pending = [],
    events = [],
    requests = [],
    confirms = [];
  let cursor = 0;
  const hooks = {
    useRef: initial => {
      const i = cursor++;
      if (!(i in refs)) refs[i] = { current: initial };
      return refs[i];
    },
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [
        states[i],
        update => {
          events.push(['state-update']);
          pending.push([i, update]);
        },
      ];
    },
    useCallback: (fn, next) => {
      const i = cursor++;
      if (!deps[i] || next.some((x, j) => !Object.is(x, deps[i][j]))) {
        deps[i] = next;
        callbacks[i] = fn;
      }
      return callbacks[i];
    },
    useEffect: (fn, next) => {
      const i = cursor++;
      if (!deps[i] || next.some((x, j) => !Object.is(x, deps[i][j]))) {
        deps[i] = next;
        effects.push(fn);
      }
    },
  };
  const transport = (service, method, args, requestOptions) => {
    if (options.syncFailure === method) throw Error('sync transport failure');
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options: requestOptions, resolve, reject });
    events.push(['request', service, method, args]);
    return promise;
  };
  const api: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'mdyAPI', apiCode)(api, api.exports, transport);
  const actualSetState: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'require', setStateCode)(actualSetState, actualSetState.exports, n => {
    assert.equal(n, 'react');
    return hooks;
  });
  const constants: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', '_l', configCode)(constants, constants.exports, s => s);
  const Dialog = leaf('Dialog');
  Dialog.confirm = value => {
    confirms.push(value);
    events.push(['confirm']);
    return () => events.push(['confirm-close']);
  };
  const translate = (text, ...args) => text.replace(/%(\d+)/g, (_m, i) => String(args[Number(i)]));
  const host = { body: { host: 'body' } };
  function load(rel) {
    const mod: { exports: Record<string, any> } = { exports: {} };
    factory(source[rel], rel)(
      mod,
      mod.exports,
      name => {
        if (name === 'react') return { ...require('react'), ...hooks };
        if (name === 'react/jsx-runtime' || name === 'lodash' || name === 'classnames') return require(name);
        if (name === 'react-use') return { useSetState: actualSetState.exports.default };
        if (name === 'ming-ui')
          return { Dialog, ...Object.fromEntries(['Icon', 'Input', 'SvgIcon'].map(n => [n, leaf(n)])) };
        if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
        if (name === 'ming-ui/components/ClickAway') return { wrap: C => C };
        if (name === '@rc-component/trigger') return leaf('Trigger');
        if (name === 'src/api/worksheet') return api.exports;
        if (name === 'src/pages/FormSet/components/BtnRangeDrop') return leaf('BtnRangeDrop');
        if (name === 'src/pages/worksheet/common/ViewConfig/components/customBtn/config') return constants.exports;
        if (name === './CustomBtnMoreOption') return leaf('CustomMenu');
        if (name === './MoreOption') return { __esModule: true, default: More };
        if (name === './rangeValues') return h.values;
        if (name === '../../components/BtnTd') return leaf('BtnTd');
        if (name === './style') return { ArrowUp: leaf('ArrowUp'), ArrowDown: leaf('ArrowDown') };
        if (name.endsWith('.less')) return {};
        throw Error('Unexpected button row dependency ' + name);
      },
      transport,
      options.parse || h.safeParse,
      translate,
      (...args) => events.push(['alert', ...args]),
      host,
    );
    return mod.exports;
  }
  const More = load(MORE).default,
    Menu = load(MENU).default,
    Row = load(ROW).default,
    List = load(LIST).default;
  const initial = {
    btnId: 'b',
    name: 'Button',
    status: 1,
    isAllView: 0,
    writeObject: 1,
    writeType: 1,
    clickType: 1,
    advancedSetting: { detailviews: '["v1"]', listviews: '["tree"]' },
  };
  let props = {
    it: initial,
    btnList: [initial],
    views: h.views(),
    appId: 'app',
    worksheetId: 'sheet',
    getSheetBtns: () => events.push(['reload']),
    onChange: value => events.push(['change', value]),
    ...provided,
  };
  function render() {
    for (const [i, update] of pending.splice(0)) states[i] = typeof update === 'function' ? update(states[i]) : update;
    cursor = 0;
    return Row(props);
  }
  return {
    render,
    events,
    requests,
    confirms,
    states,
    refs,
    get state() {
      return states[1];
    },
    get props() {
      return props;
    },
    setProps: patch => {
      props = { ...props, ...patch };
    },
    effects: () => {
      effects.splice(0).forEach(fn => fn());
    },
    focus: () => {
      refs[0].current = { focus: () => events.push(['focus']) };
    },
    menu: element => Menu(element.props),
    more: element => new More(element.props),
    list: props => List(props),
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function menuRow(s, root = s.render()) {
  const actual = s.menu(nodes(root, 'CustomMenu')[0]);
  return { trigger: actual, instance: s.more(actual.props.popup) };
}
function clickMenu(s, label, root = s.render()) {
  const m = menuRow(s, root),
    entry = nodes(m.instance.render(), 'li').find(x => [tree(x.props.children)].flat().some(value => value === label));
  assert.ok(entry, label);
  entry.props.onClick({ stopPropagation: () => s.events.push(['stop']) });
  return m;
}
module.exports = {
  ROOT,
  BASE,
  ROW,
  MENU,
  MORE,
  LIST,
  old,
  current,
  compile,
  tree,
  nodes,
  renderer,
  settle,
  menuRow,
  clickMenu,
  range: h,
};
