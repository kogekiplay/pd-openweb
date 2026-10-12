import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
const before = process.env['POSITION_BEFORE_REV'];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  assert.ok(object(value));
  return value[key];
}
function invoke(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  if (typeof fn !== 'function') throw new TypeError('Missing observation');
  return Reflect.apply(fn, receiver, args);
}
const rect = (left = 100, top = 100, width = 100, height = 30) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
class FakeNode {
  nodeType = 3;
  parentNode: FakeElement | null = null;
  contains(value: unknown) {
    if (value === this) return true;
    for (let p = value instanceof FakeNode ? value.parentNode : null; p; p = p.parentNode)
      if (Object.is(p, this)) return true;
    return false;
  }
}
class FakeElement extends FakeNode {
  override nodeType = 1;
  tagName: string;
  className = '';
  classes = new Set<string>();
  classList = {
    contains: (name: string) => this.className.split(' ').includes(name) || this.classes.has(name),
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
  };
  style = { left: '', top: '', display: '' };
  bounds = rect(0, 0, 160, 80);
  scrollTop = 0;
  children: FakeElement[] = [];
  listeners = new Map<string, Set<unknown>>();
  constructor(tag = 'DIV') {
    super();
    this.tagName = tag;
  }
  getBoundingClientRect() {
    return this.bounds;
  }
  appendChild(node: FakeElement) {
    node.remove();
    this.children.push(node);
    node.parentNode = this;
    return node;
  }
  removeChild(node: FakeElement) {
    this.children = this.children.filter(child => child !== node);
    node.parentNode = null;
    return node;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  addEventListener(name: string, fn: unknown) {
    const set = this.listeners.get(name) || new Set();
    set.add(fn);
    this.listeners.set(name, set);
  }
  removeEventListener(name: string, fn: unknown) {
    this.listeners.get(name)?.delete(fn);
  }
}
const body = Object.assign(new FakeElement('BODY'), {
  clientWidth: 800,
  clientHeight: 600,
  bounds: rect(0, 0, 800, 600),
});
const html = new FakeElement('HTML');
html.appendChild(body);
class Collection {
  [index: number]: FakeElement;
  length: number;
  nodes: FakeElement[];
  constructor(nodes: FakeElement[]) {
    this.nodes = nodes;
    this.length = nodes.length;
    nodes.forEach((node, i) => {
      this[i] = node;
    });
  }
  toArray() {
    return this.nodes;
  }
  offset() {
    const node = this.nodes[0];
    return node ? { left: node.bounds.left, top: node.bounds.top } : undefined;
  }
  width() {
    return this.nodes[0]?.bounds.width;
  }
  closest(value: unknown) {
    const others = value instanceof Collection ? value.nodes : [];
    return new Collection(this.nodes.filter(node => others.some(other => other.contains(node))));
  }
}
const selectors = new Map<string, FakeElement[]>();
function jquery(value: unknown) {
  return value instanceof Collection
    ? value
    : new Collection(
        typeof value === 'string' ? selectors.get(value) || [] : value instanceof FakeElement ? [value] : [],
      );
}
jquery.prototype = Collection.prototype;
const windowListeners = new Map<string, Set<unknown>>(),
  timers = new Map<number, unknown>(),
  microtasks: unknown[] = [];
let timerId = 0;
Reflect.set(globalThis, 'Node', FakeNode);
Reflect.set(globalThis, 'Element', FakeElement);
Reflect.set(globalThis, '$', jquery);
Reflect.set(globalThis, 'document', { body, documentElement: html, createElement: () => new FakeElement() });
Reflect.set(globalThis, 'window', {
  jQuery: jquery,
  setTimeout: (fn: unknown) => {
    const id = ++timerId;
    timers.set(id, fn);
    return id;
  },
  clearTimeout: (id: number) => timers.delete(id),
  addEventListener: (name: string, fn: unknown) => {
    const set = windowListeners.get(name) || new Set();
    set.add(fn);
    windowListeners.set(name, set);
  },
  removeEventListener: (name: string, fn: unknown) => windowListeners.get(name)?.delete(fn),
});
Reflect.set(globalThis, 'setTimeout', (fn: unknown) => {
  const id = ++timerId;
  timers.set(id, fn);
  return id;
});
Reflect.set(globalThis, 'queueMicrotask', (fn: unknown) => microtasks.push(fn));
function flushTimers() {
  const callbacks = [...timers.values()];
  timers.clear();
  for (const fn of callbacks) invoke(undefined, fn);
}
function flushMicrotasks() {
  for (const fn of microtasks.splice(0)) invoke(undefined, fn);
}

function fixture(revision?: string) {
  const cache = new Map<string, Record<string, unknown>>();
  const roots: { container: unknown; renders: unknown[]; unmounted: boolean }[] = [];
  function load(name: string): Record<string, unknown> {
    const existing = cache.get(name);
    if (existing) return existing;
    const file = `src/ming-ui/components/${name}.tsx`;
    const source = revision
      ? execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, file), 'utf8');
    const compiled = harness.transformSync(source, {
      filename: path.join(root, file),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    assert.ok(compiled?.code);
    const target: { exports: Record<string, unknown> } = { exports: {} };
    function imports(request: string): unknown {
      if (request === 'react-dom/client')
        return {
          createRoot: (container: unknown) => {
            if (!(container instanceof FakeElement)) throw new TypeError('Missing root container');
            const state = { container, renders: [] as unknown[], unmounted: false };
            roots.push(state);
            return {
              render: (child: unknown) => state.renders.push(child),
              unmount: () => {
                state.unmounted = true;
              },
            };
          },
        };
      if (request === './ClickAway' || request === 'ming-ui/components/ClickAway') return load('ClickAway');
      if (request === 'react-use') return { useClickAway: () => {} };
      if (request.endsWith('.less')) return {};
      return require(request);
    }
    new Function('module', 'exports', 'require', compiled.code)(target, target.exports, imports);
    cache.set(name, target.exports);
    return target.exports;
  }
  function instance(name: string, props: Record<string, unknown> = {}) {
    const Component = load(name)['default'];
    if (typeof Component !== 'function') throw new TypeError('Missing class');
    const defaults = read(Component, 'defaultProps');
    const supplied = object(defaults) ? { ...defaults, ...props } : props;
    const value: unknown = Reflect.construct(Component, [supplied]);
    assert.ok(object(value));
    value['setState'] = (patch: unknown, callback: unknown) => {
      assert.ok(object(patch));
      const state = read(value, 'state');
      assert.ok(object(state));
      value['state'] = { ...state, ...patch };
      if (callback) invoke(value, callback);
    };
    return {
      value,
      call(method: string, ...args: unknown[]) {
        return invoke(value, read(value, method), ...args);
      },
      update(patch: Record<string, unknown>) {
        const previous = read(value, 'props');
        assert.ok(object(previous));
        value['props'] = { ...previous, ...patch };
        this.call('componentDidUpdate', previous);
      },
    };
  }
  return { roots, load, instance };
}

function contracts() {
  const temporary = fs.mkdtempSync(path.join(root, 'node_modules/.cache/hap-position-contract-'));
  try {
    const source = path.join(temporary, 'contract.tsx'),
      styles = path.join(temporary, 'styles.d.ts'),
      config = path.join(temporary, 'tsconfig.json');
    fs.writeFileSync(
      source,
      `import PositionContainer, {type PositionContainerProps} from '${root}/src/ming-ui/components/PositionContainer';
import Popup from '${root}/src/ming-ui/components/Popup/popup';
export const absentAnchor=<PositionContainer visible={false} bounding={null} />;
export const valid=<PositionContainer visible bounding={new DOMRect(0,0,20,10)} offset={{left:undefined}} popupParentNode={()=>null}><span>Calendar</span></PositionContainer>;
export const props:PositionContainerProps={visible:true,placement:'right',onClickAwayExceptions:[{current:null}],onHide:()=>{}};
// @ts-expect-error Only supported placements are accepted.
export const badPlacement=<PositionContainer placement="anywhere" />;
// @ts-expect-error Actual anchor geometry is required.
export const badAnchor=<PositionContainer bounding={{top:1}} />;
// @ts-expect-error Pixel offsets are numeric.
export const badOffset=<PositionContainer offset={{left:'10px'}} />;
// @ts-expect-error Arbitrary payload objects are not children.
export const badChildren=<PositionContainer>{{invalid:true}}</PositionContainer>;
export const popup=<Popup style={{left:10}} arrowStyle={{marginLeft:5}} onClickAway={()=>{}}>QR</Popup>;
// @ts-expect-error Popup style follows native CSS.
export const invalidStyle=<Popup style={{left:{wrong:true}}} />;
`,
    );
    fs.writeFileSync(styles, "declare module '*.less';\n");
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [source, styles, path.join(root, 'types/global.d.ts')],
        exclude: [],
      }),
    );
    execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', config, '--pretty', 'false'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function main() {
  const current = fixture(),
    old = before ? fixture(before) : undefined;
  let placements = 0;
  for (const placement of ['top', 'bottom', 'left', 'right'])
    for (const anchor of [rect(), rect(720, 520, 60, 30), rect(20, 20, 30, 20)])
      for (const custom of [false, true]) {
        const parent = custom
          ? Object.assign(new FakeElement(), { bounds: rect(10, 15, 600, 400), scrollTop: 20 })
          : body;
        const props = { placement, bounding: anchor, popupParentNode: () => parent };
        const popup = new FakeElement();
        const value = current.instance('PositionContainer', props);
        Object.assign(value.value, { bounding: anchor, popup, popupParentNode: parent, hasTop: !custom });
        const method = custom ? 'getCurrentClientRect' : 'getBoundingClientRect';
        const position = value.call(method);
        if (old) {
          const previous = old.instance('PositionContainer', props);
          Object.assign(previous.value, { bounding: anchor, popup, popupParentNode: parent, hasTop: !custom });
          assert.deepEqual(position, previous.call(method));
        }
        placements++;
      }
  const appearances: Record<string, unknown>[] = [
    {},
    {
      className: 'qr',
      style: { left: 0, top: 10 },
      arrowStyle: { marginLeft: 3 },
      children: React.createElement('div', null, 'QR'),
    },
    { withMask: true, className: 'history', children: React.createElement('span', null, 'History') },
  ];
  for (const props of appearances) {
    const component = current.load('Popup/popup')['default'];
    if (typeof component !== 'function') throw new TypeError('Missing popup');
    const markup = ReactDOM.renderToStaticMarkup(
      React.createElement(component as import('react').ComponentType, props),
    );
    if (old) {
      const prior = old.load('Popup/popup')['default'];
      if (typeof prior !== 'function') throw new TypeError('Missing old popup');
      assert.equal(
        markup,
        ReactDOM.renderToStaticMarkup(React.createElement(prior as import('react').ComponentType, props)),
      );
    }
  }
  const hides: unknown[] = [];
  const layer = current.instance('PositionContainer', {
    visible: true,
    bounding: rect(),
    children: 'first',
    onHide: () => hides.push('hide'),
  });
  assert.doesNotThrow(() => layer.call('componentDidMount'));
  assert.equal(current.roots.length, 1);
  flushTimers();
  const popup = read(layer.value, 'popup');
  assert.ok(popup instanceof FakeElement);
  assert.ok(popup.classList.contains('PositionContainer-active'));
  layer.update({ children: 'second' });
  assert.equal(current.roots.length, 1);
  assert.deepEqual(current.roots[0]?.renders, ['first', 'second']);
  layer.update({ visible: false });
  flushTimers();
  assert.equal(popup.style.left, '-99999px');
  assert.equal(popup.classList.contains('PositionContainer-active'), false);
  layer.update({ visible: true });
  layer.update({ bounding: null });
  flushTimers();
  assert.equal(popup.classList.contains('PositionContainer-active'), false);
  layer.update({ bounding: rect(), offset: { left: 5 } });
  flushTimers();
  assert.ok(!popup.style.top.includes('NaN'));
  assert.equal(popup.style.left, '105px');
  const child = new FakeElement();
  popup.appendChild(child);
  layer.call('destroy', { target: child });
  layer.call('destroy', { target: popup });
  assert.equal(hides.length, 0);
  const exempt = new FakeElement();
  body.appendChild(exempt);
  selectors.set('.exempt', [exempt]);
  layer.update({ onClickAwayExceptions: ['.exempt', { current: exempt }, jquery(exempt)] });
  layer.call('destroy', { target: exempt });
  assert.equal(hides.length, 0);
  const outside = new FakeElement();
  body.appendChild(outside);
  layer.call('destroy', { target: outside });
  assert.equal(hides.length, 1);
  const anotherParent = new FakeElement();
  body.appendChild(anotherParent);
  layer.update({ popupParentNode: () => anotherParent });
  assert.equal(popup.parentNode, anotherParent);
  assert.equal(current.roots.length, 1);
  popup.remove();
  layer.update({ children: 'reattached' });
  assert.equal(popup.parentNode, anotherParent);
  assert.equal(current.roots.length, 1);
  assert.equal(windowListeners.get('resize')?.size, 1);
  layer.call('componentWillUnmount');
  assert.equal(windowListeners.get('resize')?.size, 0);
  assert.equal(body.listeners.get('click')?.size, 0);
  flushTimers();
  flushMicrotasks();
  assert.equal(current.roots[0]?.unmounted, true);
  assert.equal(popup.parentNode, null);
  const init = current.instance('PositionContainer', { isInit: true, visible: false, bounding: null });
  init.call('componentDidMount');
  assert.ok(read(init.value, 'popup') instanceof FakeElement);
  init.call('componentWillUnmount');
  flushTimers();
  flushMicrotasks();
  const unmasked = current.instance('Popup/popup', { style: { left: 0 }, arrowStyle: { color: 'red' } });
  const floating = new FakeElement();
  floating.bounds = rect(750, 0, 100, 50);
  Object.assign(unmasked.value, { popup: floating });
  unmasked.call('componentDidMount');
  assert.deepEqual(read(read(unmasked.value, 'state'), 'style'), { left: -60 });
  assert.deepEqual(read(read(unmasked.value, 'state'), 'arrowStyle'), { color: 'red', marginLeft: 60 });
  contracts();
  console.log(
    JSON.stringify({
      placements,
      popupRenderings: appearances.length,
      historicalAB: !!old,
      initialVisibility: true,
      rootReuse: true,
      staleTimers: true,
      cleanup: true,
      clickAway: true,
      reparenting: true,
      popupRefsAndOverflow: true,
      publicContracts: true,
    }),
  );
}
try {
  main();
} catch (error: unknown) {
  if (object(error) && typeof error['stdout'] === 'string') console.error(error['stdout']);
  console.error(error);
  process.exitCode = 1;
}
