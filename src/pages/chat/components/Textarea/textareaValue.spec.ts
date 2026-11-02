/** Execute the actual class with controlled jQuery leaves; no DOM or React mount. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const React: typeof import('react') = require('react');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const source = fs.readFileSync(path.join(__dirname, 'index.tsx'), 'utf8');
const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const declarations = ast.program.body.flatMap(node => node.type === 'ExportDefaultDeclaration' ? [node.declaration] : []);
const node = declarations.find(node => node.type === 'ClassDeclaration' && node.id?.name === 'TextareaBox');
assert.ok(node && typeof node.start === 'number' && typeof node.end === 'number');
const classSource = source.slice(node.start, node.end);
const code = harness.transformSync(classSource, { filename: 'actual-textarea-class.tsx', sourceType: 'script' }).code;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function state(subject: object): Record<string, unknown> {
  const value: unknown = Reflect.get(subject, 'state'); assert.ok(record(value)); return value;
}
function invoke(subject: object, method: string, ...args: unknown[]): unknown {
  const fn: unknown = Reflect.get(subject, method); if (typeof fn !== 'function') throw new TypeError('missing actual method: ' + method);
  return Reflect.apply(fn, subject, args);
}
interface Scenario { value?: string; raw?: unknown; height?: number; wrapper?: boolean; composing?: boolean; }
function create(scenario: Scenario = {}) {
  const order: string[] = [], changes: unknown[] = [], blurs: unknown[] = [], sends: unknown[] = [], alerts: unknown[] = [];
  let reads = 0;
  const collection = { height: () => scenario.height, find: () => collection, val: () => { reads++; return scenario.raw; } };
  const sdk = () => collection;
  const config = { inputMode: 1, msgMaxSize: 20480 };
  const constants = { INPUT_MODE_ENTER: 1, INPUT_MODE_CTRLENTER: 2 };
  const factory = new Function('require', 'Component', '$', 'utils', 'config', 'Constant', 'getCaretPosition', 'setCaretPosition', 'alert', '_l', code + '\nreturn TextareaBox;');
  const constructor: unknown = Reflect.apply(factory, undefined, [require, React.Component, sdk, { scrollEnd: () => order.push('scroll'), recordCursortPosition: () => order.push('cursor') }, config, constants,
    () => 1, () => order.push('caret'), (message: unknown) => alerts.push(message), (message: string) => message]);
  if (typeof constructor !== 'function') throw new TypeError('missing actual class');
  const subject: object = Reflect.construct(constructor, [{ value: scenario.value === undefined ? 'draft' : scenario.value,
    session: { id: 'session-1' }, onChange: (value: unknown) => { order.push('change'); changes.push(value); },
    onBlur: (value: unknown) => { order.push('blur'); blurs.push(value); }, onSendMsg: (value: unknown) => { order.push('send'); sends.push(value); } }]);
  Reflect.set(subject, 'setState', (patch: unknown, callback?: unknown) => { assert.ok(record(patch)); order.push('state'); Reflect.set(subject, 'state', { ...state(subject), ...patch }); if (typeof callback === 'function') Reflect.apply(callback, subject, []); });
  Reflect.set(subject, 'textareaWrapper', scenario.wrapper ? {} : undefined);
  if (scenario.composing) Reflect.set(subject, 'isComposing', true);
  return { subject, constructor, order, changes, blurs, sends, alerts, config, reads: () => reads };
}
const passed: string[] = [];
for (const [name, scenario] of [
  ['missing-wrapper-keeps-draft', { raw: undefined }],
  ['missing-empty-draft-stays-empty', { value: '', raw: undefined }],
  ['unexpected-number-keeps-draft', { wrapper: true, raw: 42 }],
  ['unexpected-array-keeps-draft', { wrapper: true, raw: ['a', 'b'] }],
  ['unexpected-null-keeps-draft', { wrapper: true, raw: null }],
] satisfies Array<[string, Scenario]>) {
  const c = create(scenario); invoke(c.subject, 'handleChange');
  const expected = scenario.value === undefined ? 'draft' : scenario.value;
  assert.equal(state(c.subject)['value'], expected, 'absent/nontext getter must not replace the string draft');
  assert.deepEqual(c.changes, [expected]); assert.equal(typeof state(c.subject)['value'], 'string'); passed.push(name);
}
const dom = create({ wrapper: true, raw: 'from DOM', height: 70 }); invoke(dom.subject, 'handleChange');
assert.equal(state(dom.subject)['value'], 'from DOM'); assert.deepEqual(dom.changes, ['from DOM']); assert.deepEqual(dom.order, ['scroll', 'state', 'change']); passed.push('normal-dom-read');
const direct = create({ raw: 42, height: 50 }); invoke(direct.subject, 'handleChange', 'typed'); assert.equal(state(direct.subject)['value'], 'typed'); assert.equal(direct.reads(), 0); assert.deepEqual(direct.order, ['state', 'change']); passed.push('direct-string-skips-getter');
const empty = create({ wrapper: true, raw: 'unread', height: 50 }); invoke(empty.subject, 'handleChange', ''); assert.equal(state(empty.subject)['value'], ''); assert.equal(empty.reads(), 0); passed.push('direct-empty-is-text');
const blurDraft = create({ raw: undefined }); invoke(blurDraft.subject, 'handleBlur'); assert.deepEqual(blurDraft.blurs, ['draft']); assert.equal(blurDraft.reads(), 0); passed.push('blur-keeps-existing-draft');
const blurEmpty = create({ value: '', raw: undefined }); invoke(blurEmpty.subject, 'handleBlur'); assert.deepEqual(blurEmpty.blurs, ['']); passed.push('blur-empty-missing-wrapper');
const blurDom = create({ value: '', wrapper: true, raw: 'live' }); invoke(blurDom.subject, 'handleBlur'); assert.deepEqual(blurDom.blurs, ['live']); passed.push('blur-reads-dom-text');
const send = create({ raw: undefined }); invoke(send.subject, 'handleChange'); invoke(send.subject, 'handleKeyDown', { which: 13, ctrlKey: false, preventDefault: () => send.order.push('prevent') }); assert.deepEqual(send.sends, ['draft']); assert.deepEqual(send.order.slice(-2), ['send', 'prevent']); passed.push('read-then-enter-sends-string');
const composing = create({ composing: true }); const result = invoke(composing.subject, 'handleKeyDown', { which: 13, preventDefault: () => composing.order.push('prevent') }); assert.equal(result, undefined); assert.deepEqual(composing.sends, []); passed.push('composition-blocks-enter');
const props = { value: 'replacement' }, previous = { value: 'draft', propValue: 'draft' };
assert.deepEqual(invoke(dom.constructor, 'getDerivedStateFromProps', props, previous), { value: 'replacement', propValue: 'replacement' }); assert.equal(invoke(dom.constructor, 'getDerivedStateFromProps', { value: 'draft' }, previous), null); passed.push('props-update-two-slots');
const repeated = create({ raw: 'r', height: 55 }); invoke(repeated.subject, 'handleChange'); invoke(repeated.subject, 'handleChange'); assert.equal(repeated.order.filter(x => x === 'scroll').length, 1); assert.equal(Reflect.get(repeated.subject, 'compositionEndTime'), 0); passed.push('same-height-no-extra-scroll');
assert.equal(passed.length, 15);
console.log(JSON.stringify({ textareaValueCases: passed.length, cases: passed }));
console.log('Textarea value regression passed: 15 actual-class paths; missing/nontext getter retains draft, normal text and effects preserved');
