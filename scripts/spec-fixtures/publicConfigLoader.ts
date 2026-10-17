/** Actual component modules and helpers; UI leaves, scheduling and external effects are controlled. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const parser = require('@babel/parser');
const { ROOT, transformSync } = require('../spec-harness.ts');
const React = require('react');
const BASE = '440a599e2770b24c72e95f08da56e000a14c0572';
const REL = 'src/pages/FormExtend/PublicWorksheetConfig/PublicConfig/index.tsx';
const SHA = '8cacc3992678c675e57f9b2d5892f269f1f4b4169e14195060493a905fd3d37e';
const previous = execFileSync('git', ['show', `${BASE}:${REL}`], { cwd: ROOT, encoding: 'utf8' });
assert.equal(crypto.createHash('sha256').update(previous).digest('hex'), SHA);
const current = fs.readFileSync(path.join(ROOT, REL), 'utf8');
const compile = (source, rel = REL) =>
  transformSync(source, { filename: path.join(ROOT, rel), comments: false, compact: true }).code;
const parse = source => parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const globalSource = fs.readFileSync(path.join(ROOT, 'src/common/global.ts'), 'utf8');
const assignment = parse(globalSource).program.body.find(
  n => n.expression?.left?.object?.name === 'window' && n.expression.left.property?.name === 'safeParse',
);
assert.ok(assignment);
const host: { safeParse?: (value: unknown) => unknown } = {};
new Function(
  'window',
  'console',
  compile(globalSource.slice(assignment.start, assignment.end), 'src/common/global.ts'),
)(host, { error() {} });
const safeParse = host.safeParse;
const leaves = new Map();
function leaf(name) {
  if (!leaves.has(name)) {
    const f = () => null;
    f.displayName = name;
    leaves.set(name, f);
  }
  return leaves.get(name);
}
const realModules = new Map();
function realModule(rel) {
  if (realModules.has(rel)) return realModules.get(rel);
  const mod = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    '_l',
    'safeParse',
    compile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel),
  )(
    mod,
    mod.exports,
    name => {
      if (name.endsWith('.png')) return name;
      if (name === './enum') return realModule('src/pages/FormExtend/enum.ts');
      if (name === './pageConfig' || name === '../../pageConfig')
        return realModule('src/pages/FormExtend/pageConfig.ts');
      if (['react', 'react/jsx-runtime', 'lodash'].includes(name)) return require(name);
      throw Error(`Unexpected real module dependency ${name}`);
    },
    s => s,
    safeParse,
  );
  realModules.set(rel, mod.exports);
  return mod.exports;
}
const constants = realModule('src/pages/FormExtend/enum.ts');
const shareConstants = realModule('src/components/ShareCardConfig/config.ts');
const models = realModule('src/pages/FormExtend/PublicWorksheetConfig/PublicConfig/models.ts');
const writer = realModule('src/pages/FormExtend/pageConfigWrite.ts');
const factories = new Map();
function factory(source) {
  if (!factories.has(source)) {
    const rewritten = source.replace(
      'export default connect(mapStateToProps, mapDispatchToProps)(PublicConfig);',
      'export { PublicConfig };',
    );
    assert.notEqual(rewritten, source);
    factories.set(
      source,
      new Function('module', 'exports', 'require', '_l', 'safeParse', 'alert', 'md', compile(rewritten)),
    );
  }
  return factories.get(source);
}
function load(source, parseValue = safeParse) {
  const mod: { exports: Record<string, any> } = { exports: {} };
  const events = [];
  let styleId = 0;
  const styled = Object.assign(() => () => leaf(`style-${styleId++}`), { div: () => leaf(`style-${styleId++}`) });
  factory(source)(
    mod,
    mod.exports,
    name => {
      if (
        ['react', 'react/jsx-runtime', 'redux', 'lodash', 'classnames', 'prop-types', 'immutability-helper'].includes(
          name,
        )
      )
        return require(name);
      if (name === 'react-redux') return { connect: () => C => C };
      if (name === 'antd') return { Drawer: leaf('Drawer') };
      if (name === 'styled-components') return { default: styled, __esModule: true };
      if (name === 'ming-ui')
        return Object.fromEntries(['Button', 'Checkbox', 'Dialog', 'Dropdown', 'Radio', 'Tabs'].map(k => [k, leaf(k)]));
      if (name === 'worksheet/components/Basics')
        return Object.fromEntries(['H1', 'H3', 'Hr', 'Tip75', 'Tipbd', 'TipBlock'].map(k => [k, leaf(k)]));
      if (name === 'src/components/ShareCardConfig/config') return shareConstants;
      if (name === 'src/utils/copyToClipboard') return text => events.push(['copy', text]);
      if (name === '../../enum') return constants;
      if (name === '../../pageConfigWrite') return writer;
      if (name === '../../PublicWorksheetConfig/redux/actions') return {};
      if (name === './models') return models;
      if (name.startsWith('.')) return leaf(name);
      throw Error(`Unexpected component dependency ${name}`);
    },
    x => x,
    parseValue,
    (...args) => events.push(['alert', ...args]),
    { global: { SysSettings: { hideWeixin: false } } },
  );
  return { Component: mod.exports.PublicConfig, events };
}
function settings() {
  return {
    extends: ['existing'],
    ipControlId: 'ip',
    browserControlId: 'browser',
    deviceControlId: 'device',
    systemControlId: 'system',
    extendSourceId: 'source',
    receipt: 'receipt',
    needCaptcha: false,
    smsVerification: false,
    smsSignature: 'signed',
    writeScope: 1,
    cacheDraft: false,
    linkSwitchTime: { isEnable: false, isShowCountDown: false },
    limitWriteTime: {
      isEnable: false,
      monthSetting: { monthType: 1, defineMonth: [] },
      daySetting: { dayType: 1, defineDay: [], defineWeek: [] },
      hourSetting: { hourType: 1, rangHour: [] },
    },
    limitWriteCount: { isEnable: false, limitWriteCount: 0 },
    limitWriteFrequencySetting: { isEnable: false, limitRangType: 1, limitWriteCount: 0 },
    limitPasswordWrite: { isEnable: false, limitPasswordWrite: '' },
    cacheFieldData: { isEnable: false, cacheField: [] },
    weChatSetting: {
      onlyWxCollect: false,
      isCollectWxInfo: false,
      collectChannel: 1,
      isRequireAuth: false,
      fieldMaps: {},
    },
    abilityExpand: {
      autoFillField: { isAutoFillField: false, dataSource: 1, autoFillFields: [] },
      allowViewChange: { isAllowViewChange: false, dataSource: 1, switchViewChange: 1 },
    },
    extendDatas: {
      shareConfig: '{"title":"Title"}',
      afterSubmit: '{"action":1,"content":""}',
      pageConfigs: '[]',
      extension: 'retained',
    },
  };
}
function setup(
  source,
  configure: (data: any) => void = () => {},
  options: { parseValue?: (value: unknown) => unknown; batched?: boolean; props?: Record<string, unknown> } = {},
) {
  const loaded = load(source, options.parseValue);
  const data = settings();
  configure(data);
  const pending = [],
    stateQueue = [];
  const events = loaded.events;
  const props = {
    worksheetSettings: data,
    worksheetInfo: { worksheetId: 'sheet', projectId: 'project', projectName: 'Project' },
    shareUrl: '/public?id=1',
    controls: undefined,
    loading: false,
    hidedControlIds: [],
    originalControls: [
      { controlId: 'field', type: 2, controlName: 'Field' },
      { controlId: 'other', type: 2, controlName: 'Other' },
      { controlId: 'number', type: 6 },
    ],
    updateSettings: (value, callback) => {
      events.push(['update', value]);
      pending.push(callback);
    },
    hideControl: ids => events.push(['hide', ids]),
    onClose: () => events.push(['close']),
    addWorksheetControl: (name, callback) => {
      events.push(['add', name]);
      callback({ controlId: 'new', type: 2 });
    },
    ...options.props,
  };
  const instance = new loaded.Component(props);
  const apply = (patch, callback) => {
    instance.state = { ...instance.state, ...patch };
    callback?.();
  };
  instance.setState = (patch, callback) => {
    events.push(['state', patch]);
    if (options.batched) stateQueue.push([patch, callback]);
    else apply(patch, callback);
  };
  const flush = () => {
    const work = stateQueue.splice(0);
    work.forEach(([patch]) => {
      instance.state = { ...instance.state, ...patch };
    });
    work.forEach(([, cb]) => cb?.());
  };
  return { ...loaded, instance, props, data, events, pending, flush };
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
function outcome(fn) {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: [error.name, error.message] };
  }
}
function expression(source, name) {
  let range;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === 'VariableDeclarator' && node.id?.name === name) range = node.init;
    Object.values(node).forEach(visit);
  }
  visit(parse(source));
  assert.ok(range, name);
  return source.slice(range.start, range.end);
}
module.exports = {
  ROOT,
  BASE,
  REL,
  previous,
  current,
  compile,
  parse,
  setup,
  settings,
  nodes,
  tree,
  outcome,
  models,
  constants,
  shareConstants,
  expression,
  leaf,
  React,
  safeParse,
};
