const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { transformSync } = require('./spec-harness.ts');
const root = path.resolve(__dirname, '..');
const lodash = require('lodash');
const React = require('react');
const moment = require('moment');
const inert = new Proxy(function () {}, { get: () => inert, apply: () => inert });
function load(file, stubs = {}, expose = '') {
  const source = process.env.HAP755_TEST_REV
    ? cp.execFileSync('/usr/bin/git', ['show', `${process.env.HAP755_TEST_REV}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
  const code = transformSync(source, { filename: path.join(root, file) }).code;
  // A real CommonJS module is the boundary for dynamically compiled TS exports.
  const exports = new (require('node:module').Module)(file).exports;
  const builtin = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), lodash, moment, classnames: require('classnames'), 'react-redux': { connect: () => cls => cls, shallowEqual: Object.is }, 'styled-components': { __esModule: true, default: inert }, 'query-string': { __esModule: true, default: { parse: s => Object.fromEntries(new URLSearchParams(s)) } } };
  new Function('require', 'exports', code + (expose ? `\nexports.testEntry = ${expose};` : ''))(name => Object.hasOwn(stubs, name) ? stubs[name] : Object.hasOwn(builtin, name) ? builtin[name] : inert, exports);
  return exports;
}
function instance(Class, props) {
  const obj = new Class(props);
  obj.setState = update => Object.assign(obj.state, update);
  return obj;
}
const checks = [];
function test(name, fn) { checks.push([name, fn]); }
global._l = text => text;
global.md = { global: { Account: { accountId: 'account' } } };
global.location = { protocol: 'https:', search: '?exportId=valid' };
global.alert = () => {};
const storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), key: i => [...storage.keys()][i], get length() { return storage.size; } };
global.safeLocalStorageSetItem = (key, value) => localStorage.setItem(key, value);
global.safeParse = text => { try { return JSON.parse(text); } catch { return null; } };
global.window = { md, localStorage, location, top: { location: { origin: 'https://hap.test' } }, self: {}, platformENV: {}, open() {} };
window.location.origin = 'https://hap.test';
global.document = { cookie: '', domain: 'hap.test' };
test('cookies: same-origin iframe writes and prefers cookie, cross-origin stays local', () => {
  load('src/common/cookies.ts');
  global.getCookie = window.getCookie;
  global.safeLocalStorageSetItem = window.safeLocalStorageSetItem;
  window.setCookie('i18n_langtag', 'en', undefined);
  assert.match(document.cookie, /i18n_langtag=en/);
  localStorage.setItem('i18n_langtag', 'zh-Hans');
  assert.equal(window.getCookie('i18n_langtag'), 'en');
  document.cookie = '';
  assert.equal(window.getCookie('i18n_langtag'), 'zh-Hans');
  Object.defineProperty(window.top, 'location', { configurable: true, get() { throw Error('cross origin'); } });
  window.setCookie('i18n_langtag', 'ja', undefined);
  assert.equal(document.cookie, '');
  assert.equal(window.getCookie('i18n_langtag'), 'ja');
});
test('toolbar: save before opening, loading inhibits export, safe window features', () => {
  const calls = [];
  const Class = load('src/pages/worksheet/views/GunterView/Chart/components/ToolBar/index.tsx', {
    'worksheet/views/GunterView/components/GunterExport/filterSnapshot': { saveGunterExportFilters: data => { calls.push(data); return 'unique'; } },
    'src/utils/common': { pathCompletion: url => url },
  }).default;
  const props = { base: { appId: 'a', worksheetId: 'w', viewId: 'v' }, filters: {}, quickFilter: [], loading: false };
  const obj = instance(Class, props);
  window.open = (...args) => calls.push(args);
  assert.equal(typeof obj.exportImage, 'function');
  obj.exportImage();
  assert.equal(calls[0].filters, props.filters);
  assert.match(calls[1][0], /exportId=unique$/);
  assert.equal(calls[1][2], 'noopener,noreferrer');
  props.loading = true; obj.exportImage(); assert.equal(calls.length, 2);
});
test('export: take -> load -> restore -> ready -> print once; unmount cancels timer', async () => {
  const calls = [];
  const snapshot = { filters: {}, quickFilter: [] };
  const Class = load('src/pages/worksheet/views/GunterView/components/GunterExport/index.tsx', {
    './filterSnapshot': { takeGunterExportFilters: () => { calls.push('take'); return snapshot; } },
    './print': { __esModule: true, default: () => { calls.push('print'); return Promise.resolve(); } },
  }).default;
  const props = { match: { params: { worksheetId: 'w' } }, base: { viewId: 'v' }, views: [{ viewId: 'v', name: 'view' }], worksheetInfo: { worksheetId: 'w', isRequestingRelationControls: true }, loading: true,
    updateBase: () => calls.push('base'), loadWorksheet: () => calls.push('load'), restoreGunterExportFilters: data => { assert.equal(data, snapshot); calls.push('restore'); } };
  const obj = instance(Class, props);
  assert.equal(obj.renderContent(), null, 'Gunter must not mount before worksheet initialization');
  assert.equal(React.Children.toArray(obj.render().props.children).length, 1, 'only loading UI may mount before ready');
  obj.componentDidMount(); assert.deepEqual(calls, ['take', 'base', 'load']);
  obj.componentDidUpdate({ loading: true }); assert.equal(obj.state.ready, false);
  assert.equal(obj.renderContent(), null, 'relation controls still pending');
  props.worksheetInfo.isRequestingRelationControls = false;
  obj.componentDidUpdate({ loading: true }); assert.equal(obj.state.ready, true); assert.equal(calls.at(-1), 'restore');
  assert.notEqual(obj.renderContent(), null, 'Gunter mounts only after snapshot restoration');
  const original = global.setTimeout; const originalClear = global.clearTimeout; let callback; let cleared;
  Reflect.set(global, 'setTimeout', fn => { callback = fn; return 77; }); Reflect.set(global, 'clearTimeout', id => { cleared = id; });
  try {
    props.loading = false; obj.componentDidUpdate({ loading: true }); obj.componentDidUpdate({ loading: true });
    callback(); await Promise.resolve(); await Promise.resolve();
    assert.equal(calls.filter(c => c === 'print').length, 1);
    obj.componentWillUnmount(); assert.equal(cleared, 77);
    obj.handlePrintError(); assert.equal(obj.state.error, false);
  } finally { global.setTimeout = original; global.clearTimeout = originalClear; }
});
test('ChildTable: pending row writes keep mask; dismiss is resettable', () => {
  const Class = load('src/pages/worksheet/components/ChildTable/ChildTable.tsx', { 'react-dom': { flushSync: fn => fn() } }).default;
  const obj = Object.create(Class.prototype); obj.state = {}; obj.setState = update => Object.assign(obj.state, update);
  obj.rowsLoading = { row: false }; obj.pendingRowWrites = 1; obj.loadingMaskDismissed = false;
  assert.equal(typeof obj.syncLoadingMask, 'function');
  obj.syncLoadingMask(); assert.equal(obj.state.showLoadingMask, true);
  obj.pendingRowWrites = 0; obj.syncLoadingMask(); assert.equal(obj.state.showLoadingMask, false);
});
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
test('DataFormat: concurrent real requests and rejection drain pending, duplicates do not add pending', async () => {
  const requests = [];
  const Class = load('src/components/Form/core/DataFormat.ts', {
    'worksheet/common/WorkSheetFilter/util': { getFilter: ({ control }) => [{ controlId: control.controlId }] },
    './formUtils/helper': { getItemFilters: data => data },
    './formUtils': { checkRuleLocked: () => false },
    './config': { FROM: { DEFAULT: 2 }, SYSTEM_ENUM: [] },
    'src/utils/common': { browserIsMobile: () => false },
  }).default;
  const obj = new Class({ data: [], waitForPendingSearchRequests: true, requestPool: { getFilterRowsByQueryDefault: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) } });
  const p1 = obj.getFilterRowsData({ controlId: 'f1' }, {}, 'target', 'source1');
  const p2 = obj.getFilterRowsData({ controlId: 'f2' }, {}, 'target', 'source2');
  assert.equal(obj.pendingSearchRequests?.get('target'), 2);
  await obj.getFilterRowsData({ controlId: 'f1' }, {}, 'target', 'source1');
  assert.equal(requests.length, 2);
  requests[0].resolve({ count: 1 }); await p1;
  assert.equal(obj.pendingSearchRequests.get('target'), 1);
  requests[1].reject(Error('network'));
  assert.equal(await p2, null);
  assert.equal(obj.pendingSearchRequests.size, 0);
});
test('formula: null text is empty; numeric null is preserved, including formula result type', () => {
  let value = null;
  const fn = load('src/components/Form/core/formUtils/index.ts', {
    'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/exec': { __esModule: true, default: () => ({ value }) },
    'src/pages/widgetConfig/config/widget': { WIDGETS_TO_API_TYPE_ENUM: { TEXT: 2, FORMULA_FUNC: 53 } },
  }).calcDefaultValueFunction;
  const run = (type, enumDefault2 = undefined) => fn({ formData: [], fnControl: { type, enumDefault2, advancedSetting: { defaultfunc: '{"expression":"null"}' } } });
  assert.equal(run(2), ''); assert.equal(run(53, 2), ''); assert.equal(run(6), 'null');
  value = 0; assert.equal(run(2), '0'); value = undefined; assert.equal(run(6), '');
});
test('function values: round the saved result to target and percentage precision', () => {
  const execute = load('src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/exec.ts', {
    'src/pages/widgetConfig/config/widget': { WIDGETS_TO_API_TYPE_ENUM: { NUMBER: 6, MONEY: 8, TEXT: 2 } },
    'src/utils/numberPrecision': require('../src/utils/numberPrecision.ts'),
    './local': { initLang() {} }, './enum': { functions: {} },
  }).default;
  const run = (value, dot, numshow = '0') => execute({ type: 6, dot, advancedSetting: { defaultfunc: JSON.stringify({ expression: String(value) }), numshow } }, [], { forceSyncRun: true }).value;
  assert.equal(run(1.235, 2), '1.24'); assert.equal(run(0.123456, 2, '1'), '0.1235');
  assert.equal(run(1.234567, undefined), '1.234567');
});
test('snapshot: multi-tab isolation, take-once, TTL, invalid ids, account and view matching', () => {
  const api = load('src/pages/worksheet/views/GunterView/components/GunterExport/filterSnapshot.ts', {
    uuid: require('uuid'), 'src/utils/domain/worksheet/filter': { formatQuickFilter: value => value },
  });
  storage.clear();
  const base = { appId: 'a', worksheetId: 'w', viewId: 'v' };
  const first = api.saveGunterExportFilters({ base, filters: {}, quickFilter: [] });
  const second = api.saveGunterExportFilters({ base, filters: { keyWords: 'second' }, quickFilter: [] });
  assert.notEqual(first, second);
  assert.deepEqual(api.takeGunterExportFilters(first, base).filters, {});
  assert.throws(() => api.takeGunterExportFilters(first, base));
  assert.equal(api.takeGunterExportFilters(second, base).filters.keyWords, 'second');
  assert.equal(api.takeGunterExportFilters(undefined, base), null);
  for (const id of [null, '', '../bad', ['duplicate']]) assert.throws(() => api.takeGunterExportFilters(id, base));
  for (const mismatch of ['account', 'view', 'expired', 'corrupt']) {
    const id = api.saveGunterExportFilters({ base, filters: {}, quickFilter: [] });
    const key = `gunterExportFilters-${id}`;
    const snapshot = JSON.parse(storage.get(key));
    if (mismatch === 'account') snapshot.accountId = 'someone-else';
    if (mismatch === 'view') snapshot.viewId = 'different';
    if (mismatch === 'expired') snapshot.expiresAt = Date.now() - 1;
    storage.set(key, mismatch === 'corrupt' ? '{broken' : JSON.stringify(snapshot));
    assert.throws(() => api.takeGunterExportFilters(id, base)); assert.equal(storage.has(key), false);
  }
  const original = localStorage.setItem; localStorage.setItem = () => {};
  try { assert.throws(() => api.saveGunterExportFilters({ base, filters: {}, quickFilter: [] })); } finally { localStorage.setItem = original; }
});
test('mobile history: earlier page listener recognizes pending and active layers before capture runs', () => {
  let listener;
  window.addEventListener = (_name, fn) => { listener = fn; };
  global.history = { state: {}, pushState(state) { this.state = state; }, go() {} };
  const api = load('src/utils/mobileNavigation.ts', { 'src/utils/common': { browserIsMobile: () => true } });
  assert.equal(api.isHistoryLayerPopstate({}), false);
  api.pushHistoryLayer('modal', () => {});
  assert.equal(api.isHistoryLayerPopstate({}), true);
  api.popHistoryLayer('modal'); assert.equal(api.isHistoryLayerPopstate({}), true);
  listener({}); assert.equal(api.isHistoryLayerPopstate({}), false);
});
test('HistoryChart: theme update retains dragged slider and category filter; unmount destroys chart', () => {
  global.getComputedStyle = () => ({ getPropertyValue: key => ` resolved-${key} ` });
  const Class = load('src/pages/workflow/WorkflowList/components/WorkflowMonitor/HistoryChart.tsx').default;
  const obj = instance(Class, {}); const calls = [];
  obj.chantRef = { removeEventListener: () => calls.push('remove') };
  const theme = obj.getChartThemeOptions(); assert.equal(theme.slider.backgroundStyle.opacity, 0);
  assert.equal(theme.xAxis.label.style.fill, 'resolved---color-text-secondary');
  const filter = value => value !== 'hidden';
  obj.lineChart = { chart: { getController: () => ({ getComponents: () => [{ component: { getValue: () => [0.2, 0.8] } }] }), getOptions: () => ({ filters: { category: filter } }), filter: (...args) => calls.push(args), render: () => calls.push('render') }, update: config => calls.push(config), destroy: () => calls.push('destroy') };
  obj.updateChartTheme(); assert.equal(calls[0].slider.start, 0.2); assert.equal(calls[0].slider.end, 0.8); assert.equal(calls[1][1], filter);
  obj.themeObserver = { disconnect: () => calls.push('disconnect') };
  obj.componentWillUnmount(); assert.equal(obj.lineChart, null); assert(calls.includes('destroy')); assert(calls.includes('disconnect'));
});
test('public form: language node belongs to header and does not depend on SaaS footer', () => {
  const request: Record<string, string> = {};
  const Class = load('src/pages/PublicWorksheet/FillWorksheet.tsx', {
    'src/utils/common': { browserIsMobile: () => false, getRequest: () => request },
    'src/components/Form/core/utils': { getControlsByTab: () => ({ commonData: [], tabData: [] }) },
    'src/components/Form/core/formUtils/updateRulesData': { updateRulesData: ({ data }) => data },
  }).default;
  const langDropdown = React.createElement('language-control');
  const props = { langDropdown, formData: [], rules: [], publicWorksheetInfo: { name: 'Form', worksheetId: 'w', extendDatas: {} } };
  const obj = instance(Class, props); window.platformENV.isLocal = true;
  let tree = nodes(obj.render()); let info = tree.find(n => String(n.props.className).includes('infoCon'));
  assert.equal(info.props.className, 'infoCon hasHeader'); assert(nodes(info).some(n => n.type === 'language-control'));
  request.header = 'no'; tree = nodes(obj.render()); info = tree.find(n => n.props.className === 'infoCon');
  assert(info); assert(nodes(info).some(n => n.type === 'language-control'));
});
test('relation confirmation: Escape/dismiss never unlinks; explicit cancel button unlinks once', async () => {
  let rendered; let count = 0; let unmounted = 0;
  const body = { appendChild(node) { node.parentNode = { removeChild() {} }; } };
  const previousDocument = global.document;
  global.document = { body, createElement: () => ({}) };
  const confirm = load('src/ming-ui/components/Dialog/Confirm.tsx', { 'react-dom/client': { createRoot: () => ({ render: node => { rendered = node; }, unmount: () => unmounted++ }) } }).default;
  try {
    confirm({ onlyClose: true, onCancel: () => count++ });
    rendered.props.onCancel(); await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(count, 0); assert.equal(unmounted, 1);
    confirm({ onlyClose: true, onCancel: () => count++ });
    const cancel = React.Children.toArray(rendered.props.footer.props.children)[0];
    cancel.props.action(); cancel.props.onClose(); await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(count, 1); assert.equal(unmounted, 2);
  } finally { global.document = previousDocument; }
});
test('AccessConditions: hosted choices are restricted; local deployment retains all conditions', () => {
  const hooks = { ...React, useState: value => [value, () => {}], useEffect: () => {} };
  const types = [{ value: 0 }, { value: 1 }, { value: 2 }, { value: 3 }];
  const Component = load('src/pages/Admin/security/data/AppAccess/AccessConditions.tsx', {
    react: hooks, '../enum': { ACCESS_CONDITION_ENUM: types, DEVICE_ENUM: [], YES_NO_ENUM: [] },
    'ming-ui': { RadioGroup: 'radio-group', Dropdown: 'dropdown', Input: 'input', Textarea: 'textarea' },
  }).default;
  window.platformENV.isLocal = false;
  const choices = () => nodes(Component({})).find(n => n.type === 'radio-group').props.data.map(item => item.value);
  assert.deepEqual(choices(), [0, 3]);
  window.platformENV.isLocal = true; window.platformENV.isPlatform = false;
  assert.deepEqual(choices(), [0, 1, 2, 3]);
  window.platformENV.isPlatform = true; assert.deepEqual(choices(), [0, 3]);
});
test('RecordForm: rule evaluation receives runtime child store/value before permission filtering', () => {
  const stop = Error('captured rule input');
  const store = { getState: () => ({ rows: [{ rowid: 'loaded' }] }) };
  const hooks = { ...React, useState: () => [{ recordId: 'r', formFlag: 'flag', data: [{ controlId: 'child', store, value: '[{"rowid":"loaded"}]' }] }, () => {}], useContext: () => ({}) };
  const form = load('src/pages/worksheet/common/recordInfo/RecordForm/index.tsx', {
    react: hooks,
    'src/components/Form/core/formUtils/updateRulesData': { updateRulesData: ({ data }) => {
      assert.equal(data[0].store, store);
      assert.equal(data[0].value, '[{"rowid":"loaded"}]');
      assert.equal(data[0].fieldPermission, '110');
      throw stop;
    } },
  }, 'RecordForm').testEntry;
  assert.throws(() => form({ recordbase: { recordId: 'r' }, formFlag: 'flag', formdata: [{ controlId: 'child', type: 34, fieldPermission: '110' }] }), error => error === stop);
});
test('WorkSheet: cleanup ignores late response and late fallback navigation', async () => {
  const effects = []; const writes = []; const navigation = []; let resolvePage; let resolveFirst;
  const hooks = { ...React, useRef: () => ({ current: {} }), useState: value => [value, data => writes.push(data)], useEffect: fn => effects.push(fn) };
  const api = { getPageInfo: () => new Promise(resolve => { resolvePage = resolve; }), getAppFirstInfo: () => new Promise(resolve => { resolveFirst = resolve; }) };
  const mount = () => {
    const Container = load('src/pages/worksheet/WorkSheet.tsx', { react: hooks,
      'src/api/homeApp': { __esModule: true, default: api },
      'src/router/navigateTo': { navigateTo: url => navigation.push(url) },
      'src/utils/worksheet': { moveSheetCache: () => writes.push('cache') },
    }, 'WorkSheetContainer').testEntry;
    Container({ appId: 'app', id: 'sheet', currentSheet: {}, params: {}, appPkg: {}, sheetListLoading: true });
    return effects.splice(0).map(fn => fn())[0];
  };
  let cleanup = mount(); const before = writes.length; cleanup(); resolvePage({ resultCode: 1 }); await Promise.resolve();
  assert.equal(writes.length, before); assert.equal(navigation.length, 0);
  cleanup = mount(); resolvePage({ resultCode: 0 }); await Promise.resolve(); assert.equal(writes.at(-1), 'cache');
  cleanup(); resolveFirst({ appSectionId: 'g', workSheetId: 'late' }); await Promise.resolve(); assert.equal(navigation.length, 0);
});
test('watermark: enabled project renders one canonical overlay with stable content and z-index', () => {
  const hooks = { ...React, useContext: () => ({ getPrefixCls: () => 'ant' }), useState: value => [value, () => {}], useEffect: () => {} };
  const WaterMark = load('src/ming-ui/components/WaterMark.tsx', {
    react: hooks,
    antd: { ConfigProvider: { ConfigContext: {} } },
    'src/utils/project': { getCurrentProject: () => ({ enabledWatermark: true, enabledWatermarkTxt: 'Project/$email$' }) },
    'src/utils/common': { emitter: { on() {}, off() {} } },
  }).default;
  global.md.global.Account = { accountId: 'account', fullname: 'Owner', email: 'owner@example.com' };
  const child = React.createElement('content');
  const tree = WaterMark({ projectId: 'project', children: child, zIndex: 123 });
  const rendered = tree.type(tree.props);
  const treeChildren = React.Children.toArray(rendered.props.children);
  assert(treeChildren.some(node => node.type === 'content'));
  const overlays = treeChildren.filter(node => node.props.style?.backgroundRepeat === 'repeat');
  assert.equal(overlays.length, 1, 'exactly one overlay, not an inherited overlay per modal/drawer');
  assert.equal(tree.props.content, 'Project/owner');
  const overlay = overlays[0];
  assert.equal(overlay.props.style.zIndex, 123);
  assert.equal(overlay.props.style.pointerEvents, 'none');
  assert.equal(rendered.props.className, 'ant-wrapper w100 h100');
  global.md.global.Account = { accountId: 'account' };
});
test('location: translation is evaluated on every render and GPS help remains in the actual radio item', () => {
  let lang = 'first'; const original = global._l; global._l = text => `${lang}:${text}`;
  try {
    const Component = load('src/pages/widgetConfig/widgetSetting/settings/location.tsx', {
      'ming-ui': { RadioGroup: 'radio', Dropdown: 'dropdown' },
      '../../util/setting': { getAdvanceSetting: () => ({}) },
    }).default;
    const data = { strDefault: ['1'] };
    const first = nodes(Component({ data, onChange() {} })).find(n => n.type === 'radio').props.data;
    lang = 'second'; const second = nodes(Component({ data, onChange() {} })).find(n => n.type === 'radio').props.data;
    assert.match(first[0].text, /^first:/); assert.match(second[0].text, /^second:/); assert(second[1].children);
  } finally { global._l = original; }
});
(async () => {
  let failures = 0;
  for (const [name, fn] of checks) { try { await fn(); console.log('PASS', name); } catch (err) { failures++; console.error('FAIL', name, err.stack); } }
  assert.equal(failures, 0, `${failures}/${checks.length} semantic regressions failed`);
})();
