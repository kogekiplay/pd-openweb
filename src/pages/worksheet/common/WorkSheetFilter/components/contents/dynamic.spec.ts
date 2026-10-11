import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const Module: typeof import('node:module') = require('node:module');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const lodash: typeof import('lodash') = require('lodash');
const styledRuntime: typeof import('styled-components/dist/index') = require('styled-components');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../../../../');
const base = 'src/pages/worksheet/common/WorkSheetFilter/';
const beforeRevision = process.env['FILTER_DYNAMIC_BEFORE_REV'];
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!record(value)) throw new TypeError('Invalid fixture receiver');
  return Reflect.get(value, key);
}
function call(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Missing actual function ' + key);
  const result: unknown = Reflect.apply(fn, value, args);
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid fixture array');
  return value;
}
function node(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (React.isValidElement(value)) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return Array.from(value, node);
  throw new TypeError('Invalid actual React node');
}
function tree(value: unknown): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(value)) return value.flatMap(tree);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [{ type: value.type, props: value.props }, ...tree(value.props['children'])];
}
function core(): unknown {
  const file = path.join(root, base, 'core.spec.ts');
  const source = fs.readFileSync(file, 'utf8').split('async function run()')[0];
  const compiled = harness.transformSync(source + '\nmodule.exports={util,boundary};', { filename: file });
  assert.ok(compiled?.code);
  const result: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', '__dirname', compiled.code)(
    result,
    result.exports,
    Module.createRequire(file),
    path.dirname(file),
  );
  return result.exports;
}
const coreModule = core(),
  util = read(coreModule, 'util'),
  boundary = read(coreModule, 'boundary');
function fixture(before = false) {
  const cache = new Map<string, unknown>(),
    changes: unknown[] = [],
    selectors: Record<string, unknown>[] = [],
    timers: Array<() => void> = [],
    inputRefs: Array<{ current: unknown }> = [],
    stateChanges: unknown[] = [];
  const simple = (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      {
        className: props['className'],
        style: props['style'],
        onClick: props['onClick'],
      },
      node(props['children']),
    );
  const clickAway = Object.assign(
    (props: Record<string, unknown>) => {
      const component = props['component'];
      if (typeof component !== 'function') throw new TypeError('Invalid actual ClickAway child');
      const child: unknown = Reflect.apply(React.createElement, React, [component, props]);
      return React.createElement('span', { style: { display: 'contents' } }, node(child));
    },
    { wrap: (component: unknown) => component },
  );
  const editor = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-editor': name }, node(props['children']));
  const rendererNames = new Set(['Options', 'Users', 'Cascader', 'Date', 'Time', 'Number', 'Text', 'YesNo']);
  function load(relative: string): unknown {
    relative = path.relative(root, harness.resolveSpecTarget(path.join(root, relative.replace(/\.(ts|tsx)$/, ''))));
    if (cache.has(relative)) return cache.get(relative);
    const filename = path.join(root, relative);
    let source =
      before && !/dynamic(Boundary|Types)/.test(relative)
        ? execFileSync('git', ['show', beforeRevision + ':' + relative], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(filename, 'utf8');
    if (relative.endsWith('/RelateBox.tsx')) {
      if (before)
        source = source.replace(
          'RelateBox = ClickAway.wrap(RelateBox);',
          'module.exports.UnwrappedRelateBox=RelateBox;\nRelateBox = ClickAway.wrap(RelateBox);',
        );
      else source += '\nmodule.exports.UnwrappedRelateBox=RelateBox;';
    }
    const output = harness.transformSync(source, {
      filename,
      comments: false,
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
      plugins: ['@babel/plugin-transform-dynamic-import', '@babel/plugin-transform-modules-commonjs'],
    });
    assert.ok(output?.code);
    const result: { exports: unknown } = { exports: {} };
    new Function('module', 'exports', 'require', '_l', 'md', 'window', 'document', 'setTimeout', output.code)(
      result,
      result.exports,
      (request: string): unknown => {
        if (request === 'react')
          return {
            ...React,
            useRef: (initial: unknown) => {
              const ref = { current: initial };
              inputRefs.push(ref);
              return ref;
            },
            useState: (initial: unknown) => [initial, (next: unknown) => stateChanges.push(next)],
          };
        if (request === 'styled-components') return styledRuntime;
        if (request === 'src/utils/typedStyled') return { __esModule: true, default: styledRuntime.default };
        if (request === 'ming-ui')
          return {
            Icon: (props: Record<string, unknown>) =>
              React.createElement('i', { className: props['className'], 'data-icon': props['icon'] }),
            Input: (props: Record<string, unknown>) =>
              React.createElement('input', { value: props['value'], type: props['type'], onChange: () => {} }),
            Menu: simple,
            MenuItem: simple,
            SortableList: (props: Record<string, unknown>) =>
              React.createElement(
                'section',
                {},
                array(props['items']).map((item, index) =>
                  node(
                    call(props, 'renderItem', [{ item, index, dragging: false, isLayer: false, DragHandle: simple }]),
                  ),
                ),
              ),
          };
        if (request === 'ming-ui/antd-components') return { Tooltip: simple };
        if (request === 'ming-ui/components/ClickAway') return clickAway;
        if (request === 'worksheet/components/Basics') return { VerticalMiddle: simple };
        if (request === '@rc-component/trigger')
          return (props: Record<string, unknown>) =>
            React.createElement('div', {}, node(props['children']), node(props['popup']));
        if (request === 'src/pages/worksheet/common/WorkSheetFilter/util.js') return util;
        if (request === 'src/pages/widgetConfig/config/widget')
          return { ROW_ID_CONTROL: [{ controlId: 'rowid', controlName: '记录ID', type: 2 }] };
        if (request === 'src/pages/widgetConfig/util' || request.endsWith('/widgetConfig/util'))
          return {
            getIconByType: (value: unknown) => 'type-' + String(value),
            isSheetDisplay: (value: unknown) => read(value, 'enumDefault') === 2,
          };
        if (request === 'src/utils/control')
          return {
            getTitleTextFromControls: (controls: unknown, row: unknown) => {
              const title = array(controls || []).find(item => read(item, 'attribute') === 1);
              const cid = title && read(title, 'controlId');
              return typeof cid === 'string' ? read(row, cid) || '未命名' : '未命名';
            },
          };
        if (request === 'src/components/SelectRecords')
          return {
            selectRecords: (props: unknown) => {
              if (!record(props)) throw new TypeError('Invalid actual selector options');
              selectors.push(props);
            },
          };
        if (request.endsWith('/enum')) return load(base + 'enum.ts');
        if (request.endsWith('/filterModelBoundary')) return boundary;
        if (request === './Empty') return editor('Empty');
        if (request.startsWith('.')) {
          const name = path.basename(request);
          if (relative.endsWith('/contents/index.tsx') && rendererNames.has(name)) return editor(name);
          return load(
            path.relative(root, path.resolve(path.dirname(filename), request)).replace(/\.(js|ts|tsx)$/, '') + '.tsx',
          );
        }
        return require(request);
      },
      (text: string, ...values: unknown[]) =>
        values.reduce<string>((result, value, index) => result.replace('%' + index, String(value)), text),
      { global: { Account: { accountId: 'self' } } },
      {},
      { querySelector: () => ({ click: () => stateChanges.push('rename') }) },
      (fn: () => void) => {
        timers.push(fn);
        return timers.length;
      },
    );
    cache.set(relative, result.exports);
    return result.exports;
  }
  function create(name: string, props: Record<string, unknown>) {
    const constructor = read(
      load(base + 'components/contents/' + name + '.tsx'),
      name === 'RelateBox' ? 'UnwrappedRelateBox' : 'default',
    );
    if (typeof constructor !== 'function') throw new TypeError('Invalid actual constructor');
    const instance: unknown = Reflect.construct(constructor, [
      { onChange: (value: unknown) => changes.push(value), ...props },
    ]);
    if (!record(instance)) throw new TypeError('Invalid actual instance');
    Reflect.set(instance, 'setState', function (this: unknown, patch: unknown, callback?: unknown) {
      const previous = read(this, 'state');
      const next: unknown = typeof patch === 'function' ? Reflect.apply(patch, this, [previous]) : patch;
      if (!record(next) || !record(previous) || !record(this)) throw new TypeError('Invalid actual state patch');
      Reflect.set(this, 'state', { ...previous, ...next });
      if (typeof callback === 'function') Reflect.apply(callback, this, []);
    });
    return instance;
  }
  return { load, create, changes, selectors, timers, stateChanges, inputRefs };
}
async function normal(before = false): Promise<unknown[]> {
  const f = fixture(before),
    summaries: unknown[] = [];
  const columns = [
    { controlId: 'text', controlName: 'Alpha', type: 2, metadata: { retained: true } },
    { controlId: 'member', controlName: 'Member', type: 26 },
    { controlId: 'rel', controlName: 'Related', type: 29, dataSource: 'sheet' },
  ];
  const choice: unknown[] = [];
  for (const from of ['rule', 'relateSheet', 'fastFilter', 7]) {
    const box = f.create('RelateBox', {
      control: { type: 2, controlId: 'title' },
      columns,
      globalSheetControls: columns,
      conditionType: 2,
      from,
      showCustom: true,
      showUl: true,
      keywords: '',
      setKeys: () => {},
      onChangeFn: (value: unknown) => choice.push(value),
    });
    const list = call(box, 'filterDynamicControls');
    assert.strictEqual(array(list)[0], columns[0], 'dynamic choices keep original object references');
    const rendered = call(box, 'render');
    summaries.push(renderToStaticMarkup(node(rendered)));
    const item = tree(rendered).find(item => item.type === 'li');
    assert.ok(item);
    call(item.props, 'onClick');
    assert.deepEqual(read(choice[choice.length - 1], 'metadata'), columns[0]?.metadata);
  }
  const dyn = f.create('RelateFilter', {
    control: { type: 2 },
    type: 2,
    currentColumns: columns,
    globalSheetControls: columns,
    dynamicSource: [{ cid: 'text' }, { cid: 'member', rcid: 'parent' }],
    showCustom: true,
  });
  summaries.push(renderToStaticMarkup(node(call(dyn, 'render'))));
  call(dyn, 'remove', [0]);
  assert.deepEqual(read(f.changes[f.changes.length - 1], 'dynamicSource'), [{ cid: 'member', rcid: 'parent' }]);
  call(dyn, 'onChangeFn', [{ ...columns[0], cid: 'text', rcid: 'parent' }]);
  assert.deepEqual(f.changes[f.changes.length - 1], {
    dynamicSource: [{ cid: 'text', rcid: 'parent', staticValue: '' }],
    isDynamicsource: true,
  });
  const original = { id: 42, name: 'Stored', metadata: { preserved: true } };
  for (const single of [false, true]) {
    const related = f.create('RelateRecord', {
      fullValues: [JSON.stringify(original)],
      control: {
        enumDefault: single ? 1 : 2,
        relationControls: [{ controlId: 'title', attribute: 1 }],
        advancedSetting: { filters: 'private', showtype: '2' },
        dataSource: 'sheet',
      },
      type: 26,
      worksheetId: 'parent',
    });
    const old = array(read(read(related, 'state'), 'records'))[0];
    call(related, 'addRecord', [[{ rowid: 'row', title: 'Row title' }]]);
    const records = array(read(read(related, 'state'), 'records'));
    assert.equal(records.length, single ? 1 : 2);
    if (!single) assert.strictEqual(records[0], old);
    summaries.push(renderToStaticMarkup(node(call(related, 'render'))), f.changes[f.changes.length - 1]);
    const content = tree(call(related, 'render')).find(
      item => item.props['className'] && String(item.props['className']).startsWith('recordsCon'),
    );
    assert.ok(content);
    call(content.props, 'onClick');
    await new Promise<void>(resolve => setImmediate(resolve));
    const selector = f.selectors[f.selectors.length - 1];
    assert.ok(selector);
    assert.equal(selector['multiple'], !single);
    assert.equal(read(read(selector['control'], 'advancedSetting'), 'filters'), undefined);
    assert.equal(
      read(read(related, 'props'), 'control') &&
        read(read(read(related, 'props'), 'control'), 'advancedSetting') &&
        read(read(read(read(related, 'props'), 'control'), 'advancedSetting'), 'filters'),
      'private',
    );
  }
  const dispatcher = f.load(base + 'components/contents/index.tsx');
  const defs = f.load(base + 'enum.ts');
  const groups = read(defs, 'CONTROL_FILTER_WHITELIST');
  for (const name of ['TEXT', 'NUMBER', 'DATE', 'BOOL', 'OPTIONS', 'USERS', 'TIME']) {
    const values = ['value'],
      props = {
        control: { type: 9 },
        controlType: 9,
        type: 2,
        value: null,
        values,
        fullValues: [],
        dateRangeType: '3',
        onChange: () => {},
        from: 7,
      };
    const rendered = call(dispatcher, 'default', [read(read(groups, name), 'value'), props]);
    assert.strictEqual(read(read(rendered, 'props'), 'onChange'), props.onChange);
    assert.strictEqual(read(read(rendered, 'props'), 'values'), values);
    summaries.push(renderToStaticMarkup(node(rendered)));
  }
  for (const key of ['', undefined])
    summaries.push(
      renderToStaticMarkup(node(call(dispatcher, 'default', [key, { control: {}, onChange: () => {}, values: [] }]))),
    );
  const listModule = f.load(base + 'components/SavedFilters.tsx');
  const personal = {
    id: 'p',
    name: 'Personal',
    type: 1,
    createAccountId: 'self',
    conditionsGroups: [{ conditions: [{ controlId: 'text' }] }],
  };
  const shared = { id: 'g', name: 'Shared', type: 2, conditionsGroups: [{ conditions: [{ controlId: 'missing' }] }] };
  const callbacks: unknown[] = [];
  const list = call(listModule, 'default', [
    {
      filters: [personal, shared],
      controls: columns,
      addFilter: () => {},
      isCharge: true,
      activeFilter: personal,
      onSortEnd: (ids: unknown) => callbacks.push(ids),
      triggerFilter: (value: unknown) => callbacks.push(value),
      onHideFilterPopup: () => callbacks.push('hide'),
    },
  ]);
  summaries.push(renderToStaticMarkup(node(list)));
  const partitions = tree(list).filter(item => item.props['filters'] !== undefined);
  assert.equal(partitions.length, 2);
  for (const partition of partitions) call(partition.props, 'onSortEnd', [['reordered']]);
  assert.deepEqual(
    [...callbacks],
    [
      ['reordered', 'g'],
      ['p', 'reordered'],
    ],
  );
  const titles = f.load(base + 'components/FilterTitleList.tsx');
  const titleList = call(titles, 'default', [
    {
      filters: [personal],
      controls: columns,
      triggerFilter: (value: unknown) => callbacks.push(value),
      onHideFilterPopup: () => callbacks.push('hide'),
    },
  ]);
  const sortable = tree(titleList).find(item => item.props['renderItem'] !== undefined);
  assert.ok(sortable);
  call(sortable.props, 'onSortEnd', [[personal]]);
  const title = call(sortable.props, 'renderItem', [
    {
      item: personal,
      index: 0,
      dragging: false,
      isLayer: false,
      DragHandle: (props: { children?: ReactNode }) => React.createElement('span', {}, props.children),
    },
  ]);
  const titleFunction = read(title, 'type');
  assert.equal(typeof titleFunction, 'function');
  const titleTree: unknown =
    typeof titleFunction === 'function' ? Reflect.apply(titleFunction, undefined, [read(title, 'props')]) : undefined;
  const click = tree(titleTree)[0];
  assert.ok(click);
  call(click.props, 'onClick');
  assert.strictEqual(callbacks[callbacks.length - 2], personal);
  assert.equal(callbacks[callbacks.length - 1], 'hide');
  const tags = f.load(base + 'components/contents/TagCon.tsx');
  const item = { name: 'Tag', metadata: { keep: true } },
    removed: unknown[] = [],
    searches: unknown[] = [];
  const tag = call(tags, 'default', [
    {
      data: [item],
      onRemove: (value: unknown) => removed.push(value),
      needInput: true,
      search: 'text',
      onChangeInput: (value: unknown) => searches.push(value),
    },
  ]);
  const remove = tree(tag).find(item => item.props['className'] === 'remove');
  assert.ok(remove);
  let stopped = 0;
  call(remove.props, 'onClick', [{ stopPropagation: () => stopped++ }]);
  assert.equal(stopped, 1);
  assert.strictEqual(removed[0], item);
  const input = tree(tag).find(item => item.props['manualRef'] !== undefined);
  assert.ok(input);
  call(input.props, 'onChange', ['changed']);
  assert.deepEqual(searches[0], { search: 'changed' });
  await new Promise<void>(resolve => setTimeout(resolve, 550));
  assert.deepEqual(searches[1], { keywords: 'changed' });
  const wrap = f.load(base + 'components/wrapDisableClick.tsx');
  const component = (props: { onClick?: () => void }) => React.createElement('button', { onClick: props.onClick });
  const wrapped = call(wrap, 'default', [component]);
  if (typeof wrapped !== 'function') throw new TypeError('Invalid actual click wrapper');
  const callback = () => callbacks.push('click');
  for (const disabled of [false, true]) {
    const instance: unknown = Reflect.construct(wrapped, [{ disabled, onClick: callback }]);
    const rendered = call(instance, 'render');
    if (!disabled) assert.strictEqual(read(read(rendered, 'props'), 'onClick'), callback);
    call(read(rendered, 'props'), 'onClick');
  }
  assert.equal(callbacks.filter(value => value === 'click').length, 1);
  summaries.push(
    f.changes,
    callbacks.filter(value => value !== 'click'),
    searches,
  );
  return summaries;
}
async function main() {
  if (process.env['FILTER_DYNAMIC_BASELINE_ONLY'] === '1') {
    if (!beforeRevision) throw new TypeError('Baseline source must be explicitly requested');
    process.stdout.write(JSON.stringify(await normal(true)));
    return;
  }
  const current = await normal();
  if (beforeRevision) {
    // Independent process gives installed styled-components the same component-ID counter,
    // avoiding removal of real class/CSS output from the comparison.
    const serialized = execFileSync(process.execPath, [__filename], {
      cwd: root,
      env: { ...process.env, FILTER_DYNAMIC_BASELINE_ONLY: '1' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const previous: unknown = JSON.parse(serialized);
    assert.deepEqual(
      current,
      previous,
      'actual normal render/events/selection output matches explicitly supplied baseline',
    );
  }
  const f = fixture(),
    b = f.load(base + 'components/contents/dynamicBoundary.ts');
  for (const value of [[{ rowid: 5 }], [null], {}]) assert.throws(() => call(b, 'selectedRows', [value]), TypeError);
  const metadata = { untouched: { arbitrary: true } },
    row = { rowid: 'r', metadata };
  assert.strictEqual(array(call(b, 'selectedRows', [[row]]))[0], row);
  const shared = ['label'],
    title = [shared, shared];
  assert.strictEqual(call(b, 'relatedName', [title]), title);
  const cycle: unknown[] = [];
  cycle.push(cycle);
  assert.throws(() => call(b, 'relatedName', [cycle]), TypeError);
  for (const value of [true, {}, []]) assert.throws(() => call(b, 'primitiveValue', [value]), TypeError);
  console.log(
    beforeRevision
      ? 'dynamic: independent assertions and explicit normal production caller A/B passed'
      : 'dynamic: independent actual dynamic/filter/list/tag/wrapper render and event assertions passed; historical A/B not requested',
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
