/** Actual complete print row/menu, real filter harness/helpers/cloud function; UI, selection, jquery and transport controlled. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const h = require('./buttonRowLoader.ts'),
  React = require('react'),
  _ = require('lodash');
const { ROOT, compile, nodes, tree } = h;
const BASE = '15dc6948ded42d93f0f8229ee19dbe66a53623fb',
  ROW = 'src/pages/FormSet/containers/Print/PrintSortableItem.tsx',
  MENU = 'src/pages/FormSet/components/MoreOption.tsx',
  PARENT = 'src/pages/FormSet/containers/Print/index.tsx',
  RECORD = 'src/utils/record.ts';
const hashes = {
  [ROW]: '4bd9e7486012bf6b75a6f9381976795aa981d032719a8928a7e211225d859087',
  [MENU]: 'd1f423d2d324966b06e1bc38cea496580966dfb6c9f1834e6f300f42b8c41df9',
  [PARENT]: 'ca2c7117d18a73f7ad3572538fcc0f1d4089ce52f403fe04d6b924237f88be22',
  [RECORD]: 'f70c80c9a5f441e2879133f354564e6ca9025b8d36d4105a2a0729d4bd39bc61',
};
const old = {},
  current = {};
for (const rel of [ROW, MENU, PARENT, RECORD]) {
  old[rel] = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(old[rel]).digest('hex'), hashes[rel]);
  current[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
const declaration = h.range.declaration;
function code(rel) {
  return compile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel);
}
function declarations(rel, names) {
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return names.map(n => declaration(source, n)).join('\n');
}
const filterSpec = 'src/pages/FormSet/components/columnRules/config.spec.ts',
  filterSource = fs.readFileSync(path.join(ROOT, filterSpec), 'utf8');
assert.equal(
  crypto.createHash('sha256').update(filterSource).digest('hex'),
  'f28fc97b28805f7aa34dd8d73ff3f9f087383c65bafe843ea46ca86e66aab35e',
);
const end = filterSource.indexOf('const previous = beforeRev ?');
assert.ok(end > 0);
// Reuse the existing real-module dependency setup, stopping before its spec cases.
const filters = new Function(
  'require',
  '__dirname',
  'process',
  compile(filterSource.slice(0, end), filterSpec) + ';return {rules:current,filterUtils};',
)(
  require('node:module').createRequire(path.join(ROOT, filterSpec)),
  path.join(ROOT, 'src/pages/FormSet/components/columnRules'),
  { env: {} },
);
const constants = new Function(
  '_l',
  compile(
    declarations('src/pages/Print/core/config.ts', ['PRINT_TYPE', 'PRINT_TYPE_STYLE']),
    'src/pages/Print/core/config.ts',
  ) + ';return {PRINT_TYPE,PRINT_TYPE_STYLE};',
)(s => s);
const cardCode = code('src/pages/worksheet/common/PrintQrBarCode/enum.ts'),
  apiCode = code('src/api/worksheet.ts');
const versionTypes = new Function(
  compile(declarations('src/utils/enum.ts', ['VersionProductType']), 'src/utils/enum.ts') +
    ';return VersionProductType;',
)();
const cloudCode = {
  old: compile(declaration(old[RECORD], 'sendCloudPrint'), RECORD),
  current: compile(declaration(current[RECORD], 'sendCloudPrint'), RECORD),
};
const leaves = new Map(),
  factories = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const c = () => null;
    c.displayName = name;
    leaves.set(name, c);
  }
  return leaves.get(name);
}
function factory(source, rel) {
  const key = source + rel;
  if (!factories.has(key))
    factories.set(
      key,
      new Function('module', 'exports', 'require', '_l', 'alert', '$', 'document', compile(source, rel)),
    );
  return factories.get(key);
}
function item(extra = {}) {
  return {
    id: 'print',
    name: 'Template',
    type: 0,
    range: 3,
    views: [{ viewId: 'v', name: 'View' }],
    filters: [],
    ...extra,
  };
}
function renderer(version = 'current', provided = {}, options: { inputExists?: boolean; cloudFeature?: string } = {}) {
  const source = version === 'old' ? old : current,
    states = [],
    refs = [],
    deps = [],
    effects = [],
    pending = [],
    events = [],
    requests = [],
    confirms = [],
    selections = [];
  let cursor = 0;
  const hooks = {
    ...React,
    useRef: initial => {
      const i = cursor++;
      if (!(i in refs)) refs[i] = { current: initial };
      return refs[i];
    },
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], next => pending.push([i, next])];
    },
    useEffect: (fn, next) => {
      const i = cursor++;
      if (!deps[i] || next.some((x, j) => !Object.is(x, deps[i][j]))) {
        deps[i] = next;
        effects.push(fn);
      }
    },
  };
  const translate = (text, ...args) => text.replace(/%(\d+)/g, (_m, i) => String(args[Number(i)]));
  const alerts = (...args) => events.push(['alert', ...args]);
  const transport = (service, method, args, opts) => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options: opts, resolve, reject });
    events.push(['request', service, method, args]);
    return promise;
  };
  const api: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'mdyAPI', apiCode)(api, api.exports, transport);
  const cloud = new Function(
    'worksheetAjax',
    'getFeatureStatus',
    'VersionProductType',
    'buriedUpgradeVersionDialog',
    '_',
    'alert',
    '_l',
    cloudCode[version] + ';return sendCloudPrint;',
  )(
    api.exports.default,
    () => options.cloudFeature || '1',
    versionTypes,
    (...args) => events.push(['upgrade', ...args]),
    _,
    alerts,
    translate,
  );
  const jquery = target => {
    events.push(['jquery', typeof target === 'string' ? target : 'ref']);
    return { 0: options.inputExists ? {} : undefined, focus: () => events.push(['jquery-focus']) };
  };
  const Dialog = leaf('Dialog');
  Dialog.confirm = value => {
    confirms.push(value);
    events.push(['confirm']);
    return () => events.push(['confirm-close']);
  };
  const card: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'require', '_l', cardCode)(
    card,
    card.exports,
    n => {
      assert.equal(n, 'lodash');
      return _;
    },
    translate,
  );
  const More: { exports: Record<string, any> } = { exports: {} };
  factory(source[MENU], MENU)(
    More,
    More.exports,
    n => {
      if (n === 'react') return React;
      if (n === 'react/jsx-runtime') return require(n);
      if (n === 'ming-ui') return { Dialog, Icon: leaf('Icon') };
      if (n === 'ming-ui/components/ClickAway') return { wrap: C => C };
      throw Error(n);
    },
    translate,
    alerts,
    jquery,
    {},
  );
  const mod: { exports: Record<string, any> } = { exports: {} };
  factory(source[ROW], ROW)(
    mod,
    mod.exports,
    n => {
      if (n === 'react') return hooks;
      if (n === 'react/jsx-runtime' || n === 'lodash') return require(n);
      if (n === '@rc-component/trigger') return leaf('Trigger');
      if (n === 'ming-ui') return { Icon: leaf('Icon') };
      if (n === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
      if (n === 'src/api/worksheet') return api.exports;
      if (n === 'worksheet/common/PrintQrBarCode') return { printQrBarCode: value => events.push(['qr', value]) };
      if (n === 'worksheet/common/WorkSheetFilter/util') return filters.filterUtils;
      if (n === 'src/components/SelectRecords')
        return {
          selectRecords: value => {
            selections.push(value);
            events.push(['select']);
          },
        };
      if (n === 'src/pages/FormSet/components/columnRules/config.js') return filters.rules;
      if (n === 'src/pages/Print/core/config') return constants;
      if (n === 'src/pages/worksheet/common/CreateCustomBtn/components/ShowBtnFilterDialog.jsx')
        return leaf('FilterDialog');
      if (n === 'src/pages/worksheet/common/PrintQrBarCode/enum') return card.exports;
      if (n === 'src/utils/record') return { sendCloudPrint: cloud };
      if (n === '../../components/MoreOption') return leaf('MoreOption');
      if (n === '../../components/RangeDrop') return leaf('RangeDrop');
      if (n === './components/PrintCountSetting') return { PrintCountLimitModal: leaf('CountModal') };
      throw Error('Unexpected print dependency ' + n);
    },
    translate,
    alerts,
    jquery,
    { body: { host: 'body' } },
  );
  let props = {
    item: item(),
    worksheetInfo: { worksheetId: 'sheet', projectId: 'project', appId: 'app', views: [], template: { controls: [] } },
    worksheetControls: [],
    updatePrint: (...args) => events.push(['update', ...args]),
    changeState: value => events.push(['dialog-state', value]),
    loadPrint: value => events.push(['load', value]),
    DragHandle: leaf('DragHandle'),
    ...provided,
  };
  function render() {
    for (const [i, next] of pending.splice(0)) states[i] = typeof next === 'function' ? next(states[i]) : next;
    cursor = 0;
    return mod.exports.default(props);
  }
  return {
    render,
    states,
    refs,
    events,
    requests,
    confirms,
    selections,
    constants,
    cloud,
    get props() {
      return props;
    },
    setProps: next => {
      props = { ...props, ...next };
    },
    effects: () => effects.splice(0).forEach(fn => fn()),
    focus: () => {
      refs[0].current = { focus: () => events.push(['focus']) };
    },
    more: element => new More.exports.default(element.props),
    range: element => h.range.printInstance(h.range.print, element.props),
  };
}
function menu(s, root = s.render()) {
  return nodes(root, 'MoreOption')[0];
}
function clickMenu(s, label, root = s.render()) {
  const instance = s.more(menu(s, root));
  const entry = nodes(instance.render(), 'li').find(x => [tree(x.props.children)].flat().includes(label));
  assert.ok(entry, label);
  entry.props.onClick({ stopPropagation: () => s.events.push(['stop']) });
  return instance;
}
module.exports = {
  ROOT,
  BASE,
  ROW,
  MENU,
  PARENT,
  RECORD,
  old,
  current,
  compile,
  nodes,
  tree,
  renderer,
  item,
  menu,
  clickMenu,
  settle: h.settle,
};
