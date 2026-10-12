import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
const sourcePath = 'src/ming-ui/components/Button.tsx';
const before = process.env['BUTTON_BEFORE_REV'];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid observation');
  return value[key];
}
function call(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  if (typeof fn !== 'function') throw new TypeError('Missing observed function');
  return Reflect.apply(fn, receiver, args);
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
function fixture(props: Record<string, unknown> = {}, old = false) {
  const errors: unknown[] = [],
    writes: unknown[] = [];
  const timers = new Map<number, () => void>();
  let timer = 0,
    measurements = 0;
  class Element {
    getBoundingClientRect() {
      measurements++;
      return { width: 96 };
    }
  }
  const source =
    old && before
      ? execFileSync('git', ['show', before + ':' + sourcePath], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, sourcePath), 'utf8');
  const compiled = harness.transformSync(source, {
    filename: path.join(root, sourcePath),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  assert.ok(compiled?.code);
  const target: { exports: unknown } = { exports: {} };
  const imports = (name: string) => {
    if (name === 'react' || name === 'react/jsx-runtime' || name === 'classnames' || name === 'prop-types')
      return require(name);
    if (name === './Icon')
      return {
        __esModule: true,
        default: ({ icon }: { icon: string }) => React.createElement('i', { 'data-icon': icon }),
      };
    if (name.endsWith('.less')) return {};
    throw new Error('Unexpected import: ' + name);
  };
  new Function('module', 'exports', 'require', 'Element', 'console', 'setTimeout', 'clearTimeout', compiled.code)(
    target,
    target.exports,
    imports,
    Element,
    { error: (error: unknown) => errors.push(error) },
    (fn: () => void) => {
      timers.set(++timer, fn);
      return timer;
    },
    (id: number) => timers.delete(id),
  );
  const Button = read(target.exports, 'default');
  if (typeof Button !== 'function') throw new TypeError('Missing actual Button class');
  const defaults = read(Button, 'defaultProps');
  assert.ok(object(defaults));
  const instance: unknown = Reflect.construct(Button, [{ ...defaults, ...props }]);
  assert.ok(object(instance));
  instance['setState'] = (patch: unknown) => {
    assert.ok(object(patch));
    const previous = read(instance, 'state');
    assert.ok(object(previous));
    instance['state'] = { ...previous, ...patch };
    writes.push(patch);
  };
  return {
    instance,
    errors,
    writes,
    timers,
    get measurements() {
      return measurements;
    },
    loading() {
      return read(read(instance, 'state'), 'loading');
    },
    invoke(name: string, ...args: unknown[]) {
      return call(instance, read(instance, name), ...args);
    },
    mount() {
      instance['button'] = new Element();
      this.invoke('componentDidMount');
    },
    unmount() {
      this.invoke('componentWillUnmount');
    },
    measure() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    render() {
      const element = this.invoke('render');
      assert.ok(React.isValidElement<Record<string, unknown>>(element));
      return element;
    },
    html() {
      return ReactDOM.renderToStaticMarkup(this.render());
    },
    click(event: unknown = { kind: 'click' }) {
      const fn = this.render().props['onClick'];
      if (fn) call(undefined, fn, event);
    },
  };
}

async function main() {
  const observations: Record<string, unknown>[] = [
    {},
    { children: 'Run' },
    { children: '' },
    { children: 0 },
    { children: React.createElement('strong', null, 'Run') },
    { icon: 'save', children: 'Save' },
    { icon: null, children: 'Plain' },
    { disabled: true, children: 'Disabled' },
    { loading: true, children: 'Pending' },
    { loading: true, loadingClassName: 'custom-loading' },
    { fullWidth: true },
    { fullWidth: true, style: { width: 132, height: 44 } },
    { radius: true, title: 'rounded', 'data-purpose': 'submit' },
    { type: 'custom-visual', size: 'custom-size' },
    ...['primary', 'secondary', 'success', 'danger', 'ghost', 'link', 'ghostgray', 'danger-gray'].map(type => ({
      type,
      children: 'Button',
    })),
    ...['tiny', 'small', 'medium', 'large', 'mdnormal', 'mdbig'].map(size => ({ size, children: 'Size' })),
  ];
  for (const props of observations) {
    const f = fixture(props);
    f.mount();
    f.measure();
    if (before) {
      const old = fixture(props, true);
      old.mount();
      old.measure();
      assert.equal(f.html(), old.html());
      old.unmount();
    }
    assert.equal(f.render().props['type'], 'button');
    f.unmount();
  }
  const native = fixture({
    action: () => {},
    onClick: () => {},
    loadingClassName: 'spinner',
    'data-purpose': 'save',
    style: { height: 44 },
  });
  const rendered = native.render();
  assert.equal(rendered.props['action'], undefined, 'Component action never leaks to the DOM');
  assert.equal(rendered.props['loading'], undefined);
  assert.equal(rendered.props['loadingClassName'], undefined);
  assert.equal(rendered.props['data-purpose'], 'save');
  assert.equal(read(rendered.props['style'], 'height'), 44);
  let prevented = 0;
  call(undefined, rendered.props['onKeyDown'], { preventDefault: () => prevented++ });
  assert.equal(prevented, 1);

  for (const old of before ? [false, true] : [false]) {
    const task = deferred();
    const calls: unknown[] = [];
    const event = { event: 'click' };
    const f = fixture(
      {
        action: function (this: unknown, arg: unknown) {
          calls.push(['action', this, arg]);
          return task.promise;
        },
        onClick: function (this: unknown, arg: unknown) {
          calls.push(['click', this, arg]);
        },
      },
      old,
    );
    f.mount();
    f.measure();
    f.click(event);
    assert.equal(f.loading(), true);
    assert.equal(f.render().props['disabled'], true);
    assert.equal(read(f.render().props['style'], 'width'), 96);
    assert.deepEqual(calls, [
      ['action', f.instance, event],
      ['click', f.instance, event],
    ]);
    assert.equal(read(f.instance, 'promise'), task.promise);
    f.click();
    assert.equal(calls.length, 2, 'Loading prevents repeated UI clicks');
    task.resolve('ok');
    await flush();
    assert.equal(f.loading(), false);
    f.unmount();
    const rejected = deferred();
    const rejectFixture = fixture({ action: () => rejected.promise }, old);
    rejectFixture.mount();
    rejectFixture.click();
    rejected.reject(new Error('failure'));
    await flush();
    assert.equal(rejectFixture.loading(), false);
    rejectFixture.unmount();
  }

  for (const value of [undefined, null, false, 0, 'ok', {}, () => {}]) {
    let clicked = 0;
    const f = fixture({ action: () => value, onClick: () => clicked++ });
    f.mount();
    f.click();
    assert.equal(f.loading(), false, 'A synchronous action finishes loading');
    assert.equal(clicked, 1);
    assert.equal(f.errors.length, 0);
    f.unmount();
  }
  for (const action of [
    () => {
      throw new Error('synchronous error');
    },
    () => ({ then: 7 }),
    () => ({
      get then() {
        throw new Error('getter error');
      },
    }),
    () => ({
      then() {
        throw new Error('then error');
      },
    }),
  ]) {
    let clicked = 0;
    const f = fixture({ action, onClick: () => clicked++ });
    f.mount();
    f.click();
    assert.equal(f.loading(), false);
    assert.equal(f.errors.length, 1);
    assert.equal(clicked, 1);
    f.unmount();
  }

  const first = deferred(),
    second = deferred();
  let index = 0;
  const concurrent = fixture({ action: () => (++index === 1 ? first.promise : second.promise) });
  concurrent.mount();
  // Two native click callbacks can be captured before React commits the disabled render.
  const handler = concurrent.render().props['onClick'];
  call(undefined, handler, {});
  call(undefined, handler, {});
  first.resolve('older');
  await flush();
  assert.equal(concurrent.loading(), true, 'Old completion cannot clear the current action');
  second.resolve('newest');
  await flush();
  assert.equal(concurrent.loading(), false);
  concurrent.unmount();

  const late = deferred();
  const unmounted = fixture({ action: () => late.promise });
  unmounted.mount();
  unmounted.click();
  unmounted.unmount();
  const writes = unmounted.writes.length;
  late.resolve('late');
  await flush();
  assert.equal(unmounted.writes.length, writes, 'Unmounted button never receives async state writes');
  const measurement = fixture();
  measurement.mount();
  measurement.unmount();
  measurement.measure();
  assert.equal(measurement.measurements, 0);
  assert.equal(measurement.timers.size, 0);
  const remountTask = deferred();
  const remounted = fixture({ action: () => remountTask.promise });
  remounted.mount();
  remounted.click();
  remounted.unmount();
  remounted.mount();
  assert.equal(remounted.loading(), false, 'A revived lifecycle starts without the invalidated action spinner');
  const remountWrites = remounted.writes.length;
  remountTask.resolve('old lifecycle');
  await flush();
  assert.equal(remounted.writes.length, remountWrites);
  remounted.unmount();

  let thenReceiver: unknown, getterReceiver: unknown, finish: unknown;
  const thenable = {
    get then() {
      getterReceiver = this;
      return function (this: unknown, complete: unknown) {
        thenReceiver = this;
        finish = complete;
      };
    },
  };
  const custom = fixture({ action: () => thenable });
  custom.mount();
  custom.click();
  assert.equal(custom.loading(), true);
  assert.equal(getterReceiver, thenable);
  assert.equal(thenReceiver, thenable);
  call(undefined, finish);
  assert.equal(custom.loading(), false);
  custom.unmount();
  for (const props of [{ disabled: true }, { loading: true }]) {
    let calls = 0;
    const f = fixture({ ...props, action: () => calls++, onClick: () => calls++ });
    f.mount();
    f.click();
    assert.equal(calls, 0);
    f.unmount();
  }
  console.log(
    JSON.stringify({
      renderingCases: observations.length,
      synchronousResults: 7,
      failures: 4,
      lifecycleAndConcurrency: true,
      historicalAB: !!before,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
