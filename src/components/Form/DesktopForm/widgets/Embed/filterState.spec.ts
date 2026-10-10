import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const _: typeof import('lodash') = require('lodash');
const moment: typeof import('moment') = require('moment');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const types: typeof import('@babel/types') = require('@babel/types');
const generate: typeof import('@babel/generator').default = require('@babel/generator').default;
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../../../');
const beforeRevision = process.env['FILTER_CALLER_BEFORE_REV'];
const helperRoot = 'src/pages/worksheet/common/WorkSheetFilter/';
const embedPaths = ['DesktopForm', 'MobileForm'].map(form => `src/components/Form/${form}/widgets/Embed/index.tsx`);
const cascaderPaths = ['DesktopForm', 'MobileForm'].map(
  form => `src/components/Form/${form}/widgets/Cascader/index.tsx`,
);
const quickPath = 'src/pages/Mobile/RecordList/QuickFilter/index.tsx';
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError('Invalid test record');
  return value;
}
function field(value: unknown, key: string): unknown {
  return Reflect.get(record(value), key);
}
function invoke(fn: unknown, args: unknown[] = [], receiver?: unknown): unknown {
  if (typeof fn !== 'function') throw new TypeError('Missing actual function');
  const result: unknown = Reflect.apply(fn, receiver, args);
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Missing actual array');
  return value;
}
function node(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (React.isValidElement(value)) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return Array.from(value, node);
  throw new TypeError('Invalid rendered node');
}
function tree(value: unknown): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(value)) return value.flatMap(tree);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [{ type: value.type, props: value.props }, ...tree(value.props['children'])];
}
function source(relative: string, before: boolean): string {
  return before
    ? execFileSync('git', ['show', beforeRevision + ':' + relative], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, relative), 'utf8');
}
function ast(code: string) {
  return parser.parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] }).program;
}
function arrow(code: string, name: string) {
  let found: import('@babel/types').ArrowFunctionExpression | undefined;
  types.traverseFast(ast(code), item => {
    if (
      types.isVariableDeclarator(item) &&
      types.isIdentifier(item.id, { name }) &&
      types.isArrowFunctionExpression(item.init)
    )
      found = item.init;
  });
  if (!found) throw new TypeError('Missing actual ' + name);
  return found;
}
function evaluate(code: string, filename: string, deps: Record<string, unknown> = {}): unknown {
  const compiled = harness.transformSync(code, {
    filename: path.join(root, filename),
    comments: false,
    presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
  });
  assert.ok(compiled?.code);
  const module: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', ...Object.keys(deps), compiled.code)(
    module,
    module.exports,
    ...Object.values(deps),
  );
  return module.exports;
}
function expression(relative: string, name: string, before: boolean, deps: Record<string, unknown>): unknown {
  return evaluate('module.exports=' + generate(arrow(source(relative, before), name)).code, relative, deps);
}
function safeParse(value: unknown): unknown {
  if (typeof value !== 'string') return value || {};
  try {
    const result: unknown = JSON.parse(value);
    return result;
  } catch {
    return {};
  }
}
const translate = (value: string) => value;
const helperCache = new Map<string, unknown>();
function helper(relative: string): unknown {
  if (helperCache.has(relative)) return helperCache.get(relative);
  let code = source(relative, false);
  if (relative === 'src/pages/widgetConfig/config/widget.ts') {
    const names = ['WIDGETS_TO_API_TYPE_ENUM', 'ROW_ID_CONTROL', 'SYSTEM_DATE_CONTROL'];
    const statements = ast(code).body.filter(
      item =>
        types.isExportNamedDeclaration(item) &&
        types.isVariableDeclaration(item.declaration) &&
        item.declaration.declarations.some(d => types.isIdentifier(d.id) && names.includes(d.id.name)),
    );
    assert.equal(statements.length, names.length);
    code = statements.map(item => generate(item).code).join('\n');
  }
  const result = evaluate(code, relative, {
    require(request: string): unknown {
      if (request === 'src/pages/widgetConfig/config/widget') return helper('src/pages/widgetConfig/config/widget.ts');
      if (request === 'src/pages/widgetConfig/util/setting.js')
        return { getDatePickerConfigs: () => ({ formatMode: 'YYYY-MM-DD HH:mm:ss' }) };
      if (request === 'src/utils/common') return { browserIsMobile: () => false };
      if (request === 'src/utils/project') return { dateServerZoneToAppZone: (v: unknown) => v };
      if (request === 'src/utils/subListStoreTypes') return { isRelateRecordTableStore: () => false };
      if (request === 'src/utils/control')
        return {
          checkCellIsEmpty: (v: unknown) =>
            v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length),
          isRelateRecordTableControl: () => false,
        };
      if (request === 'src/api/worksheet') return {};
      if (request === 'ming-ui/antd-components/Cascader/boundary')
        return helper('src/ming-ui/antd-components/Cascader/boundary.ts');
      if (request.startsWith('.')) {
        const file = path.posix.join(path.posix.dirname(relative), request).replace(/\.(ts|js)$/, '') + '.ts';
        return helper(file);
      }
      return require(request);
    },
    _l: translate,
    window: { location: { href: 'https://fixture.test/' } },
    md: { global: { Account: { accountId: 'user' } } },
    safeParse,
  });
  helperCache.set(relative, result);
  return result;
}
const util = helper(helperRoot + 'util.ts');
const model = helper(helperRoot + 'model.ts');
const getFilter = field(util, 'getFilter');

/** Executes actual component bodies with persistent hook storage; React's real JSX/DOM renderer remains in use. */
function hooks() {
  let cursor = 0;
  const cells: unknown[] = [],
    effects: unknown[] = [];
  function state(initial: unknown): [unknown, (update: unknown) => void] {
    const index = cursor++;
    if (!(index in cells)) cells[index] = typeof initial === 'function' ? invoke(initial) : initial;
    return [
      cells[index],
      (update: unknown) => {
        cells[index] = typeof update === 'function' ? invoke(update, [cells[index]]) : update;
      },
    ];
  }
  return {
    reset() {
      cursor = 0;
      effects.length = 0;
    },
    cells,
    react: {
      ...React,
      useState: state,
      useRef(initial: unknown) {
        const index = cursor++;
        if (!(index in cells)) cells[index] = { current: initial };
        return cells[index];
      },
      useEffect(fn: unknown) {
        effects.push(fn);
      },
      useCallback: (fn: unknown) => fn,
      useMemo: (fn: unknown) => invoke(fn),
      memo: (fn: unknown) => fn,
      lazy: () => (props: Record<string, unknown>) =>
        React.createElement('div', { 'data-embed-filter': JSON.stringify(props['filters'] || props['filtersGroup']) }),
    },
    useSetState(initial: unknown) {
      const [value, set] = state(initial);
      return [value, (patch: unknown) => set((previous: unknown) => ({ ...record(previous), ...record(patch) }))];
    },
  };
}
function component(relative: string, before: boolean, hook: ReturnType<typeof hooks>, exposeEmbed: boolean): unknown {
  let code = source(relative, before);
  if (exposeEmbed) {
    const parsed = ast(code),
      embed = arrow(code, 'Embed');
    assert.ok(types.isBlockStatement(embed.body));
    embed.body.body = embed.body.body.filter(item => !types.isReturnStatement(item));
    embed.body.body.push(
      types.returnStatement(
        types.objectExpression([
          ...['setValue', 'getContent', 'getFilterResult', 'currentTimeRef', 'latestResultData', 'viewControlsRef'].map(
            name => types.objectProperty(types.identifier(name), types.identifier(name), false, true),
          ),
        ]),
      ),
    );
    types.traverseFast(parsed, item => {
      if (types.isVariableDeclarator(item) && types.isIdentifier(item.id, { name: 'Embed' })) item.init = embed;
    });
    code = generate(parsed).code;
  }
  const style = {
    div: () => (props: Record<string, unknown>) => React.createElement('div', {}, node(props['children'])),
  };
  return evaluate(code, relative, {
    require(request: string): unknown {
      if (request === 'react') return hook.react;
      if (request === 'react-use') return { useSetState: hook.useSetState };
      if (request === 'styled-components') return style;
      if (
        request === 'src/pages/worksheet/common/WorkSheetFilter/util' ||
        request === 'worksheet/common/WorkSheetFilter/util'
      )
        return util;
      if (request === 'src/pages/worksheet/common/WorkSheetFilter/model') return model;
      if (request === 'src/pages/worksheet/common/WorkSheetFilter/enum') return helper(helperRoot + 'enum.ts');
      if (request === 'src/api/worksheet') return {};
      if (request === 'worksheet/constants/enum')
        return { VIEW_DISPLAY_TYPE: { sheet: '0', detail: '6', resource: '7' } };
      if (request === '../../../core/utils') return { isPublicLink: () => false };
      if (request === '../../../core/enum') return { ADD_EVENT_ENUM: { SHOW: 'show' } };
      if (request === 'src/components/restrictAccessStatus') return () => React.createElement('div', {}, 'restricted');
      if (request === 'ming-ui') return { LoadDiv: () => React.createElement('div', {}, 'loading') };
      if (request === 'react-redux') return { connect: () => (fn: unknown) => fn };
      if (request === 'mobile/RecordList/redux/actions' || request === 'src/pages/worksheet/redux/actions') return {};
      if (request === 'src/pages/FormSet/config.js') return { permitList: {} };
      if (request === 'src/pages/FormSet/util.js') return { isOpenPermit: () => false };
      if (request === 'src/pages/widgetConfig/config/widget')
        return { ...record(helper('src/pages/widgetConfig/config/widget.ts')), WORKFLOW_SYSTEM_CONTROL: [] };
      if (request === 'src/pages/widgetConfig/util') return { filterOnlyShowField: (v: unknown) => v };
      if (request === 'src/pages/worksheet/common/Sheet/QuickFilter/utils')
        return { formatFilterValuesToServer: (type: unknown, value: unknown) => value };
      if (request === 'src/utils/project') return { compatibleMDJS: () => {} };
      if (request === './Inputs') return { __esModule: true, default: () => null, NumberTypes: [], TextTypes: [] };
      if (request === './utils')
        return {
          conditionAdapter: (v: unknown) => v,
          turnControl: (v: unknown) => v,
          validate: (v: unknown) => invoke(field(util, 'validate'), [v]),
        };
      return require(request);
    },
    _l: translate,
    safeParse,
    window: { shareState: {}, isMingDaoApp: false },
    document: { documentElement: { clientWidth: 480 } },
  });
}

function embedCases(relative: string, before: boolean): unknown[] {
  const hook = hooks(),
    mod = component(relative, before, hook, true),
    fn = field(mod, 'default');
  const filters = [{ controlId: 'target', dataType: 2, filterType: 2, values: ['text'], metadata: { retained: true } }];
  const props: Record<string, unknown> = {
    enumDefault: 2,
    value: '',
    appId: 'app',
    recordId: 'record',
    advancedSetting: { filters: JSON.stringify(filters) },
    dataSource: JSON.stringify({ appid: 'app', wsid: 'sheet', reportid: 'report' }),
    formData: [],
  };
  const render = () => {
    hook.reset();
    return record(invoke(fn, [props]));
  };
  let actual = render();
  invoke(actual['setValue']);
  actual = render();
  const content = invoke(actual['getContent']);
  const chart = tree(content).find(item => item.props['filters'] !== undefined);
  assert.ok(chart);
  const stored = field(actual['latestResultData'], 'current');
  assert.strictEqual(chart.props['filters'], stored, 'real chart prop keeps state array identity');
  const output = array(stored);
  assert.equal(field(output[0], 'controlId'), 'target');
  assert.deepEqual(field(output[0], 'metadata'), { retained: true });
  const previousClock = field(actual['currentTimeRef'], 'current');
  invoke(actual['setValue'], [{ useCachedCurrentTime: true }]);
  actual = render();
  assert.strictEqual(
    field(actual['latestResultData'], 'current'),
    stored,
    'equal cached filters retain original array',
  );
  assert.strictEqual(field(actual['currentTimeRef'], 'current'), previousClock, 'equal cached filters retain clock');
  const captured = renderToStaticMarkup(node(invoke(actual['getContent'])));
  props['advancedSetting'] = { filters: JSON.stringify([{ ...filters[0], values: ['changed'] }]) };
  actual = render();
  invoke(actual['setValue'], [{ useCachedCurrentTime: true }]);
  actual = render();
  assert.notStrictEqual(field(actual['latestResultData'], 'current'), stored);
  assert.notStrictEqual(
    field(actual['currentTimeRef'], 'current'),
    previousClock,
    'changed cached filters use a fresh clock',
  );
  assert.deepEqual(field(array(field(actual['latestResultData'], 'current'))[0], 'values'), ['changed']);
  assert.deepEqual(field(output[0], 'values'), ['text'], 'previous successful array is not mutated');
  const changed = field(actual['latestResultData'], 'current');
  props['enumDefault'] = 3;
  actual = render();
  const preview = tree(invoke(actual['getContent'])).find(item => item.props['filtersGroup'] !== undefined);
  assert.ok(preview);
  assert.strictEqual(preview.props['filtersGroup'], changed);
  props['enumDefault'] = 1;
  props['value'] = 'https://fixture.test/path?a=1&b=2';
  actual = render();
  invoke(actual['setValue']);
  actual = render();
  const iframe = tree(invoke(actual['getContent'])).find(item => item.type === 'iframe');
  assert.ok(iframe);
  assert.equal(iframe.props['src'], props['value']);
  const linkHtml = renderToStaticMarkup(node(invoke(actual['getContent'])));
  props['value'] = 'relative/path';
  actual = render();
  invoke(actual['setValue']);
  actual = render();
  assert.match(renderToStaticMarkup(node(invoke(actual['getContent']))), /嵌入内容无法解析/);
  const clock = new Date('2026-10-11T12:13:14Z');
  const timed = invoke(actual['getFilterResult'], [
    {
      enumDefault: 2,
      formData: [],
      advancedSetting: {
        filters: JSON.stringify([
          { controlId: 'time', dataType: 46, filterType: 2, dynamicSource: [{ cid: 'currenttime' }] },
        ]),
      },
    },
    clock,
  ]);
  assert.equal(field(array(timed)[0], 'value'), moment(clock).format('HH:mm:ss'));
  const empty = invoke(actual['getFilterResult'], [{ enumDefault: 2, advancedSetting: {} }, clock]);
  assert.deepEqual(empty, [], 'truthy empty array is preserved instead of the false fallback');
  return [captured, linkHtml, JSON.stringify(output), JSON.stringify(timed), JSON.stringify(empty)];
}

function fallbackCases(relative: string, before: boolean): void {
  const values: unknown[] = [{ controlId: 'field', values: ['value'] }],
    clock = new Date('2026-10-11T12:13:14Z');
  for (const returned of [values, [], false]) {
    const calls: unknown[] = [];
    const fn = expression(relative, 'getFilterResult', before, {
      getFilter: (params: unknown) => {
        calls.push(params);
        return returned;
      },
      viewControlsRef: { current: [] },
      appId: 'app',
    });
    const result = invoke(fn, [{ enumDefault: 2 }, clock]);
    assert.strictEqual(field(calls[0], 'currentTimeForSecond'), clock);
    assert.equal(field(calls[0], 'ignoreEmptyRule'), true);
    if (returned === false) assert.deepEqual(result, [{}], 'original false sentinel fallback stays explicit');
    else assert.strictEqual(result, returned, 'non-false array is passed through unchanged, including []');
  }
}

async function cascaderCases(relative: string, before: boolean): Promise<unknown[]> {
  const summaries: unknown[] = [];
  for (const topshow of ['0', '3'])
    for (const rowId of ['', 'child'])
      for (const missing of [false, true]) {
        const sourceFilters = [
          {
            controlId: 'target',
            dataType: 2,
            filterType: 2,
            values: ['text'],
            ...(missing ? { emptyRule: 3, dynamicSource: [{ cid: 'missing' }] } : {}),
          },
        ];
        const settings = {
          filters: JSON.stringify(sourceFilters),
          topfilters: JSON.stringify([{ controlId: 'top', dataType: 2, filterType: 2, values: ['top'] }]),
          topshow,
        };
        const props = { advancedSetting: settings, relationControls: [{ controlId: 'target', type: 2 }], formData: [] };
        const calls: unknown[] = [],
          results: unknown[] = [],
          updates: unknown[][] = [],
          errors: unknown[] = [];
        const row = { rowid: 'record', title: 'Record title', path: '["Record title"]', childrenids: '' };
        const request = Promise.resolve({
          resultCode: 1,
          template: { controls: [{ controlId: 'title', attribute: 1 }] },
          data: [row],
          worksheet: { views: [{ viewId: 'view', layersName: ['Layer'] }] },
        });
        const load = expression(relative, 'loadData', before, {
          props,
          formData: props.formData,
          appId: 'app',
          advancedSetting: settings,
          topshow,
          getFilter: (params: unknown) => {
            const result = invoke(getFilter, [params]);
            results.push(result);
            return result;
          },
          sheetAjax: {
            chooseRelationRows: (params: unknown) => {
              calls.push(params);
              return request;
            },
          },
          ajaxRef: { current: null },
          ajax: { current: null },
          loadVersion: { current: 0 },
          loadMounted: { current: true },
          lastLoadRowId: { current: '' },
          setIsError: (value: unknown) => errors.push(value),
          setRootLoading: () => {},
          setLoading: () => {},
          getKeywords: () => '',
          keywords: '',
          dataSource: 'sheet',
          viewId: 'view',
          getType: 10,
          controlId: 'source',
          worksheetId: 'master',
          _: _,
          _l: translate,
          widgetOptions: (value: unknown) =>
            invoke(field(helper('src/components/Form/DesktopForm/widgets/Cascader/boundary.ts'), 'widgetOptions'), [
              value,
            ]),
          renderCellText: (control: unknown) => field(control, 'value'),
          isEndLeaf: () => false,
          showtype: '0',
          isMultiple: false,
          anylevel: '0',
          cacheDataRef: { current: [] },
          cacheData: { current: [] },
          options: [],
          layersName: ['Layer'],
          isFirstLoad: false,
          setLayersName: () => {},
          setIsFirstLoad: () => {},
          deepDataUpdate: (...args: unknown[]) => updates.push(args),
        });
        const completion = invoke(load, [rowId]);
        await completion;
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.ok(
          errors.every(value => value === false),
          'actual valid row does not enter failure branch',
        );
        assert.equal(updates.length, 1);
        const update = updates[0];
        assert.ok(update);
        const options = array(update[relative.includes('DesktopForm') ? 2 : 1]);
        assert.equal(field(options[0], 'value'), row.rowid);
        assert.equal(field(options[0], 'label'), row.title);
        assert.equal(calls.length, 1);
        const params = record(calls[0]);
        if (missing) {
          assert.equal(results[0], false);
          assert.deepEqual(params['filterControls'], []);
        } else assert.strictEqual(params['filterControls'], results[0]);
        if (topshow === '3' && !rowId) assert.strictEqual(params['navGroupFilters'], results[1]);
        else {
          assert.equal(results.length, 1);
          assert.deepEqual(params['navGroupFilters'], []);
        }
        assert.equal(params['kanbanKey'], rowId);
        summaries.push([params, options]);
      }
  return summaries;
}
function quickCases(before: boolean): unknown[] {
  const hook = hooks(),
    fn = field(component(quickPath, before, hook, false), 'QuickFilter');
  const view = { viewId: 'view', viewType: 21 },
    active: unknown[][] = [],
    updates: unknown[][] = [];
  const saved = {
    id: 'saved',
    name: 'Saved condition',
    type: 1,
    conditionsGroups: [
      {
        conditionSpliceType: 1,
        conditions: [{ controlId: 'field', controlType: 2, conditionGroupType: 1, type: 2, values: ['value'] }],
      },
    ],
  };
  const props = {
    view,
    worksheetInfo: { switches: [], template: { controls: [] } },
    filters: [],
    controls: [],
    savedFilters: [saved],
    updateActiveSavedFilter: (...args: unknown[]) => active.push(args),
    pcUpdateFilters: (...args: unknown[]) => updates.push(args),
    pcUpdateQuickFilter: () => {},
    onHideSidebar: () => {},
  };
  const render = () => {
    hook.reset();
    return invoke(fn, [props]);
  };
  const click = tree(render()).find(item => item.props['children'] === saved.name);
  assert.ok(click);
  invoke(click.props['onClick']);
  assert.strictEqual(active[0]?.[0], saved);
  const query = tree(render()).find(item => item.props['className'] === 'flex Font16 centerAlign query');
  assert.ok(query);
  invoke(query.props['onClick']);
  const payload = record(updates[0]?.[0]);
  const expected = invoke(field(model, 'formatForSave'), [saved]);
  assert.deepEqual(payload['filterControls'], expected);
  assert.equal(array(payload['filterControls']).length, 1);
  assert.strictEqual(
    field(array(payload['filterControls'])[0], 'values'),
    saved.conditionsGroups[0]?.conditions[0]?.values,
  );
  assert.strictEqual(payload['filterControls'], hook.cells[3], 'saved array is passed directly from hook state');
  const reset = tree(render()).find(item => item.props['className'] === 'flex Font16 centerAlign reset');
  assert.ok(reset);
  invoke(reset.props['onClick']);
  assert.deepEqual(field(updates[1]?.[0], 'filterControls'), []);
  return [payload, updates[1]?.[0], renderToStaticMarkup(node(render()))];
}

async function main() {
  embedPaths.forEach(relative => fallbackCases(relative, false));
  const current = [
    embedPaths.map(p => embedCases(p, false)),
    await Promise.all(cascaderPaths.map(p => cascaderCases(p, false))),
    quickCases(false),
  ];
  await new Promise<void>(resolve => setImmediate(resolve));
  if (beforeRevision) {
    embedPaths.forEach(relative => fallbackCases(relative, true));
    const before = [
      embedPaths.map(p => embedCases(p, true)),
      await Promise.all(cascaderPaths.map(p => cascaderCases(p, true))),
      quickCases(true),
    ];
    assert.deepEqual(current, before, 'actual caller results match the explicitly supplied baseline');
    for (const relative of [...cascaderPaths, quickPath]) {
      const before = harness.transformSync(source(relative, true), {
        filename: path.join(root, relative),
        comments: false,
      });
      const after = harness.transformSync(source(relative, false), {
        filename: path.join(root, relative),
        comments: false,
      });
      assert.equal(after?.code, before?.code, 'type-only propagation keeps entire production body: ' + relative);
    }
    console.log('filterState: current assertions and explicit baseline caller scenarios passed');
  } else
    console.log(
      'filterState: real helper/caller state, URL, cache, popup and saved-filter assertions passed; historical A/B not requested',
    );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
