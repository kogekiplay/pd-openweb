const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformFileSync, transformSync, parser } = require('../../../scripts/spec-harness.ts');
const generate = require('@babel/generator').default;
const React = require('react');
const nativeRenderValue: (value: unknown) => unknown = require('antd/lib/_util/getRenderPropValue').getRenderPropValue;
type Node = unknown;
interface Element {
  type: unknown;
  key?: string | null;
  props: Record<string, unknown>;
}
interface Ref {
  current: unknown;
}
interface WrapperFunction {
  (props: Record<string, unknown>): Element;
  [member: string]: unknown;
}
interface RefWrapper {
  render(props: Record<string, unknown>, ref: Ref): Element;
  [member: string]: unknown;
}
interface Wrappers {
  Tooltip: WrapperFunction;
  Modal: WrapperFunction;
  Button: RefWrapper;
  Input: RefWrapper;
}
const calls: unknown[] = [];
const stub =
  (name: string) =>
  (...args: unknown[]) => {
    calls.push([name, ...args]);
    return null;
  };
const Tooltip = stub('Tooltip');
const Modal = Object.assign(stub('Modal'), {
  confirm: stub('confirm'),
  info: stub('info'),
  warning: stub('warning'),
  error: stub('error'),
  success: stub('success'),
  destroyAll: stub('destroyAll'),
  useModal: stub('useModal'),
});
const Button = Object.assign(stub('Button'), { Group: stub('Group') });
const Input = Object.assign(stub('Input'), {
  Search: stub('Search'),
  TextArea: stub('TextArea'),
  Password: stub('Password'),
  OTP: stub('OTP'),
});
const antd = { Tooltip, Modal, Button, Input };
function load(name: keyof Wrappers): Wrappers[typeof name] {
  const moduleLike: { exports: { default?: Wrappers[typeof name] } } = { exports: {} };
  const code = transformFileSync(path.join(__dirname, name, 'index.tsx'), {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('require', 'module', 'exports', code)(
    (request: string) => {
      if (request === 'antd') return antd;
      if (request.endsWith('.less')) return {};
      return require(request);
    },
    moduleLike,
    moduleLike.exports,
  );
  assert.ok(moduleLike.exports.default);
  return moduleLike.exports.default;
}
const wrappers: Wrappers = {
  Tooltip: load('Tooltip') as WrapperFunction,
  Modal: load('Modal') as WrapperFunction,
  Button: load('Button') as RefWrapper,
  Input: load('Input') as RefWrapper,
};
const click = () => {};
const ref: Ref = { current: null };
const child = React.createElement('button', { onClick: click, ref, title: 'child' }, 'Child');
const tooltipRef: Ref = { current: null };
const oldChange = () => {},
  newChange = () => {};
let tooltip = wrappers.Tooltip({
  children: child,
  title: 'Title',
  visible: false,
  open: true,
  onVisibleChange: oldChange,
  onOpenChange: newChange,
  arrowPointAtCenter: true,
  arrow: false,
  overlayClassName: 'legacy',
  overlayStyle: { maxWidth: 20, color: 'red' },
  overlayInnerStyle: { padding: 2 },
  zIndex: 0,
  ref: tooltipRef,
});
assert.equal(tooltip.type, Tooltip);
assert.equal(tooltip.props['open'], false);
assert.equal(tooltip.props['onOpenChange'], oldChange);
assert.deepEqual(tooltip.props['arrow'], { pointAtCenter: true });
assert.equal(tooltip.props['zIndex'], 100000);
assert.equal(tooltip.props['ref'], tooltipRef);
assert.deepEqual(tooltip.props['classNames'], { root: 'md-tooltip-overlay legacy' });
assert.deepEqual(tooltip.props['styles'], {
  root: { maxWidth: 20, maxHeight: 300, whiteSpace: 'pre-wrap', color: 'red' },
  container: { padding: 2 },
});
assert.equal(tooltip.props['destroyOnHidden'], true);
const cloned = tooltip.props['children'] as Element;
assert.notEqual(cloned, child);
assert.equal(cloned.type, child.type);
assert.equal(cloned.key, child.key);
assert.equal(cloned.props['onClick'], click);
assert.equal(cloned.props['ref'], ref);
for (const key of [
  'visible',
  'onVisibleChange',
  'arrowPointAtCenter',
  'overlayClassName',
  'overlayStyle',
  'overlayInnerStyle',
  'type',
  'shortcut',
  'maxWidth',
])
  assert.ok(!(key in tooltip.props), `${key} must not leak onto the Ant component`);
tooltip = wrappers.Tooltip({
  children: child,
  title: 'Title',
  visible: undefined,
  open: false,
  onOpenChange: newChange,
  arrowPointAtCenter: false,
  arrow: false,
  destroyTooltipOnHide: false,
  destroyOnHidden: true,
});
assert.equal(tooltip.props['open'], false);
assert.equal(tooltip.props['onOpenChange'], newChange);
assert.equal(tooltip.props['arrow'], false);
assert.equal(tooltip.props['destroyOnHidden'], false);
for (const title of [undefined, null, false, '', 0])
  assert.equal(wrappers.Tooltip({ children: child, title }).props['title'], null);
const white = wrappers.Tooltip({ children: child, title: 'White', type: 'white' });
assert.equal(white.props['color'], 'white');
assert.equal((white.props['title'] as Element).props['className'], 'textBlack');
const custom = wrappers.Tooltip({ children: child, title: 'Custom', color: 'purple', type: 'black' });
assert.equal(custom.props['color'], 'purple');

let titleCalls = 0;
let receiver: unknown = 'not called';
function titleFunction(this: unknown) {
  'use strict';
  titleCalls++;
  receiver = this;
  return 'Lazy';
}
assert.equal(
  wrappers.Tooltip({ children: child, title: titleFunction }).props['title'],
  titleFunction,
  'Undecorated callback keeps its identity',
);
const lazy = wrappers.Tooltip({ children: child, title: titleFunction, shortcut: 'Ctrl+K' }).props['title'];
assert.equal(titleCalls, 0, 'Title callback remains lazy');
assert.equal(typeof lazy, 'function');
if (typeof lazy !== 'function') throw new Error('Missing lazy title');
const rendered = nativeRenderValue(lazy) as Element;
assert.equal(titleCalls, 1);
assert.equal(receiver, undefined, 'Title callback keeps the SDK plain-call receiver');
assert.equal((rendered.props['children'] as Node[])[0], 'Lazy');
const whiteLazy = wrappers.Tooltip({ children: child, title: titleFunction, type: 'white' }).props['title'];
if (typeof whiteLazy !== 'function') throw new Error('Missing white lazy title');
assert.equal((nativeRenderValue(whiteLazy) as Element).props['className'], 'textBlack');
const titleError = new Error('title rejected');
const invalidTitle = wrappers.Tooltip({
  children: child,
  title: () => {
    throw titleError;
  },
  shortcut: 'K',
}).props['title'];
if (typeof invalidTitle !== 'function') throw new Error('Missing callback');
assert.throws(
  () => invalidTitle(),
  (error: unknown) => error === titleError,
  'Callback exceptions keep the real render failure',
);

const focusable = { trap: false, focusTriggerAfterClose: false };
const modal = wrappers.Modal({ open: true, title: 'Modal', focusable });
assert.equal(modal.type, Modal);
assert.equal(modal.props['focusable'], focusable, 'Production focus-trap override is passed by original reference');
assert.equal(modal.props['footer'], null);
assert.equal(modal.props['keyboard'], false);
assert.deepEqual(modal.props['mask'], { closable: false });
assert.equal(modal.props['destroyOnHidden'], true);
const styles = { body: { color: 'red' } },
  okButtonProps = { disabled: true, loading: true };
const onOk = () => {};
const confirming = wrappers.Modal({
  onOk,
  styles,
  okButtonProps,
  okDisabled: false,
  fullScreen: true,
  width: 600,
  animated: false,
  headerRightElement: 'Right',
  footerLeftElement: () => 'Left',
});
assert.equal(confirming.props['onOk'], onOk);
assert.equal(confirming.props['styles'], styles);
assert.equal(confirming.props['width'], '100vw');
assert.deepEqual(confirming.props['okButtonProps'], { disabled: false, loading: true });
assert.equal(confirming.props['transitionName'], '');
assert.equal(confirming.props['maskTransitionName'], '');
const footer = confirming.props['footer'];
if (typeof footer !== 'function') throw new Error('Missing modal footer');
const footerTree = footer('Native footer', { OkBtn: stub('OkBtn'), CancelBtn: stub('CancelBtn') }) as Element;
assert.equal((footerTree.props['children'] as Node[])[1], 'Native footer');
let footerReceiver: unknown;
function nativeFooter(this: unknown, node: Node, controls: Node) {
  'use strict';
  footerReceiver = this;
  return [node, controls];
}
const decorated = wrappers.Modal({ footer: nativeFooter, footerLeftElement: 'Left' });
const decoratedFooter = decorated.props['footer'];
if (typeof decoratedFooter !== 'function') throw new Error('Missing decorated footer');
const controls = { OkBtn: stub('Ok'), CancelBtn: stub('Cancel') };
const decoratedTree = decoratedFooter('Native', controls) as Element;
assert.deepEqual((decoratedTree.props['children'] as Node[])[1], ['Native', controls]);
assert.equal(footerReceiver, undefined);
assert.equal(wrappers.Modal({ footer: null, footerLeftElement: 'Left' }).props['footer'], null);
for (const key of ['confirm', 'info', 'warning', 'error', 'success', 'destroyAll', 'useModal'] as const)
  assert.equal(wrappers.Modal[key], Modal[key]);

const button = wrappers.Button.render(
  {
    color: '#123456',
    variant: 'textBordered',
    children: 'Text',
    ellipsis: true,
    wide: true,
    className: 'own',
    onClick: click,
    style: { paddingInline: 5 },
  },
  ref,
);
assert.equal(button.props['ref'], ref);
assert.equal(button.props['color'], 'primary');
assert.equal(button.props['variant'], 'text');
assert.equal(button.props['title'], 'Text');
assert.equal(button.props['className'], 'own overflowHidden ellipsis');
assert.equal(button.props['onClick'], click);
assert.deepEqual(button.props['style'], {
  border: '1px solid currentColor',
  color: '#123456',
  borderColor: '#123456',
  paddingInline: 5,
});
const nativeButton = wrappers.Button.render(
  { color: 'default', variant: 'textBordered', title: '', children: 7, ellipsis: true },
  ref,
);
assert.equal(nativeButton.props['color'], 'default');
assert.equal(nativeButton.props['title'], '');
assert.deepEqual(nativeButton.props['style'], { border: '1px solid var(--color-border-primary)' });
const noColor = wrappers.Button.render({ children: child, ellipsis: true }, ref);
assert.ok(!('color' in noColor.props));
assert.ok(!('variant' in noColor.props));
assert.equal(noColor.props['title'], undefined);
assert.equal(wrappers.Button['Group'], Button.Group);
const input = wrappers.Input.render(
  { value: 'Text', radius: true, style: { borderRadius: 7 }, onChange: click, onCompositionStart: click },
  ref,
);
assert.equal(input.props['ref'], ref);
assert.deepEqual(input.props['style'], { borderRadius: 7 });
assert.equal(input.props['value'], 'Text');
assert.equal(input.props['onChange'], click);
assert.equal(input.props['onCompositionStart'], click);
assert.ok(!('radius' in input.props));
for (const key of ['Search', 'TextArea', 'Password', 'OTP'] as const) assert.equal(wrappers.Input[key], Input[key]);

// Use the installed align SDK's actual supportAdjust algorithm, not an expected-value mirror.
const alignFile = path.resolve(__dirname, '../../../node_modules/@rc-component/trigger/es/hooks/useAlign.js');
const alignTree = parser.parse(fs.readFileSync(alignFile, 'utf8'), { sourceType: 'module' });
const traverse: typeof import('@babel/traverse').default = require('@babel/traverse').default;
let adjustSource: string | undefined;
traverse(alignTree, {
  VariableDeclarator(entry) {
    if (entry.node.id.type === 'Identifier' && entry.node.id.name === 'supportAdjust')
      adjustSource = generate(entry.node.init).code;
  },
});
assert.ok(adjustSource);
const supportAdjust: (value: unknown) => boolean = new Function(`return ${adjustSource};`)();
const original: number[] & { adjustX?: boolean; adjustY?: boolean } = [0, 0];
assert.equal(supportAdjust(original.adjustX), supportAdjust(false));
assert.equal(supportAdjust(original.adjustY), supportAdjust(false));
console.log(
  'Actual Antd wrapper aliases, lazy title callbacks, clone/ref/events, Modal focus/footer, Button/Input bindings and native align equivalence passed',
);
