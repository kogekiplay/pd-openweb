/** Real complete controller/List/Header/API, real merge/clone/helper/feature/upgrade code; host and transport isolated. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const h = require('./buttonRowLoader.ts'),
  React = require('react'),
  _ = require('lodash');
const { ROOT, compile, nodes, tree } = h,
  BASE = '693870e1737f35457c6397a54c78270852fd28cb';
const MAIN = 'src/pages/FormSet/containers/CustomBtnFormSet/index.tsx',
  LIST = 'src/pages/FormSet/containers/CustomBtnFormSet/List.tsx',
  HEADER = 'src/pages/FormSet/containers/CustomBtnFormSet/Header.tsx',
  UTIL = 'src/pages/FormSet/util.ts';
const hashes = {
  [MAIN]: 'eb38dd55ee2c0b3d6c9684f1007c60f0039adcc655d2095800baf8a8c0674b3b',
  [LIST]: '0048b0c7151f8f48cce6e7ce7b67ebca22eccf174ce9f4bd0d53de8f5bbff889',
  [HEADER]: '4716817ecd37374c4e942e0dce8503a491546e7dd16a15f0ecc89e89f809857d',
  [UTIL]: '25ba5af6fc5c0bbbdbc9b51a976168e1a5e362f560db8674a206675d1c9e2d03',
};
const old = {},
  current = {};
for (const rel of [MAIN, LIST, HEADER, UTIL]) {
  old[rel] = cp.execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(crypto.createHash('sha256').update(old[rel]).digest('hex'), hashes[rel]);
  current[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
const declaration = h.range.declaration;
function moduleCode(rel) {
  return compile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel);
}
function extract(rel, name) {
  return compile(declaration(fs.readFileSync(path.join(ROOT, rel), 'utf8'), name), rel);
}
const apiCode = moduleCode('src/api/worksheet.ts'),
  projectTypesCode = moduleCode('src/utils/projectTypes.ts');
const featureCode = ['getCurrentProject', 'getSyncLicenseInfo', 'getFeatureStatus']
  .map(n => extract('src/utils/project.ts', n))
  .join('\n');
const upgradeCode = ['upgradeVersionDialog', 'buriedUpgradeVersionDialog']
  .map(n => extract('src/components/upgradeVersion/index.tsx', n))
  .join('\n');
const complexCode = extract('src/pages/worksheet/common/WorkSheetFilter/util.ts', 'redefineComplexControl');
const enumCode = extract('src/utils/enum.ts', 'VersionProductType');
const setStateCode = fs.readFileSync(require.resolve('react-use/lib/useSetState'), 'utf8');
assert.equal(
  crypto.createHash('sha256').update(setStateCode).digest('hex'),
  'fd3c98fa879a695e337796e400249326f83d0b63310f4b2d120d15ed133f3457',
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
    factories.set(k, new Function('module', 'exports', 'require', '_l', 'md', compile(source, rel)));
  return factories.get(k);
}
function helper(source) {
  return new Function(compile(declaration(source, 'refreshBtnData'), UTIL) + ';return refreshBtnData;')();
}
const refreshOld = helper(old[UTIL]),
  refreshCurrent = helper(current[UTIL]);
const projectId = '11111111-1111-1111-1111-111111111111';
function renderer(
  version = 'current',
  provided = {},
  options: {
    abortReject?: boolean;
    featureType?: string | number;
    licenseType?: number;
    shareId?: string;
    overseas?: boolean;
    local?: boolean;
  } = {},
) {
  const source = version === 'old' ? old : current,
    states = [],
    refs = [],
    deps = [],
    callbacks = [],
    effects = [],
    cleanups = [],
    pending = [],
    events = [],
    requests = [],
    dialogs = [];
  let cursor = 0;
  const md = {
    global: {
      Account: {
        projects: [{ projectId, licenseType: options.licenseType ?? 1, version: { versionIdV2: '1' } }],
        externalProjects: [],
        isPortal: false,
      },
      Versions: [
        { VersionIdV2: '1', Products: [{ ProductType: 81, Type: options.featureType ?? '1' }] },
        { VersionIdV2: '2', Products: [{ ProductType: 81, Type: '1' }] },
      ],
    },
  };
  const win = {
    shareState: { shareId: options.shareId },
    platformENV: { isOverseas: !!options.overseas, isLocal: !!options.local },
    isPublicApp: false,
  };
  const translate = (text, ...args) => text.replace(/%(\d+)/g, (_m, i) => String(args[Number(i)]));
  const hooks = {
    ...React,
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], update => pending.push([i, update])];
    },
    useRef: initial => {
      const i = cursor++;
      if (!(i in refs)) refs[i] = { current: initial };
      return refs[i];
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
        effects.push([i, fn]);
      }
    },
  };
  const merged: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'require', setStateCode)(merged, merged.exports, n => {
    assert.equal(n, 'react');
    return hooks;
  });
  const transport = (service, method, args, opts) => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    const request = { service, method, args, options: opts, resolve, reject, abortCount: 0 };
    Object.assign(promise, {
      abort: () => {
        request.abortCount++;
        events.push(['abort', requests.indexOf(request)]);
        if (options.abortReject) reject(Error('aborted'));
      },
    });
    requests.push(request);
    events.push(['request', service, method, args]);
    return promise;
  };
  const api: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', 'mdyAPI', apiCode)(api, api.exports, transport);
  const dec: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', projectTypesCode)(dec, dec.exports);
  const enumValues = new Function(enumCode + ';return VersionProductType;')();
  // Use the actual enum; the fixture's configured product follows its actual recycle value.
  md.global.Versions.forEach(v =>
    v.Products.forEach(p => {
      p.ProductType = enumValues.recycle;
    }),
  );
  const projectApi = {
    getProjectLicenseInfo: () => {
      throw Error('Unexpected sync license network request');
    },
  };
  const features = new Function(
    '_',
    'get',
    'md',
    'window',
    'projectAjax',
    ...['decodeProjects', 'decodeProjectInfo', 'decodeFeatureVersions'],
    featureCode + ';return {getFeatureStatus,getCurrentProject,getSyncLicenseInfo};',
  )(
    _,
    _.get,
    md,
    win,
    projectApi,
    dec.exports.decodeProjects,
    dec.exports.decodeProjectInfo,
    dec.exports.decodeFeatureVersions,
  );
  const Dialog = leaf('Dialog');
  Dialog.confirm = value => {
    dialogs.push(value);
    events.push(['dialog', value]);
    return undefined;
  };
  const upgrades = new Function(
    '_',
    'md',
    'window',
    '_l',
    'require',
    'Dialog',
    'getCurrentProject',
    'getSyncLicenseInfo',
    upgradeCode + ';return {buriedUpgradeVersionDialog};',
  )(
    _,
    md,
    win,
    translate,
    n => {
      assert.equal(n, 'react/jsx-runtime');
      return require(n);
    },
    Dialog,
    features.getCurrentProject,
    features.getSyncLicenseInfo,
  );
  const complex = new Function('_', complexCode + ';return redefineComplexControl;')(_);
  function load(rel) {
    const mod: { exports: Record<string, any> } = { exports: {} };
    factory(source[rel], rel)(
      mod,
      mod.exports,
      n => {
        if (n === 'react') return hooks;
        if (n === 'react/jsx-runtime' || n === 'lodash' || n === 'classnames') return require(n);
        if (n === 'react-use') return { useSetState: merged.exports.default };
        if (n === 'src/api/worksheet') return api.exports;
        if (n === 'src/pages/FormSet/util') return { refreshBtnData: version === 'old' ? refreshOld : refreshCurrent };
        if (n === 'worksheet/common/WorkSheetFilter/util') return { redefineComplexControl: complex };
        if (n === 'src/utils/project') return features;
        if (n === 'src/utils/enum') return { VersionProductType: enumValues };
        if (n === 'src/components/upgradeVersion') return upgrades;
        if (n === 'ming-ui') return { Icon: leaf('Icon'), UpgradeIcon: leaf('UpgradeIcon') };
        if (n === './Header') return leaf('Header');
        if (n === './List') return leaf('List');
        if (n === './SearchBox') return leaf('SearchBox');
        if (n === '../../components/Trash') return leaf('Trash');
        if (n === 'worksheet/common/CreateCustomBtn') return leaf('CreateCustomBtn');
        if (n === '../../components/BtnTd') return leaf('BtnTd');
        if (n === './style') return { Con: leaf('Con'), ArrowUp: leaf('ArrowUp'), ArrowDown: leaf('ArrowDown') };
        if (n.endsWith('.less')) return {};
        throw Error('Unexpected list dependency ' + n);
      },
      translate,
      md,
    );
    return mod.exports.default;
  }
  const Main = load(MAIN),
    List = load(LIST),
    Header = load(HEADER);
  let props = {
    worksheetId: 'sheet',
    worksheetControls: [],
    worksheetInfo: { appId: 'app', projectId, views: [] },
    ...provided,
  };
  function render() {
    for (const [i, next] of pending.splice(0)) states[i] = typeof next === 'function' ? next(states[i]) : next;
    cursor = 0;
    return Main(props);
  }
  return {
    render,
    events,
    requests,
    dialogs,
    md,
    win,
    enumValues,
    features,
    upgrades,
    get state() {
      return states[0];
    },
    get props() {
      return props;
    },
    setProps: patch => {
      props = { ...props, ...patch };
    },
    effects: () => {
      effects.splice(0).forEach(([i, fn]) => {
        if (cleanups[i]) cleanups[i]();
        cleanups[i] = fn();
      });
    },
    unmount: () => {
      for (const c of cleanups) if (c) c();
    },
    list: element => List(element.props),
    header: element => Header(element.props),
    directList: props => List(props),
  };
}
module.exports = {
  ROOT,
  BASE,
  MAIN,
  LIST,
  HEADER,
  UTIL,
  old,
  current,
  compile,
  nodes,
  tree,
  renderer,
  refreshOld,
  refreshCurrent,
  settle: h.settle,
  row: h,
  projectId,
};
