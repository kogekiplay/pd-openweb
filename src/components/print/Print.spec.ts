import type { ReactNode } from 'react';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const fs: typeof import('node:fs') = require('node:fs');
const react: typeof import('react') = require('react');
const server: typeof import('react-dom/server') = require('react-dom/server');
const lodash: typeof import('lodash') = require('lodash');
const harness: import('../../../scripts/spec-harness').SpecHarness = require('../../../scripts/spec-harness.ts');
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new Error('Invalid fixture receiver');
  return Reflect.get(value, key);
}
function invoke(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new Error('Missing fixture method: ' + key);
  return Reflect.apply(fn, value, args);
}
function state(value: unknown): Record<string, unknown> {
  const result = read(value, 'state');
  if (!object(result)) throw new Error('Invalid state');
  return result;
}
function nodes(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (react.isValidElement(value)) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value;
  if (Array.isArray(value)) return value.map(nodes);
  throw new Error('Invalid rendered fixture node');
}
function html(value: unknown): string {
  // HTML attribute names are case-insensitive in the actual browser DOM. React's
  // legacy lowercase vs official JSX spelling differs only in the SSR text.
  return server
    .renderToStaticMarkup(react.createElement(react.Fragment, null, nodes(value)))
    .replace(/cellPadding=/g, 'cellpadding=')
    .replace(/cellSpacing=/g, 'cellspacing=');
}
function walk(value: unknown): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!object(value) || !object(value['props'])) return [];
  return [{ type: value['type'], props: value['props'] }, ...walk(value['props']['children'])];
}
class Component {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  updates = 0;
  batch = false;
  pending: Array<{ patch: unknown; callback?: (() => void) | undefined }> = [];
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(patch: unknown, callback?: () => void): void {
    if (this.batch) {
      this.pending.push({ patch, callback });
      return;
    }
    this.apply(patch, callback);
  }
  private apply(patch: unknown, callback?: () => void): void {
    const data: unknown =
      typeof patch === 'function' ? Reflect.apply(patch, undefined, [this.state, this.props]) : patch;
    if (!object(data)) throw new Error('Invalid setState');
    Object.assign(this.state, data);
    this.updates++;
    callback?.();
  }
  flushUpdates(): void {
    for (const item of this.pending.splice(0)) this.apply(item.patch, item.callback);
  }
}
interface Request {
  name: string;
  args: unknown;
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(value: unknown): void;
}
interface Fixture {
  target: unknown;
  boundary: unknown;
  requests: Request[];
  intervals: Map<number, () => void>;
  cleared: number[];
  printCalls: number;
  create(type?: string): unknown;
}
const root = path.resolve(__dirname, '../../..');
const originalSource = process.env['PRINT_BEFORE_SOURCE'];
function fixture(before = false): Fixture {
  const requests: Request[] = [];
  const intervals = new Map<number, () => void>();
  const cleared: number[] = [];
  const cache = new Map<string, unknown>();
  let timer = 0;
  const data: Fixture = {
    target: undefined,
    boundary: undefined,
    requests,
    intervals,
    cleared,
    printCalls: 0,
    create: () => undefined,
  };
  const window = {
    localStorage: { getItem: () => null },
    location: { search: '?app&&view&&sheet&&project&&1' },
    print() {
      data.printCalls++;
    },
  };
  const document = { title: '' };
  const md = {
    global: { Account: { projects: [{ projectId: 'project' }] }, Config: { Logo: undefined, AjaxApiUrl: '/api/' } },
  };
  const translate = (text: string, ...args: unknown[]) =>
    text.replace(/%([0-9]+)/g, (_, id: string) => String(args[Number(id)]));
  const api = (name: string, args: unknown): Promise<unknown> => {
    let resolve: (value: unknown) => void = () => {},
      reject: (value: unknown) => void = () => {};
    const promise = new Promise<unknown>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    requests.push({ name, args, promise, resolve, reject });
    return promise;
  };
  function UI(props: { children?: ReactNode | undefined }): ReactNode {
    return react.createElement('span', null, props.children);
  }
  const control = {
    renderText(cell: { value?: unknown }) {
      return cell.value || '';
    },
    formatFormulaDate({ value }: { value?: unknown }) {
      return String(value);
    },
  };
  const common = {
    accAdd: (a: number, b: number) => a + b,
    accDiv: (a: number, b: number) => a / b,
    accMul: (a: number, b: number) => a * b,
    htmlDecodeReg: (value: unknown) => (value ? String(value).replace(/&lt;/g, '<').replace(/&gt;/g, '>') : ''),
    pathCompletion: (value: string) => value,
  };
  function load(file: string): unknown {
    const cached = cache.get(file);
    if (cached) return cached;
    const result: { exports: unknown } = { exports: {} };
    const source = fs.readFileSync(file, 'utf8');
    const compiled = harness.transformSync(source, {
      filename: file,
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
      comments: false,
    });
    if (!compiled?.code) throw new Error('Failed to compile actual source');
    new Function(
      'module',
      'exports',
      'require',
      '_l',
      'window',
      'document',
      'md',
      '$',
      'setInterval',
      'clearInterval',
      'safeLocalStorageSetItem',
      'alert',
      'console',
      compiled.code,
    )(
      result,
      result.exports,
      (name: string): unknown => {
        if (name === 'react') return { ...react, Component };
        if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
        if (
          name === 'lodash' ||
          name === 'moment' ||
          name === 'nzh' ||
          name === 'prop-types' ||
          name === 'xss' ||
          name === 'classnames'
        )
          return require(name);
        if (name === 'src/api/projectSetting') return { getSysColor: (args: unknown) => api('logo', args) };
        if (name === 'src/api/taskCenter') return { getTaskDetail4Print: (args: unknown) => api('task', args) };
        if (name === 'src/api/worksheet')
          return {
            getWorksheetInfo: (args: unknown) => api('sheet', args),
            getRowByID: (args: unknown) => api('row', args),
            getWorksheetShareUrl: (args: unknown) => api('share', args),
            getRowRelationRows: (args: unknown) => api('relation', args),
          };
        if (name === 'src/utils/common') return common;
        if (name === 'src/utils/control') return control;
        if (name === 'src/utils/expression')
          return { fileIsPicture: (ext: unknown) => /\.(png|jpg)$/i.test(String(ext)) };
        if (name === './model') return load(path.join(__dirname, 'model.ts'));
        if (name === './printBoundary') return load(path.join(__dirname, 'printBoundary.ts'));
        if (name === './PrintOptDialog') return load(path.join(__dirname, 'PrintOptDialog.tsx'));
        if (name === 'ming-ui') return { Checkbox: UI, Dialog: UI };
        if (name.startsWith('ming-ui/components/')) return UI;
        if (name.endsWith('.less')) return {};
        throw new Error('Unstubbed print dependency: ' + name);
      },
      translate,
      window,
      document,
      md,
      () => ({ addClass() {}, length: 0, remove() {} }),
      (callback: () => void) => {
        const id = ++timer;
        intervals.set(id, callback);
        return id;
      },
      (id: number) => {
        intervals.delete(id);
        cleared.push(id);
      },
      () => undefined,
      () => undefined,
      { log() {}, error() {} },
    );
    cache.set(file, result.exports);
    return result.exports;
  }
  data.target = load(before && originalSource ? originalSource : path.join(__dirname, 'Print.tsx'));
  data.boundary = load(path.join(__dirname, 'printBoundary.ts'));
  data.create = (type = 'worksheet') => {
    const constructor = read(data.target, 'default');
    if (typeof constructor !== 'function') throw new Error('Missing Print constructor');
    return Reflect.construct(constructor, [{ match: { params: { typeId: 'record', printType: type } } }]);
  };
  return data;
}
function request(f: Fixture, name: string, index = 0): Request {
  const result = f.requests.filter(item => item.name === name)[index];
  if (!result) throw new Error('Missing request ' + name);
  return result;
}
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
const observations: Array<{ label: string; current: string; before?: string | undefined }> = [];
function parity(label: string, current: unknown, previous: unknown): void {
  const currentHtml = html(current);
  const beforeHtml = originalSource ? html(previous) : undefined;
  if (beforeHtml !== undefined) assert.equal(currentHtml, beforeHtml, label);
  observations.push({ label, current: currentHtml, before: beforeHtml });
}
const attachment = JSON.stringify([
  { originalFilename: 'Photo', ext: '.jpg', previewUrl: 'https://cdn.test/photo?x=1' },
  { originalFilename: 'Notes', ext: '.txt' },
]);
const controlCases: Record<string, unknown>[] = [
  ...[1, 2, 3, 4, 5, 7, 19, 23, 24, 25, 32, 33, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009].map(
    type => ({ type, value: 'Text' }),
  ),
  ...[6, 8, 20, 31, 37].map(type => ({ type, value: '1234.5', dot: 2, unit: 'kg' })),
  { type: 9, value: 2, options: [{ key: '2', value: 'Two' }] },
  { type: 9, value: 'missing', options: [] },
  { type: 9, value: 'two', options: [{ key: 'two' }] },
  {
    type: 10,
    value: '101',
    options: [
      { key: '100', value: 'A' },
      { key: '1', value: 'B' },
    ],
  },
  { type: 11, value: 'x', options: [{ key: 'x', value: 'X' }] },
  { type: 11, value: JSON.stringify({ label: JSON.stringify(['A', 'B']) }), dataSource: 'sheet' },
  { type: 11, value: JSON.stringify({ label: 'plain' }), dataSource: 'sheet' },
  { type: 14, value: attachment },
  { type: 15, value: '2026-01-02' },
  { type: 16, value: '2026-01-02 03:04' },
  ...[17, 18].flatMap(type => [
    { type, value: '["2026-01-01 10:00","2026-01-02 12:30"]', enumDefault2: 1 },
    { type, value: '["",""]' },
    { type, value: '[]' },
    { type, value: '' },
  ]),
  { type: 21, value: '[{"type":1,"name":"Task"},{"type":2,"name":"Project"},{"type":7}]' },
  { type: 26, value: '[{"fullname":"Alice"},{}]' },
  { type: 27, value: '[{"departmentName":"Dept"}]' },
  { type: 27, value: '{}' },
  { type: 28, value: '3', enumDefault: 1 },
  { type: 28, value: '8', enumDefault: 2 },
  { type: 29, enumDefault: 1, sourceControlType: 2, value: '[{"name":"A"},{}]' },
  { type: 30, sourceControlType: 2, value: 'Source text' },
  { type: 36, value: '1' },
  { type: 36, value: 1 },
  { type: 38, value: '2', enumDefault: 1, unit: '6' },
  { type: 38, value: 'text', enumDefault: 0 },
  { type: 40, value: '{"title":"Office","address":"Road"}' },
  { type: 40, value: '{}' },
  { type: 41, value: '<b>Text</b><script>bad()</script>' },
  { type: 42, value: '/signature.png' },
  { type: 10010, value: '<p>Remark</p>' },
  { type: 999, value: 'Ignored' },
];
function compareControls(currentFixture: Fixture, beforeFixture: Fixture): void {
  const c = currentFixture.create(),
    b = beforeFixture.create();
  for (const item of controlCases)
    parity(
      'control-' + String(item['type']) + '-' + observations.length,
      invoke(c, 'getShowContent', [item]),
      originalSource ? invoke(b, 'getShowContent', [item]) : undefined,
    );
  for (const type of [1, 6, 15, 28, 36, 38])
    for (const value of ['', 0, false, undefined, null]) {
      const item = { type, value };
      parity(
        'empty-' + type + '-' + String(value),
        invoke(c, 'getShowContent', [item]),
        originalSource ? invoke(b, 'getShowContent', [item]) : undefined,
      );
    }
  for (const type of ['task', 'hr', 'workflow', 'worksheet']) {
    const current = currentFixture.create(type),
      before = beforeFixture.create(type);
    const range =
      type === 'task' || type === 'hr' ? '1767261600000,1767357000000' : '["2026-01-01 10:00","2026-01-02 12:30"]';
    for (const control of [
      { type: 17, value: range, enumDefault2: 1 },
      { type: 18, value: range, enumDefault2: 1 },
      { type: 14, value: attachment },
      { type: 26, value: type === 'task' || type === 'hr' ? '{"fullname":"Alice"}' : '[{"fullname":"Alice"}]' },
    ])
      parity(
        type + '-special-' + String(control.type),
        invoke(current, 'getShowContent', [control]),
        originalSource ? invoke(before, 'getShowContent', [control]) : undefined,
      );
  }
}
function compareLayouts(currentFixture: Fixture, beforeFixture: Fixture): void {
  for (const detailsType of [1, 2])
    for (const printDetailType of [1, 2, 3])
      for (const size of [1, 2, 3, 4, 5]) {
        const controls = Array.from({ length: size }, (_, i) => ({
          controlId: 'c' + i,
          controlName: 'Field ' + i,
          type: 6,
          value: String(i + 1),
          innerRow: i,
          needEvaluate: true,
          enumDefault2: 2,
          dot: 0,
        }));
        const c = currentFixture.create('hr'),
          b = beforeFixture.create('hr');
        for (const target of [c, b])
          Object.assign(
            state(target),
            lodash.cloneDeep({
              detailsType,
              controls: {
                0: [{ type: 0, formId: 'detail', controlId: 'detail', controlName: 'Details', printDetailType }],
              },
              formControls: [{ formId: 'detail', tempControls: controls, controls: [controls] }],
              reqInfo: { reqTitle: 'Request' },
            }),
          );
        parity(
          'detail-' + detailsType + '-' + printDetailType + '-' + size,
          invoke(c, 'renderControls'),
          originalSource ? invoke(b, 'renderControls') : undefined,
        );
      }
  // Missing innerRow used to create NaN comparisons; these members stay excluded from vertical detail groups.
  for (const detailsType of [1, 2]) {
    const controls = [
      { type: 2, controlName: 'Missing', value: 'M' },
      { type: 2, innerRow: 1, controlName: 'One', value: '1' },
      { type: 2, innerRow: 0, controlName: 'Zero', value: '0' },
    ];
    const c = currentFixture.create('hr'),
      b = beforeFixture.create('hr');
    for (const target of [c, b])
      Object.assign(
        state(target),
        lodash.cloneDeep({
          detailsType,
          controls: { 0: [{ type: 0, formId: 'detail', printDetailType: 2 }] },
          formControls: [{ formId: 'detail', tempControls: controls, controls: [controls] }],
        }),
      );
    parity(
      'undefined-innerRow-' + detailsType,
      invoke(c, 'renderControls'),
      originalSource ? invoke(b, 'renderControls') : undefined,
    );
  }
  for (const detailsType of [1, 2]) {
    const c = currentFixture.create(),
      b = beforeFixture.create();
    state(c)['detailsType'] = detailsType;
    state(b)['detailsType'] = detailsType;
    const relation = {
      template: {
        controls: [
          { controlId: 'name', type: 2, controlName: 'Name' },
          { controlId: 'n', type: 6, dot: 1, controlName: 'Number' },
        ],
      },
      data: [
        { name: 'A', n: '1.5', rowid: 7, metadata: { opaque: true } },
        { name: 'B', n: '2' },
      ],
    };
    parity(
      'relation-table-' + detailsType,
      invoke(c, 'renderTable', [relation, { showControls: ['name', 'n', 'ctime'] }]),
      originalSource ? invoke(b, 'renderTable', [relation, { showControls: ['name', 'n', 'ctime'] }]) : undefined,
    );
  }
  for (const controls of [
    [
      { type: 2, col: 0, controlName: 'Left', value: 'A' },
      { type: 6, col: 1, value: '2' },
    ],
    [
      { type: 6, col: 0, value: '2' },
      { type: 2, col: 0, value: 'A' },
    ],
    [
      { type: 2, col: 0, value: 'Hidden', printHide: true },
      { type: 2, col: 1, value: 'Shown' },
    ],
  ]) {
    const c = currentFixture.create(),
      b = beforeFixture.create();
    for (const target of [c, b]) state(target)['controls'] = { 0: controls };
    parity(
      'two-column-' + observations.length,
      invoke(c, 'renderControls'),
      originalSource ? invoke(b, 'renderControls') : undefined,
    );
  }
  for (const enumDefault2 of [2, 3, 4, 5, 6]) {
    const c = currentFixture.create(),
      b = beforeFixture.create();
    const rows = [[{ controlId: 'num', value: 2 }], [{ controlId: 'num', value: 3 }]];
    const control = { controlId: 'num', type: 8, enumDefault: 1, enumDefault2, dot: 2, unit: '$' };
    parity(
      'evaluate-' + enumDefault2,
      invoke(c, 'getEvaluateValue', [rows, control]),
      originalSource ? invoke(b, 'getEvaluateValue', [rows, control]) : undefined,
    );
  }
  for (const detailsType of [1, 2]) {
    const expanded = [
      { type: 15, controlName: 'Start', value: '2026-01-01' },
      { type: 15, controlName: 'End', value: '2026-01-02' },
    ];
    const controls = [
      { type: 17, dataSource: 1, controlName: 'Range', value: expanded, innerRow: 0 },
      { type: 2, controlName: 'Text', value: 'Text', innerRow: 1 },
    ];
    const c = currentFixture.create('hr'),
      b = beforeFixture.create('hr');
    for (const target of [c, b])
      Object.assign(
        state(target),
        lodash.cloneDeep({
          detailsType,
          controls: { 0: [{ type: 0, formId: 'expanded', printDetailType: 2 }] },
          formControls: [{ formId: 'expanded', tempControls: controls, controls: [controls] }],
        }),
      );
    parity(
      'expanded-date-detail-' + detailsType,
      invoke(c, 'renderControls'),
      originalSource ? invoke(b, 'renderControls') : undefined,
    );
  }
  for (const process of ['all', 'some', 'no']) {
    const c = currentFixture.create('hr'),
      b = beforeFixture.create('hr');
    const controls = [{ type: 2, controlId: 'text', row: 0, value: 'Text' }];
    const reqWorks = {
      taskList: [
        { workItems: [], workItemLogList: [{ action: 1 }, { action: 4 }, { action: 18 }] },
        { countersignType: 1, workItems: [{ workItemLogList: [{ action: 1 }, { action: 5 }] }], workItemLogList: [] },
      ],
      manageList: [{ workItems: [], workItemLogList: [{ action: 12 }, { action: 1 }, { action: 21 }] }],
    };
    for (const target of [c, b]) Object.assign(state(target), lodash.cloneDeep({ reqInfo: { controls }, reqWorks }));
    invoke(c, 'changePrintVisible', [process, true, ['text']]);
    if (originalSource) invoke(b, 'changePrintVisible', [process, true, ['text']]);
    for (const key of ['taskList', 'manageList', 'printWorkList'])
      if (originalSource) assert.deepEqual(state(c)[key], state(b)[key], 'workflow ' + process + ' ' + key);
    observations.push({
      label: 'workflow-process-' + process,
      current: JSON.stringify(state(c)['printWorkList']),
      before: originalSource ? JSON.stringify(state(b)['printWorkList']) : undefined,
    });
  }
  for (const type of ['task', 'workflow']) {
    const current = currentFixture.create(type),
      before = beforeFixture.create(type);
    const value = {
      worksheetId: undefined,
      showPrintDialog: true,
      controlOption: 'all',
      reqInfo: {
        controls: [{ controlId: 'text', controlName: 'Text', type: 2, row: 0, value: 'Text' }],
        formControls: [],
      },
      task: [
        { key: 'parent', name: 'Parent', show: true, independent: false, value: 'Value' },
        { key: 'checklist', name: 'Checklist', show: true, independent: true, value: [] },
        { key: 'subTask', name: 'Subtask', show: true, independent: true, value: [] },
      ],
      workflow: [{ show: true, flowNode: { id: 'node', name: 'Node' }, metadata: { retained: true } }],
    };
    for (const target of [current, before]) Object.assign(state(target), lodash.cloneDeep(value));
    const assemble = (target: unknown): unknown => {
      const element = walk(invoke(target, 'render')).find(
        node => typeof node.type === 'function' && node.props['changePrintVisible'] !== undefined,
      );
      if (!element || typeof element.type !== 'function') throw new Error('Missing actual PrintOptDialog');
      return Reflect.construct(element.type, [element.props]);
    };
    const currentDialog = assemble(current),
      oldDialog = originalSource ? assemble(before) : undefined;
    const toggle = type === 'task' ? 'toggleTaskCheckItem' : 'toggleWorkflowCheckItem';
    const key = type === 'task' ? 'parent' : 'node';
    invoke(currentDialog, toggle, [key]);
    if (oldDialog) invoke(oldDialog, toggle, [key]);
    parity(
      type + '-actual-print-options',
      invoke(currentDialog, 'render'),
      oldDialog ? invoke(oldDialog, 'render') : undefined,
    );
    const confirm = walk(invoke(currentDialog, 'render')).find(node => typeof node.props['onOk'] === 'function');
    assert.ok(confirm);
    const onOk = confirm.props['onOk'];
    assert.ok(typeof onOk === 'function');
    Reflect.apply(onOk, undefined, []);
    if (oldDialog) {
      const oldConfirm = walk(invoke(oldDialog, 'render')).find(node => typeof node.props['onOk'] === 'function');
      assert.ok(oldConfirm);
      const callback = oldConfirm.props['onOk'];
      assert.ok(typeof callback === 'function');
      Reflect.apply(callback, undefined, []);
      assert.deepEqual(
        state(current)[type === 'task' ? 'task' : 'workflow'],
        state(before)[type === 'task' ? 'task' : 'workflow'],
      );
    }
  }
}
function successWorksheet(f: Fixture, label: string, index = 0): void {
  request(f, 'sheet', index).resolve({ name: label });
  request(f, 'row', index).resolve({
    receiveControls: [
      { controlId: 'title', controlName: 'Title', type: 2, value: label, row: 0, attribute: 1 },
      { controlId: 'sig', type: 42, value: '/sig.png' },
    ],
    titleName: label,
    shortUrl: '/s/' + label,
  });
  request(f, 'logo', index).resolve({ logo: '/logo.png' });
}
async function asyncTests(): Promise<void> {
  const f = fixture(),
    c = f.create();
  invoke(c, 'componentDidMount');
  assert.equal(f.intervals.size, 1);
  invoke(c, 'componentWillUnmount');
  assert.equal(f.intervals.size, 0);
  invoke(c, 'componentDidMount');
  assert.equal(f.intervals.size, 1, 'StrictMode re-mount creates exactly one cleanup timer');
  successWorksheet(f, 'Remounted', 1);
  await flush();
  assert.equal(state(c)['printTitle'], 'Remounted');
  successWorksheet(f, 'Unmounted', 0);
  await flush();
  assert.equal(state(c)['printTitle'], 'Remounted', 'old mount results never overwrite new mount');
  const retry = invoke(c, 'initWorksheet');
  const latest = invoke(c, 'initWorksheet');
  successWorksheet(f, 'Latest', 3);
  await latest;
  request(f, 'row', 2).reject(new Error('old failed'));
  request(f, 'sheet', 2).resolve({});
  request(f, 'logo', 2).resolve({});
  await retry;
  assert.equal(state(c)['printTitle'], 'Latest');
  assert.equal(state(c)['loadingError'], undefined);
  const invalid = invoke(c, 'initWorksheet');
  request(f, 'sheet', 4).resolve({});
  request(f, 'logo', 4).resolve({});
  request(f, 'row', 4).resolve({ receiveControls: [{ options: {} }] });
  await invalid;
  assert.equal(state(c)['loadingError'], '加载失败', 'malformed claimed option shape reports a failure');
  const recovery = invoke(c, 'initWorksheet');
  successWorksheet(f, 'Recovered', 5);
  await recovery;
  assert.equal(state(c)['loadingError'], undefined);
  const control = { controlId: 'relation', type: 29, enumDefault: 2, showControls: ['name'] };
  const first = invoke(c, 'loadRowRelationRows', [{ rowId: 'record', control }]);
  const second = invoke(c, 'loadRowRelationRows', [{ rowId: 'record', control }]);
  const rows = [{ name: 'latest', rowid: 12, metadata: { nested: true } }];
  const controls = [
    { controlId: 'name', type: 2, advancedSetting: { prefix: '$' }, options: [{ key: 'a', value: 'A' }] },
  ];
  request(f, 'relation', 1).resolve({ template: { controls }, data: rows });
  await second;
  request(f, 'relation', 0).reject(new Error('stale relation'));
  await first;
  const records = state(c)['relateRecords'];
  assert.ok(object(records));
  assert.equal(
    read(records['relation'], 'data'),
    rows,
    'relation arrays retain identity and numeric rowid raw metadata',
  );
  assert.equal(read(read(records['relation'], 'template'), 'controls'), controls);
  assert.equal(read(state(c)['relationErrors'], 'relation'), '');
  assert.deepEqual(
    request(f, 'relation', 1).args,
    {
      appId: undefined,
      worksheetId: undefined,
      rowId: 'record',
      controlId: 'relation',
      pageIndex: 1,
      pageSize: 100000,
      getWorksheet: true,
    },
    'legacy relation request loads every row in one page',
  );
  const fail = invoke(c, 'loadRowRelationRows', [{ rowId: 'record', control: { ...control, controlId: 'bad' } }]);
  request(f, 'relation', 2).resolve({ template: { controls: [{ advancedSetting: { prefix: 7 } }] }, data: [] });
  await fail;
  assert.equal(read(state(c)['relationErrors'], 'bad'), '加载失败');
  assert.ok(html(invoke(c, 'getShowContent', [{ ...control, controlId: 'bad' }])).includes('role="alert"'));
  const shareOld = invoke(c, 'loadWorksheetShortUrl', ['app', 'sheet', 'view', 'record']);
  const shareNew = invoke(c, 'loadWorksheetShortUrl', ['app', 'sheet', 'view', 'record']);
  const shareRequests = f.requests.filter(r => r.name === 'share');
  shareRequests.at(-1)?.resolve('/new');
  await shareNew;
  shareRequests.at(-2)?.resolve('/old');
  await shareOld;
  assert.equal(read(state(c)['rowInfo'], 'shortUrl'), '/new');
  invoke(c, 'componentWillUnmount');
  assert.equal(f.intervals.size, 0);
  const updates = read(c, 'updates');
  request(f, 'share', 0).resolve('/after-unmount');
  await flush();
  assert.equal(read(c, 'updates'), updates);
  const taskFixture = fixture(),
    task = taskFixture.create('task');
  const taskFailure = invoke(task, 'initTask');
  request(taskFixture, 'task').resolve({ data: { controls: {}, member: [], tag: [] } });
  await taskFailure;
  assert.equal(state(task)['loadingError'], '加载失败');
  const taskSuccess = invoke(task, 'initTask');
  const checklistValue = [
    {
      checkListName: 'Checklist',
      checkListData: [
        { name: 'A', status: 'done' },
        { name: 'B', status: 0 },
      ],
    },
  ];
  const subTaskValue = [{ name: 'Child', status: true }];
  request(taskFixture, 'task', 1).resolve({
    data: {
      taskName: 'Task',
      controls: [],
      member: ['Alice', null, 7],
      tag: ['tag'],
      checklist: checklistValue,
      subTask: subTaskValue,
      desc: '<b>description</b>',
      parent: 'Parent',
    },
  });
  await taskSuccess;
  assert.equal(state(task)['loadingError'], undefined);
  assert.ok(html(invoke(task, 'renderTaskInventory')).includes('1/2'));
  assert.ok(html(invoke(task, 'renderTaskSubTask')).includes('1/1'));
  const taskOptions = state(task)['task'];
  assert.ok(Array.isArray(taskOptions));
  const checklistOption = taskOptions.find((v: unknown) => read(v, 'key') === 'checklist');
  assert.equal(read(checklistOption, 'value'), checklistValue);
  const newTask = fixture();
  const newInstance = newTask.create('task');
  const oldLoad = invoke(newInstance, 'initTask'),
    newLoad = invoke(newInstance, 'initTask');
  request(newTask, 'task', 1).resolve({
    data: { taskName: 'new', controls: [], member: [], tag: [], checklist: [], subTask: [] },
  });
  await newLoad;
  request(newTask, 'task', 0).reject(new Error('old task'));
  await oldLoad;
  assert.equal(read(state(newInstance)['reqInfo'], 'title'), 'new');
  const overlap = fixture(),
    target = overlap.create();
  const a = invoke(target, 'initWorksheet'),
    b = invoke(target, 'initWorksheet');
  successWorksheet(overlap, 'B', 1);
  await b;
  successWorksheet(overlap, 'A', 0);
  await a;
  assert.equal(state(target)['printTitle'], 'B', 'stale successful global request is ignored');
  const relationControl = { controlId: 'same', type: 29, enumDefault: 2 };
  const ra = invoke(target, 'loadRowRelationRows', [{ rowId: 'record', control: relationControl }]);
  const rb = invoke(target, 'loadRowRelationRows', [{ rowId: 'record', control: relationControl }]);
  request(overlap, 'relation', 1).resolve({ template: { controls: [] }, data: [{ name: 'B' }] });
  await rb;
  request(overlap, 'relation', 0).resolve({ template: { controls: [] }, data: [{ name: 'A' }] });
  await ra;
  const latestRows = read(read(state(target)['relateRecords'], 'same'), 'data');
  assert.deepEqual(latestRows, [{ name: 'B' }]);
  const failing = invoke(target, 'loadRowRelationRows', [{ rowId: 'record', control: relationControl }]);
  request(overlap, 'relation', 2).reject(new Error('relation failure'));
  await failing;
  assert.equal(read(state(target)['relationErrors'], 'same'), '加载失败');
  const recover = invoke(target, 'loadRowRelationRows', [{ rowId: 'record', control: relationControl }]);
  request(overlap, 'relation', 3).resolve({ template: { controls: [] }, data: [{ name: 'Recovered' }] });
  await recover;
  assert.equal(read(state(target)['relationErrors'], 'same'), '');
  const oldFailure = invoke(target, 'loadRowRelationRows', [{ rowId: 'old', control: relationControl }]);
  request(overlap, 'relation', 4).reject(new Error('old row relation'));
  await oldFailure;
  assert.equal(read(state(target)['relationErrors'], 'same'), '加载失败');
  const changedRow = invoke(target, 'initWorksheet');
  successWorksheet(overlap, 'No relation', 2);
  await changedRow;
  assert.deepEqual(state(target)['relationErrors'], {}, 'new successful snapshot clears removed controls failures');
  const printButton = walk(invoke(target, 'render')).find(
    node => node.props['className'] === 'printButton Right pointer',
  );
  assert.ok(printButton);
  const print = printButton.props['onClick'];
  assert.ok(typeof print === 'function');
  Reflect.apply(print, undefined, []);
  assert.equal(overlap.printCalls, 1, 'removed relation failure does not permanently block printing');
  const loadA = invoke(target, 'loadRowRelationRows', [{ rowId: 'new', control: { controlId: 'a' } }]);
  const loadB = invoke(target, 'loadRowRelationRows', [{ rowId: 'new', control: { controlId: 'b' } }]);
  if (!object(target)) throw new Error('Invalid batch fixture');
  target['batch'] = true;
  request(overlap, 'relation', 5).resolve({ template: { controls: [] }, data: [{ name: 'A' }] });
  request(overlap, 'relation', 6).resolve({ template: { controls: [] }, data: [{ name: 'B' }] });
  await loadA;
  await loadB;
  invoke(target, 'flushUpdates');
  target['batch'] = false;
  assert.ok(read(state(target)['relateRecords'], 'a'));
  assert.ok(read(state(target)['relateRecords'], 'b'));
}
async function relationRefreshRetryTest(): Promise<void> {
  const f = fixture(),
    target = f.create();
  const control = { controlId: 'refresh', type: 29, enumDefault: 2, showControls: ['name'] };
  const controls = [{ controlId: 'name', type: 2, controlName: 'Name' }];
  const first = invoke(target, 'loadRowRelationRows', [{ rowId: 'record', control }]);
  request(f, 'relation').resolve({ template: { controls }, data: [{ name: 'Last successful rows' }] });
  await first;
  const refresh = invoke(target, 'loadRowRelationRows', [{ rowId: 'record', control }]);
  request(f, 'relation', 1).reject(new Error('Refresh rejected'));
  await refresh;
  const failureContent = invoke(target, 'getShowContent', [control]);
  const failureMarkup = html(failureContent);
  assert.ok(failureMarkup.includes('Last successful rows'), 'refresh failure retains last successful table');
  assert.ok(failureMarkup.includes('role="alert"'), 'refresh failure is visible beside old data');
  const retryButton = walk(failureContent).find(node => node.type === 'button' && node.props['children'] === '重试');
  assert.ok(retryButton, 'actual rendered retry button exists after an already successful relation');
  const printButton = walk(invoke(target, 'render')).find(
    node => node.props['className'] === 'printButton Right pointer',
  );
  assert.ok(printButton);
  const printClick = printButton.props['onClick'];
  assert.ok(typeof printClick === 'function');
  Reflect.apply(printClick, undefined, []);
  assert.equal(f.printCalls, 0, 'failed relation blocks printing while showing recoverable old data');
  const retryClick = retryButton.props['onClick'];
  assert.ok(typeof retryClick === 'function');
  const retry: unknown = Reflect.apply(retryClick, undefined, []);
  assert.equal(f.requests.filter(item => item.name === 'relation').length, 3, 'click issues the real retry request');
  assert.deepEqual(request(f, 'relation', 2).args, {
    appId: 'app',
    worksheetId: 'sheet',
    rowId: 'record',
    controlId: 'refresh',
    pageIndex: 1,
    pageSize: 100000,
    getWorksheet: true,
  });
  request(f, 'relation', 2).resolve({ template: { controls }, data: [{ name: 'Recovered current rows' }] });
  await retry;
  const recovered = html(invoke(target, 'getShowContent', [control]));
  assert.ok(recovered.includes('Recovered current rows'));
  assert.ok(!recovered.includes('role="alert"'), 'success clears visible refresh error');
  assert.ok(!recovered.includes('重试'), 'successful table no longer needs retry UI');
  Reflect.apply(printClick, undefined, []);
  assert.equal(f.printCalls, 1, 'successful retry restores real printing');
}
async function asyncParity(currentFixture: Fixture, beforeFixture: Fixture): Promise<void> {
  if (!originalSource) return;
  const c = currentFixture.create(),
    b = beforeFixture.create();
  invoke(c, 'initWorksheet');
  invoke(b, 'initWorksheet');
  successWorksheet(currentFixture, 'API Worksheet');
  successWorksheet(beforeFixture, 'API Worksheet');
  await flush();
  parity('worksheet-api-complete-dom', invoke(c, 'render'), invoke(b, 'render'));
  assert.deepEqual(request(currentFixture, 'row').args, request(beforeFixture, 'row').args);
  assert.deepEqual(request(currentFixture, 'sheet').args, request(beforeFixture, 'sheet').args);
  const currentTask = currentFixture.create('task'),
    oldTask = beforeFixture.create('task');
  invoke(currentTask, 'initTask');
  invoke(oldTask, 'initTask');
  const response = {
    data: {
      taskName: 'Task API',
      folder: undefined,
      controls: [{ type: 2, controlId: 'text', row: 0, value: 'Text' }],
      member: ['Alice', null, 5],
      tag: ['tag', 7],
      desc: undefined,
      parent: 'Parent',
      checklist: [{ checkListData: [{ name: 'Done', status: 'truthy' }, { status: null }] }],
      subTask: [{ name: 'Child' }],
    },
  };
  request(currentFixture, 'task').resolve(lodash.cloneDeep(response));
  request(beforeFixture, 'task').resolve(lodash.cloneDeep(response));
  await flush();
  parity('task-api-complete-dom', invoke(currentTask, 'render'), invoke(oldTask, 'render'));
  assert.deepEqual(request(currentFixture, 'task').args, request(beforeFixture, 'task').args);
}
function boundaryTests(f: Fixture): void {
  const control = {
    type: 9,
    options: [{ key: 'one', value: 'One', meta: { raw: true } }],
    advancedSetting: { prefix: '$' },
    value: react.createElement('b', null, 'node'),
  };
  const controls = [control];
  assert.equal(invoke(f.boundary, 'printControls', [controls]), controls);
  for (const bad of [
    { options: {} },
    { options: [{ key: 1 }] },
    { options: new Array(1) },
    { advancedSetting: { prefix: 1 } },
    { showControls: [1] },
    { relationControls: [{ options: {} }] },
    { sourceControl: { unit: 1 } },
  ])
    assert.throws(() => invoke(f.boundary, 'printControls', [[bad]]));
  assert.throws(() => invoke(f.boundary, 'printControls', [new Array(1)]));
  assert.throws(() => invoke(f.boundary, 'printControls', [[{ showMaskValue: 'false' }]]));
  const unmasked = { type: 3, value: '123', advancedSetting: { datamask: '1' }, showMaskValue: false };
  assert.equal(
    read(invoke(f.boundary, 'cellTitleControl', [unmasked]), 'showMaskValue'),
    false,
    'actual masking helper consumed flag survives adapter',
  );
  assert.throws(() => invoke(f.boundary, 'decodeRelateRecord', [{ template: { controls: [] }, data: [null] }]));
  assert.throws(() => invoke(f.boundary, 'decodePrintRow', [{ receiveControls: [], shortUrl: {} }]));
  assert.throws(() => invoke(f.boundary, 'decodePrintLogo', [{ logo: 1 }]));
  assert.throws(() => invoke(f.boundary, 'decodePrintSheet', [{ name: [] }]));
  assert.throws(() =>
    invoke(f.boundary, 'decodePrintTask', [{ status: false, data: { controls: [], member: [], tag: [] } }]),
  );
  const raw = { extras: { object: true }, value: [react.createElement('b', { key: 'b' }, 'B'), 'text'] };
  assert.equal(invoke(f.boundary, 'printNode', [raw.value]), raw.value);
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  assert.throws(() => invoke(f.boundary, 'printNode', [cyclic]));
  const date = new Date('2026-01-01');
  assert.equal(invoke(f.boundary, 'printDate', [date]), date);
  assert.equal(invoke(f.boundary, 'parsePrintJson', ['{"rowid":12}']) && true, true);
  for (const value of [{ flowNode: {} }, { flowNode: { id: 1 }, show: true }, { flowNode: { id: 'id' }, show: 'yes' }])
    assert.throws(() => invoke(f.boundary, 'workflowItems', [[value]]));
  const options = { opaque: { data: true } };
  assert.equal(
    invoke(f.boundary, 'printOptions', [options]),
    options,
    'missing known option preserves original keys/reference',
  );
  const instance = f.create();
  state(instance)['reqInfo'] = { controls: [] };
  invoke(instance, 'changePrintVisible', ['all', true, [], {}]);
  assert.equal(
    read(state(instance)['configOptions'], 'showWorkflowQrCode'),
    true,
    'empty options preserve prior QR flag',
  );
  assert.throws(() => invoke(instance, 'changePrintVisible', ['all', true, [], { showWorkflowQrCode: 'yes' }]));
  assert.throws(() => invoke(instance, 'changePrintVisible', ['all', true, [1]]));
  assert.throws(() =>
    invoke(f.boundary, 'decodePrintTask', [
      { data: { controls: [], member: [], tag: [], checklist: [{ checkListData: null }] } },
    ]),
  );
}
async function main(): Promise<void> {
  const current = fixture(),
    before = fixture(true);
  compareControls(current, before);
  compareLayouts(current, before);
  boundaryTests(current);
  await asyncParity(current, before);
  // Full class render uses the real ReactDOM server, not a replacement JSX serializer.
  for (const type of ['worksheet', 'task', 'workflow', 'hr']) {
    const c = current.create(type),
      b = before.create(type);
    const task = [
      { key: 'parent', name: 'Parent', value: 'Parent', independent: false, show: true },
      {
        key: 'checklist',
        name: 'Checklist',
        value: [{ checkListName: 'List', checkListData: [{ name: 'done', status: 1 }] }],
        independent: true,
        show: true,
      },
      { key: 'subTask', name: 'Subtask', value: [{ name: 'Child' }], independent: true, show: false },
      { key: 'code', name: 'Code', value: undefined, independent: true, show: true },
    ];
    for (const target of [c, b])
      Object.assign(state(target), {
        controls: { 0: [{ type: 2, col: 0, controlName: 'Text', value: 'Value' }] },
        reqInfo: { title: 'Title', reqNo: 'No', controls: [], formControls: [] },
        sheetInfo: { name: 'Sheet' },
        signatureControls: [{ controlId: 'sig', value: '/sig.png' }],
        task,
        workList: [{}],
      });
    const cHtml = html(invoke(c, 'render')),
      bHtml = originalSource ? html(invoke(b, 'render')) : undefined;
    const normalize = (value: string) => value.replace(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/g, '<time>');
    if (bHtml !== undefined) assert.equal(normalize(cHtml), normalize(bHtml), type + ' whole class DOM');
    observations.push({ label: type + '-full-dom', current: normalize(cHtml), before: bHtml && normalize(bHtml) });
    const printButton = walk(invoke(c, 'render')).find(item => item.props['className'] === 'printButton Right pointer');
    assert.ok(printButton);
    const click = printButton.props['onClick'];
    assert.ok(typeof click === 'function');
    Reflect.apply(click, undefined, []);
  }
  assert.equal(current.printCalls, 4);
  await asyncTests();
  await relationRefreshRetryTest();
  const output = process.env['PRINT_OBSERVATIONS'];
  if (output) fs.writeFileSync(output, JSON.stringify(observations, null, 2));
  console.log(
    `Print actual ReactDOM/Babel/control/layout/JSON/API/lifecycle checks passed (${observations.length} normal observations)`,
  );
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
