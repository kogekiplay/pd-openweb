import type { ReactNode } from 'react';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const harness: import('../../../scripts/spec-harness').SpecHarness = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
const beforeRevision = process.env['PRINT_OPTIONS_BEFORE_REV'];
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new TypeError('Expected actual object');
  return value;
}
function invoke(target: unknown, name: string, args: unknown[] = []): unknown {
  const receiver = object(target),
    method = receiver[name];
  if (typeof method !== 'function') throw new TypeError('Missing actual method ' + name);
  const result: unknown = Reflect.apply(method, receiver, args);
  return result;
}
function props(value: unknown): Record<string, unknown> {
  if (!React.isValidElement<Record<string, unknown>>(value)) throw new TypeError('Expected actual React element');
  return value.props;
}
function state(value: unknown): Record<string, unknown> {
  return object(object(value)['state']);
}
function node(value: unknown): ReactNode {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value;
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.map(node);
  throw new TypeError('Invalid actual render node');
}
function walk(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value.props, ...walk(value.props['children'])];
}
interface Fixture {
  events: unknown[][];
  constructor: unknown;
  create(options: Record<string, unknown>): unknown;
}
function fixture(before = false, stored: string | null = null): Fixture {
  const events: unknown[][] = [];
  const filename = path.join(__dirname, 'PrintOptDialog.tsx');
  const source = before
    ? execFileSync('git', ['show', beforeRevision + ':src/components/print/PrintOptDialog.tsx'], {
        cwd: root,
        encoding: 'utf8',
      })
    : fs.readFileSync(filename, 'utf8');
  const compiled = harness.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
    comments: false,
  });
  assert.ok(compiled?.code);
  function Dialog(value: { children?: ReactNode }): ReactNode {
    return React.createElement('section', {}, value.children);
  }
  function Checkbox(value: { text?: ReactNode; checked?: boolean }): ReactNode {
    return React.createElement(
      'label',
      {},
      React.createElement('input', { type: 'checkbox', checked: value.checked, readOnly: true }),
      value.text,
    );
  }
  const loaded: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', '_l', 'window', 'alert', 'safeLocalStorageSetItem', compiled.code)(
    loaded,
    loaded.exports,
    (name: string): unknown => (name === 'ming-ui' ? { Checkbox, Dialog } : require(name)),
    (text: string) => text,
    {
      localStorage: {
        getItem: (key: string) => {
          assert.equal(key, 'hrPrintProcessOption');
          return stored;
        },
      },
    },
    (text: string, severity?: number) => events.push(['alert', text, severity]),
    (key: string, value: string) => events.push(['storage', key, value]),
  );
  const constructor: unknown = object(loaded.exports)['default'];
  if (typeof constructor !== 'function') throw new TypeError('Missing actual dialog constructor');
  return {
    events,
    constructor,
    create(options) {
      const result: unknown = Reflect.construct(constructor, [
        {
          changePrintVisible: (...args: unknown[]) => events.push(['change', ...args]),
          hidePrintOptDialog: () => events.push(['cancel']),
          onUpdateTask: (value: unknown) => events.push(['task', value]),
          onUpdateWorkflow: (value: unknown) => events.push(['workflow', value]),
          ...options,
        },
      ]);
      const target = object(result);
      target['setState'] = (patch: object) => Object.assign(state(target), patch);
      return result;
    },
  };
}
function info() {
  return {
    controls: [
      { controlId: 'a', controlName: 'A', type: 2, row: 1, col: 1 },
      { controlId: 'hidden', controlName: 'Hidden', type: 2, printHide: true, row: 2 },
      { controlId: 'detail', controlName: 'Detail', type: 0, row: 0, col: 0 },
    ],
    formControls: [
      {
        formId: 'detail',
        controls: [],
        tempControls: [{ controlId: 'inside', needEvaluate: true, controlName: 'Inside' }],
      },
    ],
  };
}
const current = fixture();
const reqInfo = info(),
  selection = ['a'],
  options = { showWorkflowQrCode: true, metadata: { retained: true } };
const selected = current.create({ controlOption: selection, reqInfo, options });
assert.equal(state(selected)['controlOption'], selection);
assert.equal(state(selected)['reqInfo'], reqInfo);
assert.equal(state(selected)['options'], options);
assert.equal(state(selected)['processOption'], 'all');
assert.equal(state(selected)['printCheckAll'], true);
invoke(selected, 'toggleCheckItem', ['detail']);
assert.deepEqual(selection, ['a', 'detail']);
assert.equal(state(selected)['printCheckAll'], false);
invoke(selected, 'toggleCheckItem', ['formDetailEvaluate-detail']);
assert.equal(state(selected)['printCheckAll'], true);
invoke(selected, 'toggleCheckItem', ['a']);
assert.deepEqual(selection, ['detail', 'formDetailEvaluate-detail']);
assert.equal(state(selected)['printCheckAll'], false);
invoke(selected, 'toggleCheckAll');
assert.equal(state(selected)['controlOption'], selection, 'select all mutates existing selection array');
assert.deepEqual(selection, ['a', 'detail', 'formDetailEvaluate-detail']);
invoke(selected, 'toggleCheckAll');
assert.notEqual(
  state(selected)['controlOption'],
  selection,
  'clear all replaces state array without mutating the caller array',
);
assert.deepEqual(state(selected)['controlOption'], []);
const controlCheckbox = walk(invoke(selected, 'render')).find(value => value['text'] === 'A');
assert.ok(controlCheckbox);
invoke(controlCheckbox, 'onClick');
assert.deepEqual(state(selected)['controlOption'], ['a']);
const detailCheckbox = walk(invoke(selected, 'render')).find(value => value['text'] === 'Detail统计');
assert.ok(detailCheckbox);
invoke(detailCheckbox, 'onClick');
assert.deepEqual(state(selected)['controlOption'], ['a', 'formDetailEvaluate-detail']);
const malformedId = current.create({ controlOption: [], reqInfo: { controls: [{ type: 22 }] } });
const malformedCheckbox = walk(invoke(malformedId, 'render')).find(value => value['text'] === '分段');
assert.ok(malformedCheckbox);
assert.equal(malformedCheckbox['disabled'], true, 'checkbox without an id is explicitly disabled');
assert.doesNotThrow(() => invoke(malformedCheckbox, 'onClick'), 'missing-id callback safely ignores the item');
assert.deepEqual(state(malformedId)['controlOption'], []);
const all = current.create({ controlOption: 'all', reqInfo });
assert.deepEqual(state(all)['controlOption'], ['detail', 'a', 'formDetailEvaluate-detail']);
const worksheet = current.create({ worksheetId: 'sheet', controlOption: 'all', reqInfo: info(), options });
assert.deepEqual(
  state(worksheet)['controlOption'],
  ['a', 'detail'],
  'worksheet constructor omits detail aggregate selections',
);
const markup = renderToStaticMarkup(node(invoke(worksheet, 'render')));
assert.ok(markup.includes('二维码') && markup.includes('A') && !markup.includes('Hidden'));
invoke(selected, 'render');
assert.equal(reqInfo.controls[0]?.controlId, 'detail', 'render keeps the original in-place control sorting');
const qr = walk(invoke(worksheet, 'render')).find(value => value['text'] === '二维码');
assert.ok(qr);
invoke(qr, 'onClick');
assert.notEqual(state(worksheet)['options'], options);
assert.equal(object(state(worksheet)['options'])['metadata'], options.metadata);
assert.equal(object(state(worksheet)['options'])['showWorkflowQrCode'], false);
const stored = fixture(false, 'some');
const processDialog = stored.create({ controlOption: [], processOption: 'ignored', reqInfo: { controls: [] } });
assert.equal(
  state(processDialog)['processOption'],
  'some',
  'stored process setting takes precedence over unused process prop',
);
const flowChoices = walk(invoke(processDialog, 'renderApprovalFlow')).filter(
  value => typeof value['onClick'] === 'function',
);
assert.equal(flowChoices.length, 3);
flowChoices.forEach((value, index) => {
  invoke(value, 'onClick');
  assert.equal(state(processDialog)['processOption'], ['all', 'some', 'no'][index]);
});
const task = [{ key: 'one', name: 'One', show: true, independent: false, value: { opaque: true } }];
const workflow = [{ show: true, flowNode: { id: 'node', name: 'Node' }, metadata: { opaque: true } }];
const taskDialog = current.create({ type: 'task', controlOption: 'all', reqInfo: info(), task });
const workflowDialog = current.create({ type: 'workflow', controlOption: 'all', reqInfo: info(), workflow });
invoke(taskDialog, 'toggleTaskCheckItem', ['one']);
assert.notEqual(state(taskDialog)['task'], task);
const newTask: unknown = state(taskDialog)['task'];
assert.ok(Array.isArray(newTask));
assert.equal(newTask[0], task[0]);
assert.equal(task[0]?.show, false, 'task item mutation is preserved');
invoke(workflowDialog, 'toggleWorkflowCheckItem', ['node']);
assert.notEqual(state(workflowDialog)['workflow'], workflow);
const newWorkflow: unknown = state(workflowDialog)['workflow'];
assert.ok(Array.isArray(newWorkflow));
assert.equal(newWorkflow[0], workflow[0]);
assert.equal(workflow[0]?.show, false);
const taskCheck = walk(invoke(taskDialog, 'render')).find(value => value['text'] === 'One');
assert.ok(taskCheck);
invoke(taskCheck, 'onClick');
assert.equal(task[0]?.show, true);
const workflowCheck = walk(invoke(workflowDialog, 'render')).find(value => value['text'] === 'Node');
assert.ok(workflowCheck);
invoke(workflowCheck, 'onClick');
assert.equal(workflow[0]?.show, true);
current.events.length = 0;
assert.equal(invoke(props(invoke(taskDialog, 'render')), 'onOk'), undefined);
assert.deepEqual(
  current.events.map(value => value[0]),
  ['storage', 'change', 'task', 'alert'],
);
assert.equal(
  current.events[1]?.[3],
  state(taskDialog)['controlOption'],
  'onOk forwards the real array, never the validation sentinel all',
);
current.events.length = 0;
invoke(props(invoke(workflowDialog, 'render')), 'onOk');
assert.deepEqual(
  current.events.map(value => value[0]),
  ['storage', 'change', 'workflow', 'alert'],
);
current.events.length = 0;
invoke(props(invoke(taskDialog, 'render')), 'onCancel');
assert.deepEqual(current.events, [['cancel']]);
const empty = current.create({ controlOption: [], reqInfo: { controls: [{ controlId: 'a' }] } });
current.events.length = 0;
assert.equal(invoke(props(invoke(empty, 'render')), 'onOk'), false);
assert.deepEqual(current.events, [['alert', '打印字段不可为空', 3]]);
const noControls = current.create({ controlOption: 'all' });
assert.doesNotThrow(
  () => renderToStaticMarkup(node(invoke(noControls, 'render'))),
  'missing optional controls have a finite empty default',
);
console.log(
  'PrintOptDialog independent complete class/defaults/identity/mutation/checkbox/detail/task/workflow/QR/storage/callback order checks passed',
);
if (beforeRevision) {
  let count = 0;
  for (const type of ['worksheet', 'hr', 'task', 'workflow'])
    for (const sheet of [undefined, 'sheet'])
      for (const checked of [undefined, false, true])
        for (const selection of ['all', [], ['a']]) {
          const a = fixture(true, 'some'),
            b = fixture(false, 'some');
          const opts = () => ({
            type,
            worksheetId: sheet,
            printCheckAll: checked,
            controlOption: Array.isArray(selection) ? [...selection] : selection,
            reqInfo: info(),
            options: { showWorkflowQrCode: true, metadata: { untouched: true } },
            task: [{ key: 'x', name: 'X', show: true, independent: false, value: 'Raw' }],
            workflow: [{ show: true, flowNode: { id: 'n', name: 'Node' } }],
          });
          const old = a.create(opts()),
            now = b.create(opts());
          assert.deepEqual(state(now), state(old), 'constructor defaults exact baseline');
          const render = (instance: unknown) => renderToStaticMarkup(node(invoke(instance, 'render')));
          assert.equal(render(now), render(old), 'actual production Babel + ReactDOM complete dialog render');
          invoke(old, 'toggleCheckItem', ['a']);
          invoke(now, 'toggleCheckItem', ['a']);
          assert.deepEqual(state(now), state(old));
          invoke(old, 'toggleCheckAll');
          invoke(now, 'toggleCheckAll');
          assert.deepEqual(state(now), state(old));
          if (type === 'task') {
            invoke(old, 'toggleTaskCheckItem', ['x']);
            invoke(now, 'toggleTaskCheckItem', ['x']);
          }
          if (type === 'workflow') {
            invoke(old, 'toggleWorkflowCheckItem', ['n']);
            invoke(now, 'toggleWorkflowCheckItem', ['n']);
          }
          const oldTree = invoke(old, 'render'),
            newTree = invoke(now, 'render');
          const oldQr = walk(oldTree).find(value => value['text'] === '二维码'),
            newQr = walk(newTree).find(value => value['text'] === '二维码');
          if (oldQr && newQr) {
            invoke(oldQr, 'onClick');
            invoke(newQr, 'onClick');
          }
          assert.deepEqual(state(now), state(old));
          const resultA = invoke(props(oldTree), 'onOk'),
            resultB = invoke(props(newTree), 'onOk');
          assert.equal(resultB, resultA);
          assert.deepEqual(b.events, a.events, 'storage/update/task/workflow/alert ordering');
          invoke(props(oldTree), 'onCancel');
          invoke(props(newTree), 'onCancel');
          assert.deepEqual(b.events, a.events);
          count++;
        }
  console.log('PrintOptDialog historical production Babel/ReactDOM full lifecycle matrix passed: ' + count + ' cases');
}
