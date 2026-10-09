const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
interface Message {
  triggerType?: string;
  originalEvent?: unknown;
  [key: string]: unknown;
}
interface EventManager {
  subscribe(id: string, callback: (message: Message) => void): () => void;
  publish(id: string, message?: Message): void;
  clear(id?: string): void;
}
interface Helper {
  subscribe(callback: (message: Message) => void): void;
  unsubscribe(): void;
  destroy(): void;
  publish(message?: Message): void;
}
interface FormOptions {
  containerRef: { current: TestElement | null };
  stateRef: { current: { renderData: Array<{ controlId: string; type: number; disabled?: boolean }> } };
  disabledTabs?: boolean;
  disabledChildTableCheck?: boolean;
  from?: number;
  flag?: unknown;
}
interface FormResult {
  instanceId: string;
  tabFocusArr: string[];
  setTabFocusArr: (value: string[]) => void;
}
interface ModuleAbi {
  widgetEventManager: EventManager;
  WidgetEventHelper: new (id?: string) => Helper;
  useWidgetEvent(id: string | undefined, callback?: (message: Message) => void): { publish(message: Message): void };
  useFormEventManager(options: FormOptions): FormResult;
}
type Listener = NonNullable<Parameters<EventTarget['addEventListener']>[1]>;
class TrackedTarget extends EventTarget {
  readonly listeners = new Map<string, Set<Listener>>();
  override addEventListener(
    type: string,
    callback: Listener | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, callback, options);
    if (callback) {
      const list = this.listeners.get(type) || new Set();
      list.add(callback);
      this.listeners.set(type, list);
    }
  }
  override removeEventListener(
    type: string,
    callback: Listener | null,
    options?: EventListenerOptions | boolean,
  ): void {
    super.removeEventListener(type, callback, options);
    if (callback) this.listeners.get(type)?.delete(callback);
  }
  listenerCount(type: string): number {
    return this.listeners.get(type)?.size || 0;
  }
}
class TestElement extends TrackedTarget {
  readonly classes: Set<string>;
  children: TestElement[] = [];
  parent: TestElement | null = null;
  attributes: Record<string, string> = {};
  scrolled = 0;
  classList: { contains: (value: string) => boolean };
  constructor(classes = '', id?: string) {
    super();
    this.classes = new Set(classes.split(' ').filter(Boolean));
    this.classList = { contains: value => this.classes.has(value) };
    if (id) this.attributes['data-instance-id'] = id;
  }
  add(child: TestElement): TestElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }
  getAttribute(key: string): string | null {
    return this.attributes[key] ?? null;
  }
  matches(selector: string): boolean {
    if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
    if (selector.startsWith('#')) return this.attributes['id'] === selector.slice(1);
    const id = selector.match(/^\[data-instance-id="(.*)"\]$/)?.[1];
    return id !== undefined && this.attributes['data-instance-id'] === id;
  }
  closest(selector: string): TestElement | null {
    return this.matches(selector) ? this : this.parent?.closest(selector) || null;
  }
  querySelectorAll(selector: string): TestElement[] {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string): TestElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }
  contains(element: TestElement): boolean {
    return element === this || this.children.some(child => child.contains(element));
  }
  scrollIntoView(): void {
    this.scrolled++;
  }
}
class TestKeyboardEvent extends Event {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  constructor(key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}) {
    super('keydown', { cancelable: true });
    this.key = key;
    this.ctrlKey = !!modifiers.ctrlKey;
    this.metaKey = !!modifiers.metaKey;
    this.shiftKey = !!modifiers.shiftKey;
  }
}
class TestWindow extends TrackedTarget {
  FormActiveTabId?: string[];
  activeTableId?: string;
  isMacOs = false;
}
interface Effect {
  dependencies: unknown[];
  cleanup?: (() => void) | undefined;
}
let current: HookRunner;
class HookRunner {
  values: unknown[] = [];
  index = 0;
  effects = new Map<number, Effect>();
  pending: Array<() => void> = [];
  dirty = false;
  render: () => unknown;
  result: unknown;
  constructor(render: () => unknown) {
    this.render = render;
  }
  draw(commit = true): unknown {
    current = this;
    this.index = 0;
    this.dirty = false;
    this.result = this.render();
    if (commit) this.commit();
    return this.result;
  }
  commit(): void {
    const work = this.pending.splice(0);
    work.forEach(callback => callback());
  }
  flush(): unknown {
    for (let i = 0; this.dirty && i < 10; i++) this.draw();
    return this.result;
  }
  unmount(): void {
    this.effects.forEach(effect => effect.cleanup?.());
    this.effects.clear();
  }
}
function equal(before: unknown[] | undefined, after: unknown[]): boolean {
  return !!before && before.length === after.length && before.every((value, index) => Object.is(value, after[index]));
}
const react = {
  useState(initial: unknown) {
    const runner = current,
      index = runner.index++;
    if (!(index in runner.values)) runner.values[index] = initial;
    return [
      runner.values[index],
      (value: unknown) => {
        const next = typeof value === 'function' ? value(runner.values[index]) : value;
        if (!Object.is(next, runner.values[index])) {
          runner.values[index] = next;
          runner.dirty = true;
        }
      },
    ];
  },
  useRef(initial: unknown) {
    const runner = current,
      index = runner.index++;
    if (!(index in runner.values)) runner.values[index] = { current: initial };
    return runner.values[index];
  },
  useMemo(factory: () => unknown, dependencies: unknown[]) {
    const runner = current,
      index = runner.index++;
    const previous = runner.values[index] as { dependencies: unknown[]; value: unknown } | undefined;
    if (!previous || !equal(previous.dependencies, dependencies))
      runner.values[index] = { dependencies, value: factory() };
    return (runner.values[index] as { value: unknown }).value;
  },
  useCallback(callback: unknown, dependencies: unknown[]) {
    return react.useMemo(() => callback, dependencies);
  },
  useEffect(callback: () => void | (() => void), dependencies: unknown[]) {
    const runner = current,
      index = runner.index++;
    const previous = runner.effects.get(index);
    if (!equal(previous?.dependencies, dependencies))
      runner.pending.push(() => {
        previous?.cleanup?.();
        const cleanup = callback();
        runner.effects.set(index, { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined });
      });
  },
};
function load(): { api: ModuleAbi; win: TestWindow; body: TestElement } {
  const file = process.env.FORM_EVENT_SOURCE || path.join(__dirname, 'useFormEventManager.ts');
  const { code } = transformFileSync(file);
  const win = new TestWindow(),
    body = new TestElement();
  let nextId = 0;
  const moduleLike: { exports: Partial<ModuleAbi> } = { exports: {} };
  new Function('module', 'exports', 'require', 'window', 'document', 'Element', 'CustomEvent', 'console', code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (name === 'react') return react;
      if (name === 'lodash') return lodash;
      if (name === 'uuid') return { v4: () => `instance-${++nextId}` };
      if (name === 'src/utils/common') return { browserIsMobile: () => false };
      if (name === '../core/utils')
        return {
          supportTabKeyDown: (control?: { disabled?: boolean }, _from?: number, disabledChild?: boolean) =>
            !!control && !control.disabled && !disabledChild,
        };
      throw Error('Unexpected event manager dependency ' + name);
    },
    win,
    { body, querySelector: (selector: string) => body.querySelector(selector) },
    TestElement,
    CustomEvent,
    { log: () => {} },
  );
  return { api: moduleLike.exports as ModuleAbi, win, body };
}
const { api, win, body } = load();
const manager = api.widgetEventManager;
const helper = new api.WidgetEventHelper('instance-a~field');
assert.doesNotThrow(() => helper.destroy(), 'Destroy before subscribing must be harmless');
const received: string[] = [];
helper.subscribe(message => received.push(String(message.triggerType)));
helper.publish({ triggerType: 'Enter' });
helper.unsubscribe();
helper.publish({ triggerType: 'Enter' });
helper.destroy();
helper.destroy();
assert.deepEqual(received, ['Enter']);
helper.subscribe(message => received.push('again:' + message.triggerType));
helper.publish({ triggerType: 'ArrowRight' });
helper.destroy();
assert.deepEqual(received, ['Enter', 'again:ArrowRight']);
const oldCleanup = manager.subscribe('replace~field', () => received.push('old'));
manager.subscribe('replace~field', () => received.push('new'));
oldCleanup();
manager.publish('replace~field', { triggerType: 'Enter' });
assert.equal(received.at(-1), 'new', 'A stale disposer cannot delete the current subscription');
const identicalCallback = () => received.push('same');
const identicalCleanup = manager.subscribe('replace~same', identicalCallback);
manager.subscribe('replace~same', identicalCallback);
identicalCleanup();
manager.publish('replace~same');
assert.equal(received.at(-1), 'same', 'Subscriptions have distinct ownership even when callback identity is reused');
manager.subscribe('instance-a~one', () => received.push('a'));
manager.subscribe('instance-ab~one', () => received.push('ab'));
manager.clear('instance-a');
manager.publish('instance-a~one');
manager.publish('instance-ab~one');
assert.equal(received.at(-1), 'ab');
let callback = (message: Message) => received.push('first:' + message.triggerType);
let widgetId = 'hook~field';
const widget = new HookRunner(() => api.useWidgetEvent(widgetId, callback));
widget.draw();
manager.publish(widgetId, { triggerType: 'Enter' });
callback = message => received.push('latest:' + message.triggerType);
widget.draw();
manager.publish(widgetId, { triggerType: 'ArrowLeft' });
assert.equal(received.at(-1), 'latest:ArrowLeft');
widgetId = 'hook~second';
widget.draw();
const before = received.length;
manager.publish('hook~field', { triggerType: 'Enter' });
assert.equal(received.length, before);
manager.publish(widgetId, { triggerType: 'Enter' });
callback = message => received.push('uncommitted:' + message.triggerType);
widget.draw(false);
manager.publish(widgetId, { triggerType: 'Enter' });
assert.equal(received.at(-1), 'latest:Enter', 'An uncommitted callback render cannot leak into the live subscription');
widget.commit();
manager.publish(widgetId, { triggerType: 'Enter' });
assert.equal(received.at(-1), 'uncommitted:Enter');
widget.unmount();
const after = received.length;
manager.publish(widgetId, { triggerType: 'Enter' });
assert.equal(received.length, after);
function form(from = 3) {
  const container = body.add(new TestElement());
  const options: FormOptions = {
    containerRef: { current: container },
    stateRef: {
      current: {
        renderData: [
          { controlId: 'first', type: 9 },
          { controlId: 'second', type: 34 },
          { controlId: 'third', type: 2 },
        ],
      },
    },
    from,
    flag: 1,
  };
  const runner = new HookRunner(() => api.useFormEventManager(options));
  const result = runner.draw() as FormResult;
  runner.flush();
  for (const id of ['first', 'second', 'third'])
    container
      .add(new TestElement('customFormItem', result.instanceId + '~' + id))
      .add(new TestElement('customFormItemControl'));
  return { runner, options, container, result: () => runner.result as FormResult };
}
const trace: Array<{ id: string; trigger?: string; event?: unknown }> = [];
const primary = form();
for (const id of ['first', 'second', 'third'])
  manager.subscribe(primary.result().instanceId + '~' + id, message =>
    trace.push({ id, trigger: message.triggerType, event: message.originalEvent }),
  );
primary.container.children.unshift(
  new TestElement('customFormItem', 'foreign~first'),
  new TestElement('customFormItem', primary.result().instanceId + '~'),
);
const tab = new TestKeyboardEvent('Tab');
win.dispatchEvent(tab);
primary.runner.flush();
assert.equal(tab.defaultPrevented, true);
assert.equal(primary.result().tabFocusArr[0], primary.result().instanceId + '~first');
assert.equal(trace[0]?.event, tab, 'The exact EventTarget event object is retained through dispatch');
win.dispatchEvent(new TestKeyboardEvent('Enter'));
assert.equal(trace.at(-1)?.trigger, 'Enter');
win.dispatchEvent(new TestKeyboardEvent('Tab'));
primary.runner.flush();
assert.equal(primary.result().tabFocusArr[0], primary.result().instanceId + '~second');
assert.deepEqual(
  trace.slice(-2).map(item => item.trigger),
  ['trigger_tab_leave', 'trigger_tab_enter'],
);
const secondId = primary.result().instanceId + '~second';
win.dispatchEvent(new CustomEvent('form-request-tab-to-next', { detail: { formItemId: 17 } }));
primary.runner.flush();
assert.equal(primary.result().tabFocusArr[0], secondId);
win.dispatchEvent(new Event('form-request-tab-to-next'));
primary.runner.flush();
assert.equal(primary.result().tabFocusArr[0], secondId);
win.dispatchEvent(
  new CustomEvent('form-request-tab-to-next', { detail: { formItemId: secondId, extra: { unknown: true } } }),
);
primary.runner.flush();
assert.equal(primary.result().tabFocusArr[0], primary.result().instanceId + '~third');
assert.equal(trace.at(-1)?.event, null);
const secondary = form();
const beforeSecondary = trace.length;
win.dispatchEvent(new TestKeyboardEvent('Tab'));
primary.runner.flush();
secondary.runner.flush();
assert.equal(trace.length, beforeSecondary, 'Only the last committed form handles Tab');
secondary.runner.unmount();
primary.options.disabledTabs = true;
primary.runner.draw();
primary.runner.flush();
const disabledTab = new TestKeyboardEvent('Tab');
win.dispatchEvent(disabledTab);
assert.equal(disabledTab.defaultPrevented, false);
primary.options.disabledTabs = false;
primary.runner.draw();
primary.runner.flush();
win.activeTableId = 'subtable';
win.dispatchEvent(new TestKeyboardEvent('Tab'));
assert.equal(trace.length, beforeSecondary);
win.activeTableId = undefined;
win.dispatchEvent(new TestKeyboardEvent('Escape'));
primary.runner.flush();
assert.deepEqual(primary.result().tabFocusArr, []);
const plainTarget = new EventTarget();
const click = new Event('click');
Object.defineProperty(click, 'target', { value: plainTarget });
assert.doesNotThrow(() => body.dispatchEvent(click));
// Clicking a text control records it as the start point; its next Tab wraps to the first field.
const third = primary.container.querySelector('[data-instance-id="' + primary.result().instanceId + '~third"]')
  ?.children[0];
assert.ok(third);
const insideClick = new Event('click');
Object.defineProperty(insideClick, 'target', { value: third });
body.dispatchEvent(insideClick);
primary.runner.flush();
assert.deepEqual(primary.result().tabFocusArr, ['', primary.result().instanceId + '~third']);
win.dispatchEvent(new TestKeyboardEvent('Tab'));
primary.runner.flush();
assert.equal(primary.result().tabFocusArr[0], primary.result().instanceId + '~first');
// A known nontext popup keeps focus; an actual outside element clears it.
const overlay = body.add(new TestElement('selectUserBox'));
const popupClick = new Event('click');
Object.defineProperty(popupClick, 'target', { value: overlay });
body.dispatchEvent(popupClick);
primary.runner.flush();
assert.equal(primary.result().tabFocusArr[0], primary.result().instanceId + '~first');
const outside = body.add(new TestElement());
const outsideClick = new Event('click');
Object.defineProperty(outsideClick, 'target', { value: outside });
body.dispatchEvent(outsideClick);
primary.runner.flush();
assert.deepEqual(primary.result().tabFocusArr, []);
win.dispatchEvent(new TestKeyboardEvent('Tab'));
primary.runner.flush();
primary.options.flag = 2;
primary.runner.draw();
primary.runner.flush();
assert.deepEqual(primary.result().tabFocusArr, [], 'A form reset releases the focused widget');
primary.options.disabledChildTableCheck = true;
primary.runner.draw();
primary.runner.flush();
const skipped = trace.length;
win.dispatchEvent(new TestKeyboardEvent('Tab'));
primary.runner.flush();
assert.equal(trace.length, skipped, 'A changed permission option is used by the current listener');
primary.options.disabledChildTableCheck = false;
primary.runner.draw();
primary.runner.flush();
win.dispatchEvent(new TestKeyboardEvent('Tab'));
primary.runner.flush();
const cleanupTrace = trace.length;
primary.runner.unmount();
manager.publish(primary.result().instanceId + '~first', { triggerType: 'Enter' });
assert.equal(trace.length, cleanupTrace);
assert.deepEqual(win.FormActiveTabId, []);
assert.equal(win.listenerCount('keydown'), 0);
assert.equal(win.listenerCount('form-request-tab-to-next'), 0);
assert.equal(body.listenerCount('click'), 0);
const abandoned = new HookRunner(() =>
  api.useFormEventManager({ containerRef: { current: null }, stateRef: { current: { renderData: [] } } }),
);
abandoned.draw(false);
assert.deepEqual(win.FormActiveTabId, [], 'An uncommitted render cannot leave a phantom form');
console.log(
  'Actual widget manager/hooks/helper lifecycle, latest callbacks, native event identity, instance isolation and child Tab completion passed',
);
