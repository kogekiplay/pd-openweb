/** Full actual historical/current editor/settings/link APIs and uploader; only DOM, hooks, credentials and transport are controlled. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const { ROOT, transformSync } = require('../spec-harness.ts'),
  parser = require('@babel/parser'),
  React = require('react'),
  _ = require('lodash');
const range = require('./rangeDropdownLoader.ts'),
  features = require('./customButtonListLoader.ts');
const BASE = 'e3755c219cf5d32c53eabe259a26524963900c36',
  MAIN = 'src/pages/FormSet/components/EditPrint.tsx',
  SETTINGS = 'src/pages/FormSet/components/PrintTemSetting/index.tsx',
  LINK = 'src/pages/UploadTemplateSheet/utils.ts',
  ATTACH = 'src/api/attachment.ts';
const old = {},
  current = {},
  hashes = {
    [MAIN]: '818631ceb4fd888496ed44db11b67f57908a27d8cf246393c9ae588e17b63141',
    [SETTINGS]: 'caf598654b46521f37f4198de10616f9fcef3c61d394fc3434c1f85b6cb2a5c3',
    [LINK]: '3d1672e15477ea02fdbf7b6b7c663458c95fb4ae9889b78a57c9e2ebf8d77516',
    [ATTACH]: 'a7053b260112c80f9b1480df4cb109d7e0e788523b20d06f501a034e42e5c372',
  };
for (const f of [MAIN, SETTINGS, LINK, ATTACH]) {
  old[f] = cp.execFileSync('git', ['show', `${BASE}:${f}`], { cwd: ROOT, encoding: 'utf8' });
  current[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert.equal(crypto.createHash('sha256').update(old[f]).digest('hex'), hashes[f]);
}
const codeCache = new Map<string, string>();
const compile = (source, rel) => {
  const key = rel + source;
  if (!codeCache.has(key))
    codeCache.set(key, transformSync(source, { filename: path.join(ROOT, rel), comments: false }).code);
  return codeCache.get(key);
};

function take(source, name) {
  const node = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] }).program.body.find(n => {
    const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    return (
      d &&
      ((d.type === 'FunctionDeclaration' && d.body && d.id.name === name) ||
        (d.type === 'VariableDeclaration' && d.declarations.some(x => x.id.name === name)))
    );
  });
  assert.ok(node, name);
  return source.slice(node.start, node.end).replace(/^export /, '');
}
const text = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const common = text('src/utils/common.ts'),
  control = text('src/utils/control.ts'),
  controlCommon = text('src/utils/controlCommon.ts'),
  widgetSetting = text('src/pages/widgetConfig/util/advancedSettingBoundary.ts');
const leaves = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const C = () => null;
    C.displayName = name;
    leaves.set(name, C);
  }
  return leaves.get(name);
}
class Clock extends Date {
  constructor(value = 1792368000000) {
    super(value);
  }
  static now() {
    return 1792368000000;
  }
}
function instance(
  version = 'current',
  provided = {},
  options: { featureType?: string | number; docEdit?: boolean; subPath?: string; search?: string } = {},
) {
  const sources = version === 'old' ? old : current,
    events = [],
    requests = [],
    uploads = [],
    uploaders = [],
    tokens = [],
    forms = [],
    consoleEvents = [];
  const feature = features.renderer('current', {}, {});
  feature.md.global.Versions.forEach(v =>
    v.Products.push({ ProductType: feature.enumValues.editAttachment, Type: options.featureType ?? '1' }),
  );
  const md = feature.md;
  md.global.Account.accountId = 'account';
  md.global.Config = { ...(md.global.Config || {}), EnableDocEdit: options.docEdit };
  md.global.FileStoreConfig = { documentHost: 'https://doc.invalid', uploadHost: 'https://up.invalid' };
  md.global.SysSettings = { fileUploadLimitSize: 100 };
  const win = { ...feature.win, md, subPath: options.subPath || '', open: url => events.push(['open', url]) },
    location = { origin: 'https://app.invalid', search: options.search || '' };
  const translate = (s, ...args) => s.replace(/%(\d+)/g, (_m, i) => String(args[Number(i)]));
  const consoleHost = {
    log: (...args) => consoleEvents.push(args.map(x => (x instanceof Error ? [x.name, x.message] : x))),
    error: (...args) => consoleEvents.push(args.map(x => (x instanceof Error ? [x.name, x.message] : x))),
  };
  function element(tag) {
    const node = {
      tag,
      style: {},
      attrs: {},
      children: [],
      listeners: {},
      parentNode: null,
      addEventListener(name, fn) {
        (this.listeners[name] ??= []).push(fn);
        events.push(['listen', tag, name]);
      },
      removeEventListener(name, fn) {
        this.listeners[name] = (this.listeners[name] || []).filter(v => v !== fn);
        events.push(['unlisten', tag, name]);
      },
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        events.push(['append', tag, child.tag]);
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter(v => v !== child);
        child.parentNode = null;
        events.push(['remove', tag, child.tag]);
      },
      setAttribute(key, value) {
        this.attrs[key] = String(value);
        events.push(['attribute', tag, key, String(value)]);
      },
      click() {
        events.push(['click', tag]);
      },
      submit() {
        forms.push({ attrs: { ...this.attrs }, children: this.children.map(c => ({ attrs: { ...c.attrs } })) });
        events.push(['submit', this.attrs.action]);
      },
    };
    return node;
  }
  const browse = element('browse'),
    con = element('p'),
    body = element('body'),
    doc = { body, createElement: tag => element(tag), getElementById: id => (id === 'editorFiles' ? browse : null) };
  const navigator = { userActivation: { isActive: true }, userAgent: 'desktop' };
  const transport = (service, method, args, opts) => {
    let resolve, reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    requests.push({ service, method, args, options: opts, resolve, reject });
    events.push(['request', service, method, args, opts]);
    return promise;
  };
  win.mdyAPI = transport;
  const moduleCache = new Map();
  function execute(source, rel, dependency) {
    const m: { exports: Record<string, any> } = { exports: {} };
    new Function(
      'module',
      'exports',
      'require',
      '_l',
      'md',
      'window',
      'alert',
      'document',
      'location',
      'navigator',
      'Date',
      'console',
      '$',
      compile(source, rel),
    )(
      m,
      m.exports,
      dependency,
      translate,
      md,
      win,
      (...args) => events.push(['alert', ...args]),
      doc,
      location,
      navigator,
      Clock,
      consoleHost,
      selector => ({ click: () => events.push(['jquery-click', selector]) }),
    );
    return m.exports;
  }
  function api(rel) {
    return execute(text(rel), rel, name => {
      throw Error('Unexpected API dependency ' + name);
    });
  }
  // API objects call the same in-memory transport as window.mdyAPI.
  function apiModule(source, rel) {
    const m: { exports: Record<string, any> } = { exports: {} };
    new Function('module', 'exports', 'mdyAPI', compile(source, rel))(m, m.exports, transport);
    return m.exports;
  }
  const attachment = apiModule(sources[ATTACH], ATTACH),
    worksheet = apiModule(text('src/api/worksheet.ts'), 'src/api/worksheet.ts'),
    app = apiModule(text('src/api/appManagement.ts'), 'src/api/appManagement.ts');
  const regexp = execute(text('src/utils/expression.ts'), 'src/utils/expression.ts', require).default;
  function sdk(rel) {
    if (moduleCache.has(rel)) return moduleCache.get(rel);
    let src = text(rel);
    const m = execute(src, rel, name => {
      if (name === 'lodash') return _;
      if (name === 'src/utils/expression') return { __esModule: true, default: regexp };
      if (name === 'src/utils/common')
        return {
          getToken: (files, type, args) => {
            tokens.push([files, type, args]);
            return Promise.resolve(
              files.map((f, i) => ({
                uptoken: 'fixture-token',
                key: 'server/file.' + f.ext.slice(1),
                serverName: 'https://doc.invalid/',
                fileName: 'server.' + f.ext.slice(1),
              })),
            );
          },
        };
      if (name === './uploader/qiniuV1')
        return {
          uploadToQiniu: (params, handlers) => {
            const entry = { params, handlers, aborted: false };
            uploads.push(entry);
            events.push(['upload', params.fname, params.key]);
            return {
              abort: () => {
                entry.aborted = true;
                events.push(['abort', params.fname]);
              },
            };
          },
        };
      if (name === 'src/utils/commonRequestBoundary') return sdk('src/utils/commonRequestBoundary.ts');
      if (name.startsWith('.'))
        return sdk(path.posix.normalize(path.posix.join(path.posix.dirname(rel), name + '.ts')));
      throw Error('Unexpected uploader dependency ' + name);
    });
    moduleCache.set(rel, m);
    return m;
  }
  const uploaderSdk = sdk('src/utils/createUploader.ts');
  const createUploader = option => {
    const u = uploaderSdk.default(option);
    uploaders.push({ option, u });
    events.push(['uploader', uploaders.length]);
    return u;
  };
  const commonHelpers = [
    'getCurrentSubPath',
    'hasSubPath',
    'getPathWithSubPath',
    'getAppFeaturesVisible',
    'getAppFeaturesPath',
    'browserIsMobile',
    'pathCompletion',
  ]
    .map(n => take(common, n))
    .join('\n');
  const pathCompletion = new Function(
    '_',
    'qs',
    'window',
    'location',
    'navigator',
    compile(commonHelpers, 'src/utils/common.ts') + ';return pathCompletion;',
  )(_, require('query-string').default, win, location, navigator);
  const readSetting = new Function(
    '_',
    'get',
    compile(take(controlCommon, 'getAdvanceSetting'), 'src/utils/controlCommon.ts') + ';return getAdvanceSetting;',
  )(_, _.get);
  const getAdvanceSetting = new Function(
    'readSetting',
    compile(take(widgetSetting, 'getWidgetAdvanceSetting'), 'src/pages/widgetConfig/util/advancedSettingBoundary.ts') +
      ';return getWidgetAdvanceSetting;',
  )(readSetting);
  const transferValue = new Function(
    '_',
    compile(
      take(controlCommon, 'FIELD_REG_EXP') + '\n' + take(controlCommon, 'transferValue'),
      'src/utils/controlCommon.ts',
    ) + ';return transferValue;',
  )(_);
  const renderCellText = new Function(
    '_',
    '_l',
    'safeParse',
    'console',
    compile(
      ['stringCellList', 'stringUnitCellList', 'checkIsTextControl', 'renderText']
        .map(n => take(control, n))
        .join('\n'),
      'src/utils/control.ts',
    ) + ';return renderText;',
  )(_, translate, range.safeParse, consoleHost);
  function requireProduct(name) {
    if (name === 'react' || name === 'react/jsx-runtime' || name === 'classnames' || name === 'moment')
      return require(name);
    if (name === 'lodash') return _;
    if (name === 'react-redux') return require('react-redux');
    if (name === 'src/api/appManagement') return app;
    if (name === 'src/api/attachment') return attachment;
    if (name === 'src/api/worksheet') return worksheet;
    if (name === 'src/utils/createUploader') return { __esModule: true, default: createUploader };
    if (name === 'src/utils/expression') return { __esModule: true, default: regexp };
    if (name === 'src/utils/enum') return { VersionProductType: feature.enumValues };
    if (name === 'src/utils/project') return { getFeatureStatus: feature.features.getFeatureStatus };
    if (name === 'src/utils/common') return { pathCompletion };
    if (name === 'src/pages/UploadTemplateSheet/utils') return link;
    if (name === './PrintTemSetting') return leaf('PrintTemSetting');
    if (name === './DrawerFooter') return leaf('DrawerFooter');
    if (name === '@rc-component/trigger') return leaf('Trigger');
    if (name === 'ming-ui')
      return Object.fromEntries(
        ['Icon', 'LoadDiv', 'Menu', 'MenuItem', 'Input', 'Checkbox', 'Radio'].map(n => [n, leaf(n)]),
      );
    if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
    if (name === 'styled-components') return { __esModule: true, default: { div: () => leaf('DefaultName') } };
    if (name === 'src/pages/widgetConfig/util/setting') return { getAdvanceSetting };
    if (name === 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue')
      return leaf('DynamicDefaultValue');
    if (name === 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util') return { transferValue };
    if (name === 'src/utils/control') return { renderText: renderCellText };
    if (name.endsWith('.less')) return {};
    throw Error('Unexpected editor dependency ' + name);
  }
  const link = execute(sources[LINK], LINK, requireProduct);
  const mod = execute(sources[MAIN], MAIN, requireProduct);
  const props = {
    type: 'new',
    worksheetId: 'sheet',
    worksheetName: 'Sheet',
    downLoadUrl: 'https://download.invalid',
    templateId: undefined,
    fileType: 'Word',
    roleType: 2,
    projectId: features.projectId,
    controls: [],
    exampleData: {},
    updateExampleData: value => events.push(['example', value]),
    refreshFn: (...args) => events.push(['refresh', ...args]),
    onClose: () => events.push(['close']),
    ...provided,
  };
  const instance = new mod.default(props);
  instance.props = props;
  instance.setState = (update, callback) => {
    const patch = typeof update === 'function' ? update(instance.state, instance.props) : update;
    instance.state = { ...instance.state, ...patch };
    events.push(['state', patch]);
    if (callback) callback();
  };
  const bind = () => {
    range
      .nodes(instance.render(), 'p')
      .find(n => n.props.className.includes('uploadBtn'))
      .props.ref(con);
  };
  function settings(overrides = {}) {
    const effects = [];
    let first = true;
    let p = { ...range.nodes(instance.render(), 'PrintTemSetting')[0].props, ...overrides };
    const hooks = {
      ...React,
      useEffect: fn => {
        if (first) effects.push(fn);
      },
    };
    const settingsMod = execute(sources[SETTINGS], SETTINGS, name => (name === 'react' ? hooks : requireProduct(name)));
    // safeParse is a real global helper. Bind only its host, retaining native failure/fallback semantics.
    const originalSafe = globalThis.safeParse;
    globalThis.safeParse = range.safeParse;
    return {
      render: () => {
        const t = settingsMod.default(p);
        first = false;
        return t;
      },
      effects: () => {
        for (const f of effects.splice(0)) f();
      },
      setProps: patch => {
        p = { ...p, ...patch };
      },
      restore: () => {
        globalThis.safeParse = originalSafe;
      },
    };
  }
  return {
    instance,
    props,
    events,
    requests,
    uploads,
    uploaders,
    tokens,
    forms,
    consoleEvents,
    con,
    browse,
    doc,
    md,
    win,
    bind,
    mount: () => {
      bind();
      instance.componentDidMount();
    },
    setProps: patch => {
      const previous = instance.props;
      instance.props = { ...instance.props, ...patch };
      instance.componentDidUpdate(previous);
    },
    settings,
    link: link.createEditFileLink,
    render: () => instance.render(),
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
module.exports = {
  ROOT,
  BASE,
  MAIN,
  SETTINGS,
  LINK,
  ATTACH,
  old,
  current,
  hashes,
  instance,
  tick,
  nodes: range.nodes,
  tree: range.tree,
  outcome: range.outcome,
};
