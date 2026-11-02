/** Actual class and actual caret helpers; target identity and clock use controlled leaves. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const React: typeof import('react') = require('react');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const boundary: Record<string, unknown> = require('../../../../../src/utils/caretBoundary.ts');
function slice(source: string, node: { start?: number | null; end?: number | null }): string {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') throw new TypeError('missing source bounds');
  return source.slice(node.start, node.end);
}
const source = fs.readFileSync(path.join(__dirname, 'index.tsx'), 'utf8');
const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const classNode = ast.program.body.flatMap(n => n.type === 'ExportDefaultDeclaration' ? [n.declaration] : []).find(n => n.type === 'ClassDeclaration' && n.id?.name === 'TextareaBox'); assert.ok(classNode);
const classCode = harness.transformSync(slice(source, classNode), { filename: 'actual-keyboard-class.tsx', sourceType: 'script' }).code;
const common = fs.readFileSync(path.join(harness.ROOT, 'src/utils/common.ts'), 'utf8');
const commonAst = harness.parser.parse(common, { sourceType: 'module', plugins: ['typescript'] });
const functions = commonAst.program.body.flatMap(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration' ? n.declaration.declarations : []).filter(n => n.id.type === 'Identifier' && ['getCaretPosition', 'setCaretPosition'].includes(n.id.name)); assert.equal(functions.length, 2);
const helperCode = harness.transformSync(functions.map(n => 'const ' + slice(common, n) + ';').join('\n'), { filename: 'actual-caret-helpers.ts', sourceType: 'script' }).code;
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function invoke(subject: object, name: string, ...args: unknown[]): unknown {
  const fn: unknown = Reflect.get(subject, name); if (typeof fn !== 'function') throw new TypeError('missing actual method'); return Reflect.apply(fn, subject, args);
}
function state(subject: object): Record<string, unknown> { const s: unknown = Reflect.get(subject, 'state'); assert.ok(record(s)); return s; }
interface Options { mode?: number; value?: string; invalid?: 'no-focus' | 'bad-range' | 'bad-selection' | 'bad-legacy' | 'no-range'; ctrl?: boolean; which?: number; keyCode?: number; composing?: boolean; nativeComposing?: boolean; endTime?: number; position?: number | null; limit?: number; }
function create(options: Options = {}) {
  const order: string[] = [], sends: unknown[] = [], changes: unknown[] = [], alerts: unknown[][] = [], focused: unknown[] = [], ranges: unknown[][] = [];
  const target: Record<string, unknown> = { selectionStart: options.position === undefined ? 1 : options.position,
    focus() { focused.push(this); order.push('focus'); }, setSelectionRange(start: unknown, end: unknown) { ranges.push([this, start, end]); order.push('range'); } };
  const currentTarget = { focus() { throw new Error('currentTarget must never replace target'); } };
  if (options.invalid === 'no-focus') Reflect.deleteProperty(target, 'focus');
  if (options.invalid === 'bad-range') target['setSelectionRange'] = 3;
  if (options.invalid === 'bad-selection') target['selectionStart'] = 'bad';
  if (options.invalid === 'bad-legacy') target['createTextRange'] = 3;
  if (options.invalid === 'no-range') Reflect.deleteProperty(target, 'setSelectionRange');
  const factory = new Function('require', 'Component', 'isCaretControl', 'document', 'invokeLegacyCaretMethod', 'config', 'Constant', 'alert', '_l', 'Date', helperCode + '\n' + classCode + '\nreturn TextareaBox;');
  const constructor: unknown = Reflect.apply(factory, undefined, [require, React.Component, boundary['isCaretControl'], {}, boundary['invokeLegacyCaretMethod'],
    { inputMode: options.mode === undefined ? 1 : options.mode, msgMaxSize: options.limit === undefined ? 20480 : options.limit }, { INPUT_MODE_ENTER: 1, INPUT_MODE_CTRLENTER: 2 },
    (...args: unknown[]) => { alerts.push(args); order.push('alert'); }, (value: string) => value, { now: () => 1000 }]);
  if (typeof constructor !== 'function') throw new TypeError('actual class missing');
  const subject: object = Reflect.construct(constructor, [{ value: options.value === undefined ? 'ab' : options.value, onSendMsg: (value: unknown) => { sends.push(value); order.push('send'); }, onChange: (value: unknown) => { changes.push(value); order.push('change'); } }]);
  Reflect.set(subject, 'setState', (patch: unknown, callback?: unknown) => { assert.ok(record(patch)); Reflect.set(subject, 'state', { ...state(subject), ...patch }); order.push('state'); if (typeof callback === 'function') Reflect.apply(callback, subject, []); });
  Reflect.set(subject, 'compositionEndTime', options.endTime === undefined ? 0 : options.endTime); Reflect.set(subject, 'isComposing', !!options.composing);
  const event = { which: options.which === undefined ? 13 : options.which, ctrlKey: !!options.ctrl, keyCode: options.keyCode, nativeEvent: { isComposing: !!options.nativeComposing }, target, currentTarget,
    preventDefault: () => order.push('prevent') };
  return { subject, event, target, currentTarget, order, sends, changes, alerts, focused, ranges, run: () => invoke(subject, 'handleKeyDown', event) };
}
const passed: string[] = [];
for (const invalid of ['no-focus','bad-range','bad-selection','bad-legacy','no-range'] as const) {
  const c = create({ ctrl: true, invalid }); assert.equal(c.run(), undefined); assert.equal(state(c.subject)['value'], 'ab'); assert.deepEqual(c.order, []); passed.push('reject-' + invalid);
}
for (const [name, opts] of [['enter-send',{}],['ctrl-enter-send',{mode:2,ctrl:true}],['send-does-not-need-caret',{invalid:'no-focus'}]] satisfies Array<[string,Options]>) {
  const c=create(opts); assert.equal(c.run(),false); assert.deepEqual(c.sends,['ab']); assert.deepEqual(c.order,['send','prevent']); passed.push(name);
}
const newline=create({ctrl:true}); assert.equal(newline.run(),false); assert.equal(state(newline.subject)['value'],'a\r\nb'); assert.deepEqual(newline.changes,['a\r\nb']); assert.deepEqual(newline.order,['focus','state','focus','range','change','prevent']); assert.deepEqual(newline.focused,[newline.target,newline.target]); assert.equal(newline.ranges[0]?.[0],newline.target); assert.deepEqual(newline.ranges[0]?.slice(1),[2,2]); passed.push('newline-uses-original-target');
const native=create({mode:2}); assert.equal(native.run(),false); assert.equal(state(native.subject)['value'],'ab'); assert.deepEqual(native.order,['focus','state']); passed.push('ctrl-mode-native-enter');
const blank=create({value:'  '}); assert.equal(blank.run(),false); assert.deepEqual(blank.sends,[]); assert.deepEqual(blank.order,['prevent']); passed.push('blank-not-sent');
const long=create({value:'abcd',limit:3}); assert.equal(long.run(),false); assert.equal(long.alerts.length,1); assert.equal(long.alerts[0]?.[1],3); assert.deepEqual(long.order,['alert','prevent']); passed.push('over-limit-alert');
for (const [name,opts] of [['composing-flag',{composing:true}],['native-composing',{nativeComposing:true}],['ime-code229',{keyCode:229}],['recent-composition',{endTime:975}]] satisfies Array<[string,Options]>) {
  const c=create(opts); assert.equal(c.run(),undefined); assert.deepEqual(c.order,[]); passed.push(name);
}
const boundary50=create({endTime:950}); assert.equal(boundary50.run(),false); assert.deepEqual(boundary50.sends,['ab']); passed.push('composition-boundary50');
const other=create({which:65}); assert.equal(other.run(),undefined); assert.deepEqual(other.order,[]); passed.push('non-enter-ignored');
const zero=create({ctrl:true,position:0}); assert.equal(zero.run(),false); assert.equal(state(zero.subject)['value'],'\r\nab'); assert.deepEqual(zero.ranges[0]?.slice(1),[1,1]); passed.push('caret-zero');
const nullable=create({ctrl:true,position:null}); assert.equal(nullable.run(),false); assert.equal(state(nullable.subject)['value'],'\r\nab'); passed.push('nullable-caret-position');
const ended=create(); invoke(ended.subject,'handleCompositionEnd'); assert.equal(ended.run(),undefined); assert.deepEqual(ended.order,[]); passed.push('composition-end-cooldown');
assert.equal(passed.length,21);
console.log(JSON.stringify({ textareaKeyboardCases:passed.length,cases:passed }));
console.log('Textarea keyboard regression passed: 21 actual class and canonical caret helper cases; original target, input modes and composition preserved');
