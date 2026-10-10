const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError('Expected fixture object');
  return value;
}

function read(value: unknown, key: string): unknown {
  if (!value || (typeof value !== 'object' && typeof value !== 'function'))
    throw new TypeError('Expected fixture receiver');
  return Reflect.get(value, key);
}

function invoke(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError('Expected actual source method: ' + key);
  return Reflect.apply(fn, value, args);
}

class Component {
  props: Record<string, unknown>;
  state: unknown = {};
  updates = 0;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(patch: object) {
    Object.assign(record(this.state), patch);
    this.updates++;
  }
}
class ElementFixture {
  className = 'mui-dialog-scroll-container';
  id = '';
}
const domEvents: string[] = [];
const elements: unknown[] = [];
const timerCallbacks: Array<() => void> = [];
const keyboardCallbacks: Array<() => void> = [];
const renders: unknown[] = [];
let selectionText = '';
let selectionCalls = 0;
const body = {
  clientHeight: 900,
  clientWidth: 1200,
  appendChild(child: object) {
    Object.assign(child, { parentNode: body });
    domEvents.push('append');
  },
  removeChild() {
    domEvents.push('remove');
  },
  contains() {
    return true;
  },
};
const windowFixture = {
  innerHeight: 900,
  innerWidth: 1200,
  closeFns: {},
  getSelection() {
    selectionCalls++;
    return { toString: () => selectionText };
  },
  addEventListener(name: string) {
    domEvents.push('listen:' + name);
  },
  removeEventListener(name: string) {
    domEvents.push('unlisten:' + name);
  },
};
Object.assign(globalThis, {
  Element: ElementFixture,
  document: {
    body,
    documentElement: body,
    createElement() {
      const element = { style: {} };
      elements.push(element);
      return element;
    },
    querySelectorAll() {
      return [];
    },
  },
  window: windowFixture,
  _l: (text: string) => text,
});
const originalSetTimeout = globalThis.setTimeout;

function timers() {
  for (const callback of timerCallbacks.splice(0)) callback();
}

const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
const modules = new Map<string, Record<string, unknown>>();

function load(name: string): Record<string, unknown> {
  if (modules.has(name)) return modules.get(name)!;
  const module = { exports: {} };
  const code = transformFileSync(path.join(__dirname, name)).code;
  new Function('module', 'exports', 'require', 'setTimeout', code)(
    module,
    module.exports,
    (request: string) => {
      if (request === 'react') return { Component };
      if (request === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (request === 'react-use') return { useKey: (_name: string, fn: () => void) => keyboardCallbacks.push(fn) };
      if (request === 'react-dom') return { createPortal: (children: unknown) => children };
      if (request === 'react-dom/client')
        return {
          createRoot: () => ({
            render: (node: unknown) => renders.push(node),
            unmount: () => domEvents.push('unmount'),
          }),
        };
      if (request === 'react-redux') return { shallowEqual: () => false };
      if (request === 'lodash') return lodash;
      if (request === 'classnames') return require('classnames');
      if (request === 'prop-types') return require('prop-types');
      if (request.startsWith('@babel/runtime/')) return require(request);
      if (request.startsWith('ming-ui/components/')) return { __esModule: true, default: request };
      if (request.endsWith('.less')) return {};
      if (request.startsWith('./')) return load(request.slice(2) + (request === './index' ? '.ts' : '.tsx'));
      throw new Error('Unexpected dependency: ' + request);
    },
    (fn: () => void) => {
      timerCallbacks.push(fn);
      return 1;
    },
  );
  const exports = record(module.exports);
  modules.set(name, exports);
  return exports;
}

function construct(target: unknown, props: Record<string, unknown>): unknown {
  if (typeof target !== 'function') throw new TypeError('Expected actual source constructor');
  const defaults = read(target, 'defaultProps');
  return Reflect.construct(target, [Object.assign({}, defaults, props)]);
}

function button(action?: () => unknown) {
  let closes = 0;
  const value = construct(load('ConfirmButton.tsx')['default'], { action, onClose: () => closes++ });
  invoke(value, 'componentDidMount');
  return { value, closes: () => closes };
}

async function run() {
  for (const result of [false, undefined, null, true, 0, 12, 'done', { opaque: 'metadata' }]) {
    let receiver: unknown;
    const target = button(function (this: unknown) {
      receiver = this;
      return result;
    });
    invoke(target.value, 'handleClick');
    assert.equal(receiver, target.value, 'action keeps its component receiver');
    assert.equal(target.closes(), result === false ? 0 : 1);
  }

  for (const noClose of [undefined, false, true, { message: 'keep open' }]) {
    let settle: ((value: unknown) => void) | undefined;
    const response = {
      then(ok: (value: unknown) => void, fail: (value: unknown) => void) {
        assert.equal(this, response);
        assert.equal(ok, fail);
        settle = ok;
      },
    };
    const target = button(() => response);
    invoke(target.value, 'handleClick');
    assert.equal(read(read(target.value, 'state'), 'loading'), true);
    if (!settle) throw new Error('Actual then callback was not registered');
    settle(noClose);
    assert.equal(read(read(target.value, 'state'), 'loading'), false);
    assert.equal(target.closes(), noClose ? 0 : 1);
  }

  const getterOrder: unknown[] = [];
  let getterButton: unknown;
  const accessorResponse = {
    get then() {
      getterOrder.push(read(read(getterButton, 'state'), 'loading'));
      if (getterOrder.length === 1) return { truthyGate: true };
      return function (this: unknown, done: (value: unknown) => void) {
        assert.equal(this, accessorResponse);
        done(undefined);
      };
    },
  };
  const accessor = button(() => accessorResponse);
  getterButton = accessor.value;
  invoke(accessor.value, 'handleClick');
  assert.deepEqual(getterOrder, [false, true], 'both property gets retain the original loading order');
  assert.equal(accessor.closes(), 1);

  const success = button(() => Promise.resolve(undefined));
  invoke(success.value, 'handleClick');
  await Promise.resolve();
  assert.equal(success.closes(), 1);
  const failure = button(() => Promise.reject(false));
  invoke(failure.value, 'handleClick');
  await Promise.resolve();
  assert.equal(failure.closes(), 1, 'legacy rejection-false also closes');
  let primitiveReceiver: unknown;
  Object.defineProperty(Number.prototype, 'then', {
    configurable: true,
    get: function (this: unknown) {
      'use strict';
      assert.equal(typeof this, 'number');
      return function (this: unknown, done: (value: unknown) => void) {
        'use strict';
        primitiveReceiver = this;
        done(undefined);
      };
    },
  });
  try {
    const scalar = button(() => 42);
    invoke(scalar.value, 'handleClick');
    assert.equal(primitiveReceiver, 42);
    assert.equal(scalar.closes(), 1);
  } finally {
    Reflect.deleteProperty(Number.prototype, 'then');
  }

  let resolve: (value: unknown) => void = () => {};

  const pending = new Promise(ok => {
    resolve = ok;
  });
  const unmounted = button(() => pending);
  invoke(unmounted.value, 'handleClick');
  invoke(unmounted.value, 'componentWillUnmount');
  const updateCount = read(unmounted.value, 'updates');
  resolve(undefined);
  await Promise.resolve();
  assert.equal(read(unmounted.value, 'updates'), updateCount, 'late response does not set unmounted state');
  assert.equal(unmounted.closes(), 1, 'legacy late close callback is preserved');
  assert.throws(() => invoke(button(() => ({ then: 1 })).value, 'handleClick'), TypeError);

  const dialog = load('Dialog.tsx');
  const Dialog = dialog['default'];
  if (typeof Dialog !== 'function') throw new Error('Expected actual UseKey wrapper');
  const ref = { current: null };
  const events: string[] = [];
  const props = {
    visible: true,
    bindEnterTriggerOk: true,
    ref,
    height: 321,
    zIndex: 99,
    onOk: (event?: unknown) => {
      assert.equal(event, undefined);
      events.push('ok');
    },
    onCancel: () => events.push('cancel'),
    children: 'body',
    footer: null,
  };
  const element = record(Reflect.apply(Dialog, undefined, [props]));
  assert.equal(read(element['props'], 'ref'), ref, 'React 19 props.ref reaches the actual inner class');
  const inner = construct(element['type'], record(element['props']));
  assert.equal(read(read(inner, 'props'), 'height'), 321);
  assert.equal(read(read(inner, 'props'), 'zIndex'), 99, 'legacy metadata is retained on ref.props');
  invoke(inner, 'handleOk');
  invoke(inner, 'handleCancel');
  assert.deepEqual(events.splice(0), ['ok', 'cancel']);
  keyboardCallbacks.at(-1)?.();
  assert.deepEqual(events.splice(0), ['ok']);
  Reflect.apply(Dialog, undefined, [{ ...props, confirmOnOk: () => events.push('confirmed') }]);
  keyboardCallbacks.at(-1)?.();
  assert.deepEqual(events.splice(0), ['confirmed', 'cancel']);
  Reflect.apply(Dialog, undefined, [{ ...props, visible: false }]);
  keyboardCallbacks.at(-1)?.();
  assert.deepEqual(events, []);
  Reflect.apply(Dialog, undefined, [{ ...props, onCancel: undefined, confirmOnOk: () => events.push('confirmed') }]);
  assert.throws(() => keyboardCallbacks.at(-1)?.(), TypeError, 'missing cancel keeps the legacy failure after confirm');
  assert.deepEqual(events.splice(0), ['confirmed']);

  for (const footer of [undefined, null, false, 'custom']) {
    let calls = 0;
    const current = construct(load('DialogFooter.tsx')['default'], {
      footer,
      footerLeftElement: () => {
        calls++;
        return 'left';
      },
    });
    const rendered = invoke(current, 'render');
    assert.equal(calls, footer ? 2 : 1, 'existing eager footer-left evaluation order is unchanged');
    if (footer === null || footer === false) assert.equal(rendered, footer);
  }

  const base = construct(load('DialogBase.tsx')['default'], {
    visible: true,
    width: '480.9',
    maxHeight: 1000,
    onClose: () => events.push('overlay'),
  });
  const dialogNode = { style: {} },
    ghost = { style: {} };
  if (!base || typeof base !== 'object') throw new Error('Expected base instance');
  Reflect.set(base, '_dialog', dialogNode);
  Reflect.set(base, '_ghost', ghost);
  invoke(base, 'componentDidMount');
  assert.equal(read(dialogNode.style, 'width'), '480px');
  assert.equal(read(dialogNode.style, 'maxHeight'), '836px');
  const tree = record(invoke(base, 'render'));
  const children = read(tree['props'], 'children');
  if (!Array.isArray(children)) throw new Error('Expected actual base container children');
  const scroll = children[1];
  const target = new ElementFixture();
  target.id = String(read(base, 'dialogId'));
  invoke(read(scroll, 'props'), 'onClick', [{ target }]);
  assert.deepEqual(events.splice(0), ['overlay']);
  selectionText = 'selected text';
  invoke(read(scroll, 'props'), 'onClick', [{ target }]);
  assert.deepEqual(events, []);
  const calls = selectionCalls;
  target.className = 'nested';
  invoke(read(scroll, 'props'), 'onClick', [{ target }]);
  assert.equal(selectionCalls, calls, 'selection is only read on the actual overlay target');
  invoke(base, 'componentWillUnmount');
  assert.equal(Object.keys(windowFixture.closeFns).length, 0);

  const staticDialog = load('index.ts')['default'];
  assert.equal(staticDialog, Dialog, 'static methods attach to the same HOC function');
  let cancel: unknown = 'not-called';
  const close = invoke(staticDialog, 'confirm', [
    {
      title: 'confirm',
      onCancel: (isOk?: boolean) => {
        cancel = isOk;
      },
    },
  ]);
  if (typeof close !== 'function') throw new Error('Expected close callback');
  Reflect.apply(close, undefined, [false]);
  timers();
  assert.equal(cancel, 'not-called');
  const close2 = invoke(staticDialog, 'confirm', [
    {
      onCancel: (isOk?: boolean) => {
        cancel = isOk;
      },
    },
  ]);
  if (typeof close2 !== 'function') throw new Error('Expected close callback');
  Reflect.apply(close2, undefined, [true, true]);
  timers();
  assert.equal(cancel, true);
  const ok = invoke(staticDialog, 'promise', [{}]);
  invoke(read(renders.at(-1), 'props'), 'onOk');
  assert.equal(await ok, undefined);
  const rejected = invoke(staticDialog, 'promise', [{}]);
  invoke(read(renders.at(-1), 'props'), 'onCancel');
  let rejection: unknown = 'pending';
  if (!(rejected instanceof Promise)) throw new Error('Expected actual promise');
  await rejected.catch(error => {
    rejection = error;
  });
  assert.equal(rejection, undefined, 'cancel keeps the original undefined rejection reason');
  assert.equal(globalThis.setTimeout, originalSetTimeout);
  console.log(
    'Actual Dialog public ref/metadata, callback receivers, scalar/Promise actions, footer order, overlay and promise close paths passed',
  );
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
