import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const sc: typeof import('styled-components/dist/index') = require('styled-components');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
const babelGenerator: typeof import('@babel/generator').default = require('@babel/generator').default;
const lodash: typeof import('lodash') = require('lodash');
const root = path.resolve(__dirname, '../../../../../../..');
const before = process.env['ONLY_SYNC_BEFORE'];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Fixture receiver');
  return Reflect.get(value, key);
}
function call(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError(key);
  return Reflect.apply(fn, value, args);
}
function node(value: unknown): ReactNode {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map(node);
  throw new TypeError('Render result');
}
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function walk(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!object(value) || !object(value['props'])) return [];
  return [{ type: value['type'], props: value['props'] }, ...walk(value['props']['children'])];
}
function find(value: unknown, predicate: (value: Tree) => boolean): Tree {
  const found = walk(value).find(predicate);
  assert.ok(found, 'Actual render element exists');
  return found;
}
function event(value: Tree, key: string, args: unknown[] = []): unknown {
  return call(value.props, key, args);
}
function selected(relative: string, names: string[]): string {
  const parsed = harness.parser.parse(fs.readFileSync(path.join(root, relative), 'utf8'), { sourceType: 'module' });
  const found: string[] = [];
  for (const item of parsed.program.body) {
    const decl = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    if (
      decl?.type === 'VariableDeclaration' &&
      decl.declarations.some(d => d.id.type === 'Identifier' && names.includes(d.id.name))
    )
      found.push(babelGenerator(decl).code);
    if (decl?.type === 'FunctionDeclaration' && decl.id && names.includes(decl.id.name))
      found.push(babelGenerator(decl).code);
  }
  assert.equal(found.length, names.length);
  return found.join('\n') + '\nmodule.exports={' + names.join(',') + '};';
}
const translate = (text: string, ...args: unknown[]) =>
  args.length ? text.replace(/%(\d+)/g, (_, i: string) => String(args[Number(i)])) : text.replace(/%\d{5}$/, '');
interface Effect {
  dependencies: unknown[];
  callback: () => unknown;
  cleanup?: (() => void) | undefined;
}
interface APIRequest {
  method: string;
  params: unknown;
}
interface Runtime {
  states: unknown[];
  requests: APIRequest[];
  errors: unknown[];
  submitted: unknown[];
  render(): unknown;
  flush(): Promise<void>;
  unmount(): void;
  html(tree: unknown): { html: string; css: string };
  handlers: Record<string, (params: unknown) => unknown>;
  UI: Record<string, unknown>;
  boundary: unknown;
}
const field = {
  id: 'id',
  name: 'ID',
  alias: 'ID',
  jdbcTypeId: 12,
  dataType: 'varchar',
  mdType: 2,
  isPk: true,
  isCanBePk: true,
  isNotNull: true,
  isCheck: true,
  controlSetting: {},
  metadata: { keep: ['x'] },
};
const extra = {
  id: 'other',
  name: 'Other',
  alias: 'Other',
  jdbcTypeId: 12,
  dataType: 'varchar',
  mdType: 2,
  isPk: false,
  isCanBePk: true,
  isNotNull: true,
  isCheck: false,
  controlSetting: {},
};
const matching = {
  id: [{ typeName: 'VARCHAR', dataType: 12, mdType: 2, maxLength: 255, defaultScale: 0 }],
  other: [{ typeName: 'VARCHAR', dataType: 12, mdType: 2, maxLength: 255, defaultScale: 0 }],
};
const mapping = [
  { sourceField: field, destField: { ...field, id: null, isTitle: false } },
  { sourceField: extra, destField: { ...extra, id: null, isTitle: false } },
];
const props = (sourceType = 'MYSQL', destType = 'MYSQL'): Record<string, unknown> => ({
  currentProjectId: 'p',
  source: { id: 's', type: sourceType, sourceName: 'Source' },
  dest: { id: 'd', type: destType, sourceName: 'Dest', hasSchema: false },
  onClose: () => undefined,
});
function initial(sourceType: string, destType: string, create = 'NEW'): unknown[] {
  return [
    { db: 'db', table: 'table', tableName: 'Table', schema: 'schema' },
    {
      dbOptionList: [{ label: 'target', value: 'target' }],
      sheetOptionList: [],
      db: {
        table: {
          schemaOptionList: [{ label: 'public', value: 'public' }],
          sheetOptionList: [{ label: 'Existing', value: 'existing', workSheetName: 'Existing' }],
        },
      },
    },
    {
      db: {
        table: {
          dbName: 'target',
          schemaName: 'public',
          sheetName: 'Table',
          sheetNameValue: create === 'SELECT_EXIST' ? 'existing' : undefined,
          sheetCreateType: create,
          writeMode: 'SKIP',
          insertTrigger: true,
          scheduleConfig: { readType: 0, readIntervalType: 0 },
        },
      },
    },
    { db: { table: { fields: sourceType === 'KAFKA' ? [{ ...field, isPk: false }, extra] : [field, extra] } } },
    { db: { table: { fields: [field, extra] } } },
    { db: { table: { fieldsMapping: mapping, tableName: 'Table', schema: 'schema' } } },
    { db: { table: { matchedTypes: matching } } },
    false,
  ];
}
function fixture(
  input: Record<string, unknown>,
  seed: unknown[] = [],
  historical = false,
  realSelect = false,
): Runtime {
  const states = structuredClone(seed);
  const requests: APIRequest[] = [];
  const errors: unknown[] = [];
  const submitted: unknown[] = [];
  let cursor = 0,
    rendered: unknown,
    dirty = false;
  const effects = new Map<number, Effect>();
  let pending: Effect[] = [];
  const handlers: Record<string, (params: unknown) => unknown> = {
    getDatabases: () => ['target'],
    getSchemas: () => ['public'],
    getTableFields: () => [field, extra],
    fieldsDataTypeMatch: () => ({ matchedTypes: matching }),
    fillJdbcType: () => [field, extra],
    getWorksheetInfo: () => ({
      template: { controls: [{ controlId: 'id', controlName: 'ID', type: 2, advancedSetting: {}, required: true }] },
    }),
  };
  function useState(init: unknown): [unknown, (value: unknown) => void] {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof init === 'function' ? Reflect.apply(init, undefined, []) : init;
    return [
      states[index],
      value => {
        states[index] = typeof value === 'function' ? Reflect.apply(value, undefined, [states[index]]) : value;
        dirty = true;
      },
    ];
  }
  function useSetState(init: unknown): [unknown, (value: unknown) => void] {
    const [state, set] = useState(init);
    return [
      state,
      value => {
        const patch = typeof value === 'function' ? Reflect.apply(value, undefined, [state]) : value;
        if (!object(patch)) throw new TypeError('Actual set-state patch');
        set(Object.assign({}, state, patch));
      },
    ];
  }
  function useEffect(callback: () => unknown, dependencies: unknown[]): void {
    const index = cursor++;
    const previous = effects.get(index);
    if (!previous || dependencies.some((d, i) => !Object.is(d, previous.dependencies[i]))) {
      const e = { dependencies, callback };
      effects.set(index, e);
      pending.push(e);
    }
  }
  function useRef(value: unknown): unknown {
    const index = cursor++;
    if (!(index in states)) states[index] = { current: value };
    return states[index];
  }
  const globals = {
    _l: translate,
    md: { global: { Account: { accountId: 'mine' } } },
    console: { ...console, error: (error: unknown) => errors.push(error) },
    Math: { ...Math, random: () => 0.5, floor: Math.floor },
  };
  const api: Record<string, unknown> = {};
  for (const method of Object.keys(handlers))
    api[method] = (params: unknown) => {
      requests.push({ method, params });
      try {
        return Promise.resolve(handlers[method]?.(params));
      } catch (error) {
        return Promise.reject(error);
      }
    };
  const UI: Record<string, unknown> = {};
  for (const key of [
    'LeftTableList',
    'FieldMappingList',
    'SelectTables',
    'TimingSetting',
    'SheetGroupSelect',
    'Checkbox',
    'Dialog',
    'Icon',
    'Input',
    'LoadDiv',
    'RadioGroup',
    'Select',
    'Tooltip',
  ]) {
    UI[key] = (p: Record<string, unknown>) =>
      React.createElement(
        key === 'Input' ? 'input' : 'div',
        {
          'data-ui': key,
          className: typeof p['className'] === 'string' ? p['className'] : undefined,
          'data-value': typeof p['value'] === 'object' ? JSON.stringify(p['value']) : String(p['value']),
          'data-loading': String(p['loading']),
          'data-checked': String(p['checked']),
        },
        key === 'Input' ? undefined : node(p['children']),
      );
  }
  if (realSelect) {
    const ant: typeof import('antd') = require('antd');
    UI['Select'] = ant.Select;
  }
  assert.ok(object(UI['Dialog']));
  Reflect.set(UI['Dialog'], 'confirm', (config: unknown) => {
    submitted.push(['confirm', config]);
  });
  let styleIndex = 0;
  const styled = {
    get div() {
      return sc.default.div.withConfig({ componentId: 'only-sync-fixture-' + styleIndex++ });
    },
  };
  const cache = new Map<string, unknown>();
  let utils: unknown;
  function compile(source: string, filename: string, extra: Record<string, unknown> = {}): unknown {
    const transformed = harness.transformSync(source, {
      filename,
      comments: false,
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
    });
    assert.ok(transformed?.code);
    const module: { exports: unknown } = { exports: {} };
    new Function('module', 'exports', 'require', ...Object.keys(globals), ...Object.keys(extra), transformed.code)(
      module,
      module.exports,
      (name: string): unknown => {
        if (name === 'react') return { ...React, useState, useEffect, useRef };
        if (name === 'react/jsx-runtime') return require(name);
        if (['lodash', 'prop-types'].includes(name)) return require(name);
        if (name === 'react-use') return { useSetState };
        if (name === 'antd') return { Select: UI['Select'] };
        if (name === 'styled-components' || name === 'src/utils/typedStyled')
          return { __esModule: true, default: styled };
        if (name === 'ming-ui') return UI;
        if (name === 'ming-ui/antd-components') return { Tooltip: UI['Tooltip'] };
        if (name.includes('/api/datasource') || name === 'src/api/worksheet') return { __esModule: true, default: api };
        if (name === '../../../constant') return constants;
        if (name === '../../../utils') return utils;
        if (name === 'src/pages/widgetConfig/util') return { getIconByType: (value: unknown) => String(value) };
        if (name === './LeftTableList') return { __esModule: true, default: UI['LeftTableList'] };
        if (name === './SheetGroupSelect') return { __esModule: true, default: UI['SheetGroupSelect'] };
        if (name.includes('FieldsMappingList')) return { __esModule: true, default: UI['FieldMappingList'] };
        if (name.includes('SelectTables')) return { __esModule: true, default: UI['SelectTables'] };
        if (name.includes('TimingSetting')) return { __esModule: true, default: UI['TimingSetting'] };
        if (name === './connectorBoundary') return load('connectorBoundary.ts');
        throw new Error('Unstubbed dependency ' + name);
      },
      ...Object.values(globals),
      ...Object.values(extra),
    );
    return module.exports;
  }
  function load(name: string): unknown {
    if (cache.has(name)) return cache.get(name);
    const loaded = compile(fs.readFileSync(path.join(__dirname, name), 'utf8'), path.join(__dirname, name));
    cache.set(name, loaded);
    return loaded;
  }
  const constantNames = [
    'DATABASE_TYPE',
    'CREATE_TYPE',
    'CREATE_TYPE_RADIO_LIST',
    'namePattern',
    'TRIGGER_WORKFLOW_CHECKBOX_OPTIONS',
    'isPostgresqlDestinationType',
    'lowercaseIfString',
    'isValidName',
    'SYSTEM_FIELD_IDS',
    'PERSONNEL_FIELDS',
    'DEPT_FIELDS',
    'RELATED_RECORD_FIELDS',
  ];
  const constants = compile(
    selected('src/pages/integration/dataIntegration/constant.ts', constantNames),
    'constant.ts',
  );
  assert.ok(object(constants));
  const score = compile(selected('src/pages/widgetConfig/config/score.ts', ['NUM_5_SETTINGS']), 'score.ts');
  assert.ok(object(score));
  const widget = compile(
    selected('src/pages/widgetConfig/config/widget.ts', [
      'getDefaultOptions',
      'genDefaultOptionsAndChecked',
      'DEFAULT_DATA',
      'WIDGETS_TO_API_TYPE_ENUM',
    ]),
    'widget.ts',
    { ...score, uuidv4: () => 'uuid-fixture' },
  );
  assert.ok(object(widget));
  const titleConfig = compile(
    selected('src/pages/widgetConfig/config/index.ts', ['NOT_AS_TITLE_CONTROL']),
    'title-config.ts',
  );
  assert.ok(object(titleConfig));
  const widgetUtils = compile(
    selected('src/pages/widgetConfig/util/index.ts', ['enumObj', 'enumWidgetType', 'canSetAsTitle']),
    'widget-utils.ts',
    { ...widget, ...titleConfig, keys: lodash.keys, includes: lodash.includes },
  );
  assert.ok(object(widgetUtils));
  const utilNames = [
    'getInitFieldsMapping',
    'getDuplicateFieldsRenamedList',
    'getInitWorkSheetFields',
    'getMatchedFieldsOptions',
    'getDefaultData',
    'isNotSupportField',
  ];
  utils = compile(selected('src/pages/integration/dataIntegration/utils.ts', utilNames), 'utils.ts', {
    _: lodash,
    ...constants,
    ...widget,
    ...widgetUtils,
  });
  const output = compile(
    fs.readFileSync(historical && before ? before : path.join(__dirname, 'index.tsx'), 'utf8'),
    path.join(__dirname, 'index.tsx'),
  );
  const component = read(output, 'default');
  assert.equal(typeof component, 'function');
  const actualProps = { ...input, setSubmitData: (value: unknown) => submitted.push(value) };
  return {
    states,
    requests,
    errors,
    submitted,
    handlers,
    UI,
    boundary: load('connectorBoundary.ts'),
    render() {
      cursor = 0;
      dirty = false;
      if (typeof component !== 'function') throw new Error('Actual component');
      rendered = Reflect.apply(component, undefined, [actualProps]);
      return rendered;
    },
    async flush() {
      for (let i = 0; i < 12; i++) {
        const queued = pending;
        pending = [];
        for (const effect of queued) {
          const cleanup = effect.callback();
          if (typeof cleanup === 'function')
            effect.cleanup = () => {
              Reflect.apply(cleanup, undefined, []);
            };
        }
        for (let turn = 0; turn < 12; turn++) await Promise.resolve();
        if (dirty) {
          this.render();
          continue;
        }
        if (!pending.length) return;
      }
      throw new Error('Fixture effects did not settle');
    },
    unmount() {
      for (const effect of effects.values()) effect.cleanup?.();
    },
    html(tree) {
      const sheet = new sc.ServerStyleSheet();
      try {
        return { html: ReactDOM.renderToStaticMarkup(sheet.collectStyles(node(tree))), css: sheet.getStyleTags() };
      } finally {
        sheet.seal();
      }
    },
  };
}
let observations = 0;
function observe(label: string, run: (historical: boolean) => unknown): void {
  const current = run(false);
  if (before) assert.deepEqual(current, run(true), label);
  observations++;
}
for (const sourceType of ['MYSQL', 'MING_DAO_YUN', 'KAFKA', 'HANA'])
  for (const destType of ['MYSQL', 'MING_DAO_YUN', 'MONGODB'])
    for (const create of ['NEW', 'SELECT_EXIST']) {
      observe('render ' + [sourceType, destType, create].join(':'), historical => {
        const r = fixture(props(sourceType, destType), initial(sourceType, destType, create), historical);
        return r.html(r.render());
      });
    }
observe('no selected tab', historical => {
  const r = fixture(props(), [], historical);
  return r.html(r.render());
});
for (const destType of ['MYSQL', 'MING_DAO_YUN']) {
  for (const create of ['NEW', 'SELECT_EXIST']) {
    observe('actual installed Antd Select ' + destType + ':' + create, historical => {
      const r = fixture(props('MING_DAO_YUN', destType), initial('MING_DAO_YUN', destType, create), historical, true);
      return r.html(r.render());
    });
  }
}
for (const action of [
  'db',
  'schema',
  'name',
  'blur',
  'workflow',
  'group',
  'duplicate',
  'writeMode',
  'mapping',
  'delete',
  'schedule',
  'close',
]) {
  observe('event ' + action, historical => {
    const input = props('HANA', 'MING_DAO_YUN');
    const seed = initial(
      'HANA',
      'MING_DAO_YUN',
      action === 'duplicate' || action === 'writeMode' ? 'SELECT_EXIST' : 'NEW',
    );
    if (action === 'db' || action === 'schema') {
      input['dest'] = { id: 'd', type: 'MYSQL', hasSchema: action === 'schema' };
    }
    const r = fixture(input, seed, historical);
    const tree = r.render();
    if (action === 'db')
      event(
        find(tree, e => e.type === r.UI['Select'] && e.props['labelInValue'] === true),
        'onChange',
        [{ value: 'changed', label: 'Changed' }],
      );
    if (action === 'schema') {
      const selects = walk(tree).filter(e => e.type === r.UI['Select'] && e.props['labelInValue'] === true);
      assert.ok(selects[1]);
      event(selects[1], 'onChange', [{ value: 'schema2', label: 'Schema2' }]);
    }
    if (action === 'name' || action === 'blur')
      event(
        find(tree, e => e.type === r.UI['Input']),
        action === 'name' ? 'onChange' : 'onBlur',
        action === 'name' ? ['New name'] : [{ target: { value: 'Trim / name' } }],
      );
    if (action === 'workflow')
      event(
        find(tree, e => e.type === r.UI['Checkbox'] && e.props['className'] === 'pRight30'),
        'onClick',
      );
    if (action === 'group')
      event(
        find(tree, e => e.type === r.UI['SheetGroupSelect']),
        'onChange',
        [null],
      );
    if (action === 'duplicate')
      event(
        find(tree, e => e.type === r.UI['Select'] && e.props['allowClear'] === true),
        'onChange',
        ['id'],
      );
    if (action === 'writeMode')
      event(
        find(
          tree,
          e =>
            e.type === r.UI['Select'] &&
            Array.isArray(e.props['options']) &&
            e.props['options'].some(o => object(o) && o['value'] === 'SKIP'),
        ),
        'onChange',
        ['OVERWRITE'],
      );
    if (action === 'mapping')
      event(
        find(tree, e => e.type === r.UI['FieldMappingList']),
        'setFieldsMapping',
        [mapping],
      );
    if (action === 'delete')
      event(
        find(tree, e => e.type === r.UI['LeftTableList']),
        'onDelete',
        ['db', 'table'],
      );
    if (action === 'schedule')
      event(
        find(tree, e => e.type === r.UI['TimingSetting']),
        'onChange',
        [{ readType: 1, config: { basisField: { id: 'id' } } }],
      );
    if (action === 'close')
      event(
        find(tree, e => e.props['className'] === 'tabNav'),
        'onClick',
      );
    return { states: r.states.slice(0, 8), requests: r.requests };
  });
}
async function asynchronous(): Promise<void> {
  for (const sourceType of ['MYSQL', 'MING_DAO_YUN', 'KAFKA', 'HANA'])
    for (const destType of ['MYSQL', 'MING_DAO_YUN']) {
      const run = async (historical: boolean) => {
        const seed = initial(sourceType, destType);
        seed[5] = {};
        seed[3] = {};
        seed[7] = true;
        const r = fixture(props(sourceType, destType), seed, historical);
        r.render();
        await r.flush();
        return { states: r.states.slice(0, 8), requests: r.requests, submitted: r.submitted };
      };
      const current = await run(false);
      if (before) assert.deepEqual(current, await run(true), 'actual APIs ' + sourceType + ':' + destType);
      observations++;
    }
  for (const action of [
    'createNew',
    'selectExisting',
    'targetTable',
    'primaryKey',
    'confirmClear',
    'cancelClear',
    'submitAliases',
  ]) {
    const run = async (historical: boolean) => {
      const sourceType = action === 'primaryKey' ? 'MING_DAO_YUN' : 'MYSQL';
      const destType = action === 'primaryKey' ? 'MONGODB' : 'MING_DAO_YUN';
      const seed = initial(
        sourceType,
        destType,
        action === 'createNew' || action.includes('Clear') ? 'SELECT_EXIST' : 'NEW',
      );
      const r = fixture(props(sourceType, destType), seed, historical);
      const tree = r.render();
      if (action === 'createNew' || action === 'selectExisting') {
        const returned = event(
          find(tree, e => e.type === r.UI['RadioGroup']),
          'onChange',
          [action === 'createNew' ? 'NEW' : 'SELECT_EXIST'],
        );
        if (returned && object(returned) && typeof returned['then'] === 'function') await returned;
      }
      if (action === 'targetTable') {
        const sheetState = r.states[2];
        assert.ok(object(sheetState));
        const database = sheetState['db'];
        assert.ok(object(database));
        const table = database['table'];
        assert.ok(object(table));
        table['sheetCreateType'] = 'SELECT_EXIST';
        event(
          find(r.render(), e => e.type === r.UI['SelectTables']),
          'onChangeTable',
          [{ label: 'Existing', value: 'existing' }],
        );
      }
      if (action === 'primaryKey')
        event(
          find(
            tree,
            e =>
              e.type === r.UI['Select'] &&
              Array.isArray(e.props['options']) &&
              e.props['options'].some(option => object(option) && option['value'] === 'other'),
          ),
          'onChange',
          ['other'],
        );
      if (action.includes('Clear')) {
        event(
          find(tree, e => e.type === r.UI['Checkbox'] && e.props['text'] === '在本次同步数据之前，彻底清空目标表数据'),
          'onClick',
          [action === 'cancelClear'],
        );
        if (action === 'confirmClear') {
          const dialog = r.submitted.find(v => Array.isArray(v) && v[0] === 'confirm');
          assert.ok(Array.isArray(dialog));
          call(dialog[1], 'onOk');
          // The recording seam owns the dialog; callback remains the actual component closure.
          r.submitted.length = 0;
        }
      }
      await r.flush();
      if (action === 'submitAliases') {
        const batch = r.submitted.find(v => Array.isArray(v) && object(v[0]) && v[0]['sourceNode'] !== undefined);
        assert.ok(Array.isArray(batch));
        const sourceNode = read(batch[0], 'sourceNode');
        const fields = read(sourceNode, 'fields');
        assert.ok(Array.isArray(fields));
        assert.equal(read(fields[0], 'alias'), 'ID');
        const destNode = read(batch[0], 'destNode');
        const config = read(destNode, 'config');
        const submittedMapping = read(config, 'fieldsMapping');
        assert.ok(Array.isArray(submittedMapping));
        assert.equal(
          read(submittedMapping[1], 'destField'),
          null,
          'Unchecked mapping is preserved with a null destination',
        );
      }
      return { states: r.states.slice(0, 8), requests: r.requests, submitted: r.submitted };
    };
    const current = await run(false);
    if (before) assert.deepEqual(current, await run(true), 'Actual asynchronous event ' + action);
    observations++;
  }
  for (const method of ['getDatabases', 'getTableFields', 'getWorksheetInfo', 'fillJdbcType', 'fieldsDataTypeMatch'])
    for (const transport of [false, true]) {
      const isWorksheet = method === 'getWorksheetInfo' || method === 'fillJdbcType';
      const input = props(isWorksheet ? 'MING_DAO_YUN' : 'MYSQL', method === 'getDatabases' ? 'MYSQL' : 'MING_DAO_YUN');
      const seed = initial(isWorksheet ? 'MING_DAO_YUN' : 'MYSQL', 'MING_DAO_YUN');
      seed[5] = {};
      seed[3] = {};
      seed[7] = true;
      const r = fixture(input, seed);
      const normal = r.handlers[method];
      r.handlers[method] = () => (transport ? Promise.reject(new Error('offline')) : { bad: true });
      r.render();
      await r.flush();
      assert.ok(r.errors.length, method + ' error propagated');
      assert.equal(r.states[7], false, method + ' loading exits');
      const tree = r.render();
      const retry = find(tree, e => e.type === 'button');
      r.handlers[method] = normal || (() => []);
      event(retry, 'onClick');
      await r.flush();
      assert.equal(r.errors.length, 1, method + ' successful retry has no added error');
      assert.equal(
        walk(r.render()).some(e => e.props['role'] === 'alert'),
        false,
        method + ' failure cleared after retry',
      );
      observations++;
    }
  const r = fixture(props(), initial('MYSQL', 'MYSQL'));
  r.render();
  await r.flush();
  const left = find(r.render(), e => e.type === r.UI['LeftTableList']);
  let finish: ((value: unknown) => void) | undefined;
  r.handlers['getTableFields'] = () =>
    new Promise<unknown>(resolve => {
      finish = resolve;
    });
  event(left, 'setCurrentTab', [{ db: 'db', table: 'new', tableName: 'New' }]);
  r.render();
  await r.flush();
  r.unmount();
  const snapshot = structuredClone(r.states);
  assert.ok(finish);
  finish([field]);
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
  assert.deepEqual(r.states, snapshot, 'Unmounted completion does not update hooks');
  observations++;
}
const boundary = fixture(props(), []).boundary;
assert.equal(call(boundary, 'syncFields', [[field, extra]]) instanceof Array, true);
const tab = { db: 'db', table: 'table', tableName: undefined, extra: { keep: true } };
assert.equal(call(boundary, 'syncSourceTab', [tab]), tab);
assert.throws(() => call(boundary, 'syncSourceTab', [{ db: 1 }]), TypeError);
const fields = [field, extra];
assert.equal(call(boundary, 'syncFields', [fields]), fields);
assert.equal(call(boundary, 'syncMatchedTypes', [matching]), matching);
assert.equal(call(boundary, 'syncMappings', [mapping]), mapping);
for (const bad of [
  null,
  {},
  [null],
  [{ ...field, name: 2 }],
  [{ ...field, isPk: 'true' }],
  [{ ...field, controlSetting: { strDefault: 10 } }],
  new Array(1),
])
  assert.throws(() => call(boundary, 'syncFields', [bad]), TypeError);
for (const bad of [
  { matchedTypes: { id: [{ typeName: 2 }] } },
  { matchedTypes: { id: [{ typeName: 'SQL', mdType: '2' }] } },
  { matchedTypes: [] },
])
  assert.throws(() => call(boundary, 'syncMatchResponse', [bad]), TypeError);
for (const bad of [
  { template: {} },
  { template: { controls: [{ controlId: 2 }] } },
  { template: { controls: [{ type: 26, advancedSetting: { usertype: 2 } }] } },
])
  assert.throws(() => call(boundary, 'syncWorksheetControls', [bad]), TypeError);
void asynchronous()
  .then(() =>
    console.log(
      JSON.stringify({ actualObservations: observations, historicalAB: Boolean(before), apiFailureRetryCases: 10 }),
    ),
  )
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
