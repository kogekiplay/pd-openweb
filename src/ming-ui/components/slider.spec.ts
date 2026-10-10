const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const fs: typeof import('node:fs') = require('node:fs');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { transformFileSync, transformSync } = require('../../../scripts/spec-harness.ts');

// Extract the actual pure formatter declaration, without loading the unrelated UI/API module graph.
const controlSource = fs.readFileSync(path.join(__dirname, '../../utils/control.ts'), 'utf8');
const controlAst = parser.parse(controlSource, { sourceType: 'module', plugins: ['typescript'] });
const formatterDeclaration = controlAst.program.body.find(
  statement =>
    statement.type === 'ExportNamedDeclaration' &&
    statement.declaration?.type === 'VariableDeclaration' &&
    statement.declaration.declarations.some(
      declaration => declaration.id.type === 'Identifier' && declaration.id.name === 'formatNumberFromInput',
    ),
);
assert.ok(
  formatterDeclaration &&
    typeof formatterDeclaration.start === 'number' &&
    typeof formatterDeclaration.end === 'number',
);
const formatterCode = transformSync(controlSource.slice(formatterDeclaration.start, formatterDeclaration.end), {
  filename: 'actual-slider-formatter.ts',
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const formatterModule: { exports: unknown } = { exports: {} };
new Function('module', 'exports', formatterCode)(formatterModule, formatterModule.exports);
const actualFormatter = (formatterModule.exports as { formatNumberFromInput(value: string, flag: boolean): string })
  .formatNumberFromInput;

interface Node {
  type: unknown;
  props: Record<string, unknown>;
}
interface Tag {
  tag: string;
  order: number;
}
interface Ref {
  current: unknown;
}
type Effect = () => unknown;
interface HookEffect {
  deps: unknown[];
  cleanup?: (() => void) | undefined;
}
interface ElementStub {
  clientWidth: number;
  getBoundingClientRect(): { left: number };
  focus(): void;
  blur(): void;
}
type Handler = (event: unknown) => void;

function node(value: unknown): Node {
  assert.ok(value && typeof value === 'object' && 'type' in value && 'props' in value);
  return value as Node;
}
function isTag(value: unknown): value is Tag {
  return !!value && typeof value === 'object' && 'tag' in value && 'order' in value;
}
function children(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(children);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const item = node(tree);
  return [item, ...children(item.props['children'])];
}
function handler(item: Node, key: string): Handler {
  assert.equal(typeof item.props[key], 'function', key);
  return item.props[key] as Handler;
}

function harness(mobile = false) {
  const states: unknown[] = [];
  const refs: Ref[] = [];
  const callbacks: unknown[] = [];
  const effects: HookEffect[] = [];
  const pendingEffects: Array<{ index: number; effect: Effect; deps: unknown[] }> = [];
  const listeners = new Map<string, Handler>();
  const timers = new Map<number, () => void>();
  const formatCalls: unknown[][] = [];
  const style = { userSelect: '', overflow: '' };
  const documentStub = { body: { style }, activeElement: null as unknown };
  let stateIndex = 0,
    refIndex = 0,
    callbackIndex = 0,
    effectIndex = 0,
    styledIndex = 0,
    timerIndex = 0;
  let dirty = false;
  let props: Record<string, unknown> = {};
  let tree: Node;
  const tag = (name: string) => () => ({ tag: name, order: styledIndex++ });
  const styled = { div: tag('div'), span: tag('span'), input: tag('input') };
  const jsx = (type: unknown, attributes: Record<string, unknown>): Node => ({ type, props: attributes });
  const imports: Record<string, unknown> = {
    react: {
      Fragment: 'fragment',
      useCallback: (fn: unknown) => {
        const index = callbackIndex++;
        if (!(index in callbacks)) callbacks[index] = fn;
        return callbacks[index];
      },
      useMemo: (fn: () => unknown) => fn(),
      useRef: (current: unknown) => {
        const index = refIndex++;
        refs[index] ||= { current };
        return refs[index];
      },
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [
          states[index],
          (next: unknown) => {
            const value = typeof next === 'function' ? next(states[index]) : next;
            if (!Object.is(states[index], value)) dirty = true;
            states[index] = value;
          },
        ];
      },
      useEffect: (effect: Effect, deps: unknown[]) => {
        const index = effectIndex++;
        const old = effects[index];
        if (!old || deps.some((value, i) => !Object.is(value, old.deps[i])))
          pendingEffects.push({ index, effect, deps });
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    lodash: require('lodash'),
    'prop-types': require('prop-types'),
    'src/utils/typedStyled': { __esModule: true, default: styled },
    'ming-ui/antd-components': { Tooltip: 'tooltip' },
    'src/utils/common': { browserIsMobile: () => mobile },
    'src/utils/control': {
      formatNumberFromInput: (value: string, flag: boolean) => {
        formatCalls.push([value, flag]);
        return actualFormatter(value, flag);
      },
    },
  };
  const windowStub = {
    isIphone: mobile,
    addEventListener: (name: string, listener: Handler) => listeners.set(name, listener),
    removeEventListener: (name: string, listener: Handler) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  const target: { exports: unknown } = { exports: {} };
  const code = transformFileSync(path.join(__dirname, 'Slider.tsx'), {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', 'window', 'document', 'setTimeout', 'clearTimeout', code)(
    target,
    target.exports,
    (name: string) => {
      assert.ok(name in imports, `Unstubbed import ${name}`);
      return imports[name];
    },
    windowStub,
    documentStub,
    (fn: () => void) => {
      const id = ++timerIndex;
      timers.set(id, fn);
      return id;
    },
    (id: number | undefined) => {
      if (id !== undefined) timers.delete(id);
    },
  );
  const component = (target.exports as { default(props: Record<string, unknown>): Node }).default;
  const inputElement: ElementStub = {
    clientWidth: 200,
    getBoundingClientRect: () => ({ left: 10 }),
    focus: () => {
      documentStub.activeElement = inputElement;
    },
    blur: () => {
      documentStub.activeElement = null;
    },
  };
  function render() {
    stateIndex = refIndex = callbackIndex = effectIndex = 0;
    pendingEffects.length = 0;
    tree = component(props);
    for (const item of children(tree)) {
      const ref = item.props['ref'];
      if (ref && typeof ref === 'object' && 'current' in ref) ref.current = inputElement;
    }
    for (const { index, effect, deps } of pendingEffects) {
      effects[index]?.cleanup?.();
      const cleanup = effect();
      effects[index] = { deps, cleanup: typeof cleanup === 'function' ? (cleanup as () => void) : undefined };
    }
  }
  function flush() {
    for (let i = 0; dirty; i++) {
      assert.ok(i < 20, 'render loop');
      dirty = false;
      render();
    }
    return tree;
  }
  function mount(next: Record<string, unknown> = {}) {
    props = next;
    render();
    return flush();
  }
  function styledNode(order: number) {
    const item = children(tree).find(item => isTag(item.type) && item.type.order === order);
    assert.ok(item, `Missing styled node ${order}`);
    return item;
  }
  function fire(order: number, key: string, event: unknown = {}) {
    handler(styledNode(order), key)(event);
    return flush();
  }
  function move(clientX: number) {
    const fn = listeners.get(mobile ? 'touchmove' : 'mousemove');
    assert.ok(fn);
    fn(mobile ? { touches: [{ clientX }] } : { clientX });
    return flush();
  }
  function up() {
    const fn = listeners.get(mobile ? 'touchend' : 'mouseup');
    assert.ok(fn);
    fn({});
    return flush();
  }
  function unmount() {
    effects.forEach(effect => effect.cleanup?.());
  }
  function tick() {
    const queued = [...timers.values()];
    timers.clear();
    queued.forEach(fn => fn());
    return flush();
  }
  return {
    mount,
    styledNode,
    fire,
    move,
    up,
    unmount,
    tick,
    listeners,
    timers,
    style,
    formatCalls,
    documentStub,
    inputElement,
  };
}
const event = (clientX: number) => ({ clientX, stopPropagation() {}, preventDefault() {} });

// The actual component runs through its own hooks, JSX handlers and installed formatter call contract.
{
  const h = harness();
  h.mount({ value: '', itemnames: '', itemcolor: 'var(--color-primary)' });
  assert.equal(h.styledNode(8).props['value'], '');
  assert.equal(
    h.styledNode(2).props['style'] && (h.styledNode(2).props['style'] as Record<string, unknown>)['width'],
    '0%',
  );
  h.unmount();
}
{
  const changes: unknown[] = [];
  const h = harness();
  h.mount({ value: 10, min: 0, max: 100, step: 5, onChange: (v: unknown) => changes.push(v) });
  h.fire(1, 'onClick', event(113));
  assert.deepEqual(changes, ['50']);
  assert.equal(h.styledNode(8).props['value'], '50');
  h.fire(8, 'onChange', { target: { value: '102' } });
  assert.deepEqual(changes, ['50', 100]);
  assert.deepEqual(h.formatCalls.at(-1), ['102', false]);
  h.fire(8, 'onChange', { target: { value: '' } });
  assert.deepEqual(changes, ['50', 100, '']);
  h.unmount();
}
{
  const changes: unknown[] = [];
  const h = harness();
  h.mount({ value: 0, itemcolor: { type: 2 }, onChange: (v: unknown) => changes.push(v) });
  assert.equal((h.styledNode(2).props['style'] as Record<string, unknown>)['backgroundColor'], 'var(--color-primary)');
  h.fire(8, 'onChange', { target: { value: 'a4。2.3' } });
  assert.deepEqual(changes, [4.23]);
  assert.equal(h.styledNode(8).props['value'], '4.23');
  h.unmount();
}
{
  const changes: unknown[] = [];
  let handle: { handleFocus(): void; handleBlur(): void } | undefined;
  const h = harness();
  h.mount({
    value: 0.25,
    min: 0,
    max: 1,
    step: 0.05,
    showAsPercent: true,
    liveUpdate: false,
    registerCell: (value: typeof handle) => {
      handle = value;
    },
    onChange: (v: unknown) => changes.push(v),
  });
  assert.equal(h.styledNode(8).props['value'], '25%');
  assert.ok(handle);
  handle.handleFocus();
  assert.equal(h.documentStub.activeElement, h.inputElement);
  h.fire(8, 'onFocus');
  assert.equal(h.styledNode(8).props['value'], 25);
  h.fire(8, 'onChange', { target: { value: '45' } });
  assert.deepEqual(changes, []);
  h.fire(8, 'onBlur', { target: { value: '45' } });
  assert.deepEqual(changes, [0.45]);
  handle.handleBlur();
  assert.equal(h.documentStub.activeElement, null);
  h.unmount();
}
for (const mobile of [false, true]) {
  const changes: unknown[] = [];
  const h = harness(mobile);
  h.mount({ value: 20, step: 5, onChange: (v: unknown) => changes.push(v) });
  h.fire(3, mobile ? 'onTouchStart' : 'onMouseDown', mobile ? { touches: [{ clientX: 50 }] } : event(50));
  assert.equal(h.style.overflow, 'hidden');
  h.move(120);
  assert.deepEqual(changes, []);
  h.up();
  assert.deepEqual(changes, ['55']);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.style.overflow, 'auto');
  assert.equal(h.timers.size, 1);
  h.tick();
  h.unmount();
}
{
  const changes: unknown[] = [];
  const h = harness();
  h.mount({ value: 20, step: 5, triggerWhenMove: true, onChange: (v: unknown) => changes.push(v) });
  h.fire(3, 'onMouseDown', event(50));
  h.move(120);
  assert.deepEqual(changes, ['55']);
  h.unmount();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.style.userSelect, '');
  assert.equal(h.style.overflow, '');
}
{
  const h = harness();
  h.mount({ value: 20 });
  h.style.userSelect = 'text';
  h.style.overflow = 'hidden';
  h.fire(3, 'onMouseDown', event(50));
  h.move(120);
  h.unmount();
  assert.equal(h.style.userSelect, 'text');
  assert.equal(h.style.overflow, 'hidden');
  assert.equal(h.listeners.size, 0);
}
{
  const h = harness();
  h.mount({ value: 20 });
  h.fire(3, 'onMouseDown', event(50));
  h.move(120);
  h.up();
  assert.equal(h.timers.size, 1);
  h.unmount();
  assert.equal(h.timers.size, 0);
}
{
  const h = harness(true);
  h.mount({ value: 20 });
  h.fire(3, 'onTouchStart', { touches: [] });
  assert.equal(h.listeners.size, 0);
  assert.equal(h.style.overflow, '');
  h.fire(3, 'onTouchStart', { touches: [{ clientX: 50 }] });
  const move = h.listeners.get('touchmove');
  assert.ok(move);
  move({ touches: [] });
  h.unmount();
  assert.equal(h.listeners.size, 0);
}
{
  const h = harness();
  h.mount({ value: 20, disabled: true });
  assert.equal(h.styledNode(3).props['onMouseDown'], undefined);
  assert.ok(!children(h.styledNode(0)).some(item => isTag(item.type) && item.type.order === 8));
  h.unmount();
}
console.log(
  'Slider actual component: click/input/percent/ref/drag/live update/disabled/unmount/touch boundaries passed',
);
