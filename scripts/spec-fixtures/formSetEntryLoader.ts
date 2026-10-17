/** Full real entry/API module and real translation functions; controlled hooks/leaves, transport and browser host. */
const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict'),
  parser = require('@babel/parser');
const { ROOT, transformSync } = require('../spec-harness.ts');
const React = require('react'),
  lodash = require('lodash');
const BASE = 'a7266c9b94edf9c0f6d3a00c67df5a4cc241f06f',
  REL = 'src/pages/FormSet/index.tsx';
const previous = cp.execFileSync('git', ['show', `${BASE}:${REL}`], { cwd: ROOT, encoding: 'utf8' });
assert.equal(
  crypto.createHash('sha256').update(previous).digest('hex'),
  'aab6598bbbc68f447270df11110db3fd0d36e593bc9997cd77fae77dffe1f3ea',
);
const current = fs.readFileSync(path.join(ROOT, REL), 'utf8');
const compile = (source, rel = REL) =>
  transformSync(source, { filename: path.join(ROOT, rel), comments: false, compact: true }).code;
const parse = source => parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
function declaration(source, name) {
  const node = parse(source).program.body.find(item => {
    const n = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    return (
      n &&
      (n.type === 'FunctionDeclaration'
        ? n.id?.name === name && n.body
        : n.type === 'VariableDeclaration' && n.declarations.some(d => d.id.name === name))
    );
  });
  assert.ok(node, name);
  return source.slice(node.start, node.end).replace(/^export /, '');
}
const helpers = new Map();
function plain(rel) {
  if (helpers.has(rel)) return helpers.get(rel);
  const mod = { exports: {} };
  new Function('module', 'exports', '_l', compile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel))(
    mod,
    mod.exports,
    x => x,
  );
  helpers.set(rel, mod.exports);
  return mod.exports;
}
const appTypes = plain('src/utils/appTypes.ts');
const translateTypes = plain('src/utils/translateTypes.ts');
const config = plain('src/pages/FormSet/config.ts');
const apiCode = compile(fs.readFileSync(path.join(ROOT, 'src/api/worksheet.ts'), 'utf8'), 'src/api/worksheet.ts');
const appSource = fs.readFileSync(path.join(ROOT, 'src/utils/app.ts'), 'utf8');
const appFunctions = ['getLangDataIndex', 'getTranslateInfo'].map(name => declaration(appSource, name)).join('\n');
const translationCode = compile(
  fs.readFileSync(path.join(ROOT, 'src/utils/translate.ts'), 'utf8'),
  'src/utils/translate.ts',
);
const navSource = fs.readFileSync(path.join(ROOT, 'src/pages/widgetConfig/util/data.tsx'), 'utf8');
const navCode = compile(declaration(navSource, 'navigateToApp'), 'src/pages/widgetConfig/util/data.tsx');
const globalSource = fs.readFileSync(path.join(ROOT, 'src/common/global.ts'), 'utf8');
const safeNode = parse(globalSource).program.body.find(
  n => n.expression?.left?.object?.name === 'window' && n.expression.left.property?.name === 'safeParse',
);
assert.ok(safeNode);
const safeHost: { safeParse?: (value: unknown, fallback?: unknown) => unknown } = {};
new Function('window', 'console', compile(globalSource.slice(safeNode.start, safeNode.end), 'src/common/global.ts'))(
  safeHost,
  { error() {} },
);
const factories = new Map();
function factory(source) {
  if (!factories.has(source))
    factories.set(source, new Function('module', 'exports', 'require', 'window', '$', '_l', compile(source)));
  return factories.get(source);
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
function renderer(
  source,
  provided = {},
  options: { immediate?: boolean; language?: unknown; storage?: string | null } = {},
) {
  const states = [],
    refs = [],
    deps = [],
    callbacks = [],
    pending = [],
    effectQueue = [],
    cleanups = [],
    events = [],
    requests = [];
  let cursor = 0;
  const api: { exports: { default?: unknown } } = { exports: {} };
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
  const win: Record<string, any> = { clearLocalDataTime: args => events.push(['clear-cache', args]) };
  if (options.language !== undefined) win['langData-app'] = options.language;
  const getTranslateInfo = new Function(
    'languageCache',
    'decodeTranslationData',
    'isTranslateInfo',
    compile('const langDataIndexCache=new WeakMap();\n' + appFunctions, 'src/utils/app.ts') +
      ';return getTranslateInfo;',
  )(win, appTypes.decodeTranslationData, appTypes.isTranslateInfo);
  const translations = { exports: {} };
  new Function('module', 'exports', 'require', 'window', 'safeParse', translationCode)(
    translations,
    translations.exports,
    name => {
      if (name === 'lodash') return lodash;
      if (name === 'src/utils/app') return { getTranslateInfo };
      if (name === './translateTypes') return translateTypes;
      throw Error('Uncontrolled translation dependency ' + name);
    },
    win,
    safeHost.safeParse,
  );
  const navigateToApp = new Function(
    'sheetAjax',
    'localStorage',
    'md',
    '_',
    'navigateTo',
    navCode + ';return navigateToApp;',
  )(
    api.exports.default,
    {
      getItem: key => {
        events.push(['storage-read', key]);
        return options.storage ?? null;
      },
    },
    { global: { Account: { accountId: 'account' } } },
    lodash,
    to => events.push(['navigate', to]),
  );
  const hooks = {
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
    useRef: initial => {
      const i = cursor++;
      if (!(i in refs)) refs[i] = { current: initial };
      return refs[i];
    },
    useCallback: (fn, dependencies) => {
      const i = cursor++;
      if (!deps[i] || dependencies.some((value, j) => !Object.is(value, deps[i][j]))) {
        deps[i] = dependencies;
        callbacks[i] = fn;
      }
      return callbacks[i];
    },
    useEffect: (fn, dependencies) => {
      const i = cursor++;
      if (!deps[i] || dependencies.some((value, j) => !Object.is(value, deps[i][j]))) {
        deps[i] = dependencies;
        effectQueue.push([i, fn]);
      }
    },
  };
  const mod: { exports: Record<string, any> } = { exports: {} };
  factory(source)(
    mod,
    mod.exports,
    name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'lodash') return lodash;
      if (name === 'src/api/worksheet') return api.exports;
      if (name === 'src/utils/app') return { getTranslateInfo };
      if (name === 'src/utils/translate') return translations.exports;
      if (name === 'src/pages/widgetConfig/util/data') return { navigateToApp };
      if (name === 'src/common/theme') return { AppThemeScope: leaf('AppThemeScope') };
      if (name === './config') return config;
      if (name.endsWith('.less')) return {};
      if (name === 'ming-ui/components/LoadDiv') return leaf('LoadDiv');
      if (name === 'ming-ui/components/DocumentTitle') return leaf('DocumentTitle');
      if (name === 'ming-ui/components/ErrorBoundary') return leaf('ErrorBoundary');
      if (name === 'src/components/errorPage/errorState') return leaf('ErrorState');
      if (name === 'src/components/worksheetConfigHeader') return leaf('Header');
      if (name.startsWith('./containers/')) return leaf(name);
      throw Error('Uncontrolled FormSet dependency ' + name);
    },
    win,
    selector => ({
      addClass: name => events.push(['addClass', selector, name]),
      removeClass: name => events.push(['removeClass', selector, name]),
    }),
    (text, ...args) => text.replace(/%(\d+)/g, (_m, i) => String(args[Number(i)])),
  );
  let props = { match: { params: { worksheetId: 'sheet', type: 'share' } }, ...provided };
  function render() {
    for (const [i, next] of pending.splice(0)) states[i] = typeof next === 'function' ? next(states[i]) : next;
    cursor = 0;
    return mod.exports.default(props);
  }
  function flushEffects() {
    for (const [i, fn] of effectQueue.splice(0)) {
      cleanups[i]?.();
      cleanups[i] = fn();
    }
  }
  function unmount() {
    for (const cleanup of cleanups) cleanup?.();
    cleanups.length = 0;
  }
  return {
    render,
    flushEffects,
    unmount,
    states,
    refs,
    pending,
    events,
    requests,
    win,
    props,
    setProps: patch => {
      props = { ...props, ...patch };
    },
    getTranslateInfo,
    translations: translations.exports,
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
function businessEvents(events) {
  return events.filter(e => !(e[0] === 'state' && e[1] === 8));
}
function response() {
  return {
    worksheetId: 'sheet',
    name: 'Original',
    appId: 'app',
    projectId: 'project',
    groupId: 'group',
    roleType: 2,
    template: {
      controls: [
        { controlId: 'b', type: 2, row: 2, controlName: 'B' },
        { controlId: 'a', type: 2, row: 1, controlName: 'A' },
      ],
    },
    views: [],
    advancedSetting: { extension: 'keep' },
  };
}
const drain = () => new Promise(resolve => setImmediate(resolve));
module.exports = {
  ROOT,
  BASE,
  REL,
  previous,
  current,
  compile,
  renderer,
  nodes,
  tree,
  businessEvents,
  response,
  drain,
};
