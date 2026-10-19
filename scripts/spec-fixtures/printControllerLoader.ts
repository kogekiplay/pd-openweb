/** Actual full print controller/drawer/count card/API; feature host reused, React/modal/network leaves controlled. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const row = require('./printItemLoader.ts'),
  featureHost = require('./customButtonListLoader.ts'),
  React = require('react');
const { ROOT, compile, nodes, tree } = row,
  BASE = '51e39c44ba29ab03009b67996f38fff59cb48c2c',
  MAIN = 'src/pages/FormSet/containers/Print/index.tsx',
  CARD = 'src/pages/FormSet/containers/Print/components/PrintCountSetting/index.tsx';
const hashes = {
  [MAIN]: '04f4bc8665861a4ac37045c6c06e1518b2ed500d0107e649ffb695805be187cc',
  [CARD]: 'a1b914b39902e80e5f6b7b567f89e346ba1496bfdcebd12b2b342c048526d41f',
};
const old = {},
  current = {};
for (const rel of [MAIN, CARD]) {
  old[rel] = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(old[rel]).digest('hex'), hashes[rel]);
  current[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
const apiCode = compile(fs.readFileSync(path.join(ROOT, 'src/api/worksheet.ts'), 'utf8'), 'src/api/worksheet.ts'),
  integrationCode = compile(
    fs.readFileSync(path.join(ROOT, 'src/api/systemIntegration.ts'), 'utf8'),
    'src/api/systemIntegration.ts',
  );
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
function factory(source, rel) {
  const k = rel + source;
  if (!factories.has(k))
    factories.set(
      k,
      new Function(
        'module',
        'exports',
        'require',
        '_l',
        'md',
        'window',
        'alert',
        compile(source, rel) + (rel === MAIN ? ';exports.__drawer=CreatePrintDrawer;' : ''),
      ),
    );
  return factories.get(k);
}
function instance(
  version = 'current',
  provided = {},
  options: { featureType?: string | number; overseas?: boolean; countFeature?: string | number } = {},
) {
  const source = version === 'old' ? old : current,
    events = [],
    requests = [],
    bindings = [];
  const host = featureHost.renderer(
    'current',
    {},
    { featureType: options.featureType ?? '1', overseas: options.overseas },
  );
  host.md.global.Versions.forEach(version =>
    version.Products.push({ ProductType: host.enumValues.wordPrintTemplate, Type: options.featureType ?? '1' }),
  );
  const feature = (project, id) =>
    id === host.enumValues.printCountLimit
      ? (options.countFeature ?? '1')
      : host.features.getFeatureStatus(project, id);
  const translate = (text, ...args) => text.replace(/%(\d+)/g, (_m, i) => String(args[Number(i)]));
  const transport = (service, method, args, opts) => {
    let resolve, reject;
    const p = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options: opts, resolve, reject });
    events.push(['request', service, method, args]);
    return p;
  };
  function api(code) {
    const m: { exports: Record<string, any> } = { exports: {} };
    new Function('module', 'exports', 'mdyAPI', code)(m, m.exports, transport);
    return m.exports;
  }
  const worksheet = api(apiCode),
    integration = api(integrationCode);
  const mod: { exports: Record<string, any> } = { exports: {} };
  factory(source[MAIN], MAIN)(
    mod,
    mod.exports,
    n => {
      if (n === 'react' || n === 'react/jsx-runtime' || n === 'lodash') return require(n);
      if (n === 'antd') return { Drawer: leaf('Drawer') };
      if (n === 'ming-ui')
        return Object.fromEntries(['Icon', 'LoadDiv', 'SortableList', 'Support', 'UpgradeIcon'].map(x => [x, leaf(x)]));
      if (n === 'src/api/systemIntegration') return integration;
      if (n === 'src/api/worksheet') return worksheet;
      if (n === 'worksheet/common/PrintQrBarCode') return { printQrBarCode: args => events.push(['qr', args]) };
      if (n === 'src/components/upgradeVersion')
        return {
          buriedUpgradeVersionDialog: (...args) => {
            events.push(['upgrade', ...args]);
            return host.upgrades.buriedUpgradeVersionDialog(...args);
          },
        };
      if (n === 'src/pages/Print/core/config') return row.renderer('current').constants;
      if (n === 'src/utils/enum') return { VersionProductType: host.enumValues };
      if (n === 'src/utils/project') return { getFeatureStatus: feature };
      if (n === '../../components/CloudPrint') return leaf('CloudPrint');
      if (n === '../../components/EditPrint') return leaf('EditPrint');
      if (n === '../../components/PrintTemDialog') return leaf('PrintTemDialog');
      if (n === './assets/kuaimai.png') return 'fixture-kuaimai.png';
      if (n === './BindKuaiMaiDialog')
        return args => {
          bindings.push(args);
          events.push(['bind', args]);
        };
      if (n === './components/PrintCountSetting') return { PrintCountSettingCard: leaf('CountCard') };
      if (n === './PrintSortableItem') return leaf('PrintRow');
      if (n.endsWith('.less')) return {};
      throw Error('Unexpected controller dependency ' + n);
    },
    translate,
    host.md,
    host.win,
    (...args) => events.push(['alert', ...args]),
  );
  const props = {
    worksheetId: 'sheet',
    worksheetInfo: { worksheetId: 'sheet', appId: 'app', projectId: featureHost.projectId, name: 'Sheet', views: [] },
    worksheetControls: [],
    onChange: value => events.push(['change', value]),
    ...provided,
  };
  const controller = new mod.exports.default(props);
  controller.setState = (patch, callback) => {
    events.push(['state', patch]);
    Object.assign(controller.state, typeof patch === 'function' ? patch(controller.state, controller.props) : patch);
    if (callback) callback();
  };
  function drawer(element) {
    return new mod.exports.__drawer(element.props);
  }
  function card(element) {
    const states = [],
      refs = [],
      deps = [],
      pending = [],
      effects = [];
    let cursor = 0,
      props = element.props;
    const hooks = {
      ...React,
      useState: initial => {
        const i = cursor++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], next => pending.push([i, next])];
      },
      useRef: initial => {
        const i = cursor++;
        if (!(i in refs)) refs[i] = { current: initial };
        return refs[i];
      },
      useEffect: (fn, next) => {
        const i = cursor++;
        if (!deps[i] || next.some((x, j) => !Object.is(x, deps[i][j]))) {
          deps[i] = next;
          effects.push(fn);
        }
      },
    };
    const m: { exports: Record<string, any> } = { exports: {} };
    factory(source[CARD], CARD)(
      m,
      m.exports,
      n => {
        if (n === 'react') return hooks;
        if (n === 'react/jsx-runtime') return require(n);
        if (n === 'ming-ui/antd-components')
          return Object.fromEntries(['Button', 'InputNumber', 'Modal', 'Switch'].map(x => [x, leaf(x)]));
        if (n === 'src/api/worksheet') return worksheet;
        if (n === 'src/components/upgradeVersion')
          return { buriedUpgradeVersionDialog: (...args) => events.push(['upgrade', ...args]) };
        if (n === 'src/utils/domain/shared/productFeatures') return { VersionProductType: host.enumValues };
        throw Error(n);
      },
      translate,
      host.md,
      host.win,
      (...args) => events.push(['alert', ...args]),
    );
    return {
      render: () => {
        for (const [i, next] of pending.splice(0)) states[i] = typeof next === 'function' ? next(states[i]) : next;
        cursor = 0;
        return m.exports.PrintCountSettingCard(props);
      },
      effects: () => effects.splice(0).forEach(f => f()),
      setProps: value => {
        props = { ...props, ...value };
      },
      states,
      refs,
    };
  }
  return {
    controller,
    events,
    requests,
    bindings,
    host,
    props,
    render: () => controller.render(),
    drawer,
    card,
    row: element => row.renderer(version, element.props),
    createDrawer: props => new mod.exports.__drawer(props),
  };
}
module.exports = {
  ROOT,
  BASE,
  MAIN,
  CARD,
  old,
  current,
  compile,
  nodes,
  tree,
  instance,
  settle: row.settle,
  item: row.item,
};
