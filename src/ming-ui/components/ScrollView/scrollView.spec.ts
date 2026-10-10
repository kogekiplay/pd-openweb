const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');

interface RectElement {
  getBoundingClientRect(): { top: number };
}
interface Viewport extends RectElement {
  scrollTop: number;
  scrollLeft: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  classList: { add(name: string): void; remove(name: string): void };
  scrollTo(options: Record<string, unknown>): void;
  addEventListener(name: string, listener: (event: unknown) => void, options: unknown): void;
  removeEventListener(name: string, listener: (event: unknown) => void): void;
}
interface Instance {
  options(): Record<string, unknown>;
  elements(): { viewport: Viewport; content: Viewport; scrollOffsetElement: Viewport };
  destroy(): void;
}
interface Handle {
  scrollTo(options?: Record<string, unknown>, behavior?: string): void;
  scrollToElement(element: RectElement | null, behavior?: string): void;
  getScrollInfo(): unknown;
}
interface Plugin {
  instance(instance: Instance, event: (name: string, listener: () => void) => void): unknown;
}
interface Node {
  props: Record<string, unknown>;
}
interface Ref {
  current: unknown;
}
let mobile = false;
const effects: Array<() => unknown> = [];
const refs: Ref[] = [];
let handle: Handle;
const wire: unknown[] = [];
const host = { isMacOs: false };
const jsx = (_type: unknown, props: Record<string, unknown>): Node => ({ props });
const imports: Record<string, unknown> = {
  react: {
    forwardRef: (render: unknown) => render,
    useMemo: (factory: () => unknown) => factory(),
    useRef: (current: unknown) => {
      const ref = { current };
      refs.push(ref);
      return ref;
    },
    useEffect: (effect: () => unknown) => effects.push(effect),
    useImperativeHandle: (_ref: unknown, factory: () => Handle) => {
      handle = factory();
    },
  },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  classnames: require('classnames'),
  lodash,
  'prop-types': require('prop-types'),
  overlayscrollbars: { OverlayScrollbars: { plugin: (value: unknown) => wire.push(value) } },
  'overlayscrollbars-react': { OverlayScrollbarsComponent: 'overlay' },
  'src/utils/common': { browserIsMobile: () => mobile },
  'src/utils/project': { compatibleMDJS: (...args: unknown[]) => wire.push(args) },
};
const cache = new Map<string, unknown>();
function load(file: string): unknown {
  const full = path.join(__dirname, file);
  if (cache.has(full)) return cache.get(full);
  const target: { exports: unknown } = { exports: {} };
  const code = transformFileSync(full, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  new Function('module', 'exports', 'require', 'window', code)(
    target,
    target.exports,
    (name: string) => {
      if (name in imports) return imports[name];
      if (/\.css$|\.less$/.test(name)) return {};
      if (name.startsWith('.')) return load(path.join(path.dirname(file), name.replace(/$/, '.ts')));
      throw new Error('Unstubbed import: ' + name);
    },
    host,
  );
  cache.set(full, target.exports);
  return target.exports;
}
// Resolve the actual plugin directory import, with every plugin and options decoder loaded from source.
imports['./plugins'] = load('plugins/index.ts');
const component = (load('index.tsx') as { default(props: Record<string, unknown>, ref: unknown): Node }).default;
const plugins = imports['./plugins'] as { default: { unifiedWheelControl: Plugin; takeOverNavigation: Plugin } };
const bindings = new Map<string, (event: unknown) => void>();
const trace: unknown[] = [];
const viewport: Viewport = {
  scrollTop: 90,
  scrollLeft: 0,
  scrollWidth: 400,
  scrollHeight: 100,
  clientWidth: 100,
  clientHeight: 20,
  getBoundingClientRect() {
    assert.equal(this, viewport);
    return { top: 10 };
  },
  classList: { add: name => trace.push(['add', name]), remove: name => trace.push(['remove', name]) },
  scrollTo(options) {
    assert.equal(this, viewport);
    trace.push(['scrollTo', options]);
  },
  addEventListener(name, listener, options) {
    bindings.set(name, listener);
    trace.push(['listen', name, options]);
  },
  removeEventListener(name, listener) {
    assert.equal(bindings.get(name), listener);
    bindings.delete(name);
    trace.push(['removeListener', name]);
  },
};
let customOptions: unknown = {};
const instance: Instance = {
  options() {
    assert.equal(this, instance);
    return { customOptions };
  },
  elements() {
    assert.equal(this, instance);
    return { viewport, content: viewport, scrollOffsetElement: viewport };
  },
  destroy() {
    assert.equal(this, instance);
    trace.push('destroy');
  },
};
function frame(props: Record<string, unknown>) {
  effects.length = 0;
  refs.length = 0;
  const node = component(props, null);
  const reference = refs[0];
  assert.ok(reference);
  return { node, reference, effects: effects.slice(), handle };
}
const callbacks: unknown[] = [];
const options = { scrollbars: { visibility: 'hidden', theme: 'ignored-inner' }, update: { debounce: [100, 200] } };
const rendered = frame({
  id: 'host',
  class: 'legacy',
  'data-purpose': 'scroll',
  theme: 'outer',
  options,
  scrollContentClassName: 'content',
  setViewPortRef: (value: unknown) => callbacks.push(['viewport', value]),
  onScroll: (value: unknown) => callbacks.push(['scroll', value]),
  onScrollEnd: (value: unknown) => callbacks.push(['end', value]),
  onReachVerticalEdge: (value: unknown) => callbacks.push(['vertical', value]),
});
assert.deepEqual(rendered.handle.getScrollInfo(), {});
rendered.reference.current = { osInstance: () => null };
assert.equal(rendered.handle.getScrollInfo(), undefined);
rendered.handle.scrollTo();
rendered.handle.scrollToElement(null);
assert.deepEqual(trace, [], 'Absent initialization does not issue a fabricated scroll');
rendered.reference.current = { osInstance: () => instance };
const cleanup = rendered.effects
  .map(effect => effect())
  .filter((value): value is () => void => typeof value === 'function');
assert.equal(rendered.node.props['id'], 'host');
assert.equal(rendered.node.props['class'], 'legacy');
assert.equal(rendered.node.props['data-purpose'], 'scroll');
const merged = rendered.node.props['options'] as {
  scrollbars: { theme: string; visibility: string };
  update: { debounce: number[] };
};
assert.equal(merged.scrollbars.theme, 'outer');
assert.equal(merged.scrollbars.visibility, 'hidden');
assert.deepEqual(merged.update.debounce, [100, 200]);
assert.equal(options.scrollbars.theme, 'ignored-inner', 'Source options remain unchanged');
rendered.handle.scrollTo({ top: 4 }, 'smooth');
rendered.handle.scrollToElement({ getBoundingClientRect: () => ({ top: 25 }) });
assert.deepEqual(
  trace.filter(value => Array.isArray(value) && value[0] === 'scrollTo'),
  [
    ['scrollTo', { top: 4, behavior: 'smooth' }],
    ['scrollTo', { top: 105, behavior: 'auto' }],
  ],
);
const info = rendered.handle.getScrollInfo() as Record<string, unknown>;
assert.equal(info['viewport'], viewport);
assert.equal(info['maxScrollTop'], 80);
const events = rendered.node.props['events'] as {
  initialized(instance: Instance): void;
  scroll(instance: Instance): void;
};
events.initialized(instance);
events.scroll(instance);
assert.ok(callbacks.some(value => Array.isArray(value) && value[0] === 'end'));
const customFrame = frame({ customScroll: (value: unknown) => callbacks.push(['custom', value]) });
(customFrame.node.props['events'] as typeof events).scroll(instance);
assert.ok(callbacks.some(value => Array.isArray(value) && value[0] === 'custom' && value[1] === instance));
const destroyed: Array<() => void> = [];
const subscribe = (name: string, fn: () => void) => {
  assert.equal(name, 'destroyed');
  destroyed.push(fn);
};
customOptions = {
  isMobile: false,
  disableParentScroll: true,
  enableWheelDirectionControl: true,
  future: { opaque: true },
};
plugins.default.unifiedWheelControl.instance(instance, subscribe);
const wheel = bindings.get('wheel');
assert.ok(wheel);
let prevented = 0;
wheel({
  shiftKey: true,
  metaKey: false,
  deltaY: 500,
  deltaX: 0,
  preventDefault: () => prevented++,
  stopPropagation() {},
});
assert.equal(viewport.scrollLeft, 300);
assert.equal(prevented, 1);
wheel({
  shiftKey: false,
  metaKey: false,
  deltaY: 4,
  deltaX: 5,
  preventDefault: () => prevented++,
  stopPropagation() {},
});
assert.equal(viewport.scrollTop, 94);
assert.equal(viewport.scrollLeft, 305);
destroyed.pop()?.();
assert.equal(bindings.has('wheel'), false);
customOptions = { isMobile: true, enableSwipeBack: false };
plugins.default.takeOverNavigation.instance(instance, subscribe);
const start = bindings.get('touchstart'),
  move = bindings.get('touchmove');
assert.ok(start && move);
start({ touches: [] });
start({ touches: [{ clientX: 0, clientY: 0 }] });
move({ touches: [{ clientX: 2, clientY: 20 }] });
assert.equal(wire.filter(value => Array.isArray(value)).length, 0);
move({ touches: [{ clientX: 20, clientY: 1 }] });
assert.ok(wire.some(value => Array.isArray(value) && value[0] === 'takeOverNavigation'));
destroyed.pop()?.();
assert.equal(bindings.size, 0);
assert.ok(wire.some(value => Array.isArray(value) && value[0] === 'handOverNavigation'));
customOptions = { isMobile: 'true' };
assert.throws(() => plugins.default.unifiedWheelControl.instance(instance, subscribe), /Invalid scroll plugin/);
const absent = frame({ defer: true });
absent.reference.current = { osInstance: () => null };
assert.doesNotThrow(() =>
  absent.effects
    .map(effect => effect())
    .forEach(value => {
      if (typeof value === 'function') value();
    }),
);

async function finish() {
  const before = callbacks.filter(value => Array.isArray(value) && value[0] === 'scroll').length;
  viewport.scrollTop = 96;
  events.scroll(instance);
  cleanup.forEach(fn => fn());
  await new Promise(resolve => setTimeout(resolve, 350));
  const after = callbacks.filter(value => Array.isArray(value) && value[0] === 'scroll').length;
  assert.equal(after, before, 'Unmount cancels the pending trailing scroll callback');
  assert.ok(trace.some(value => Array.isArray(value) && value[0] === 'remove' && value[1] === 'content'));
  console.log('Actual ScrollView SDK options, refs, edge callbacks, plugins and deferred/unmount cleanup passed');
}
finish().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
