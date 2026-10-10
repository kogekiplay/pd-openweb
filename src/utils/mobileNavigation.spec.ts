const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
interface LayerOptions {
  urlParams?: Record<string, string | null | undefined> | undefined;
}
interface HookOptions extends LayerOptions {
  visible?: boolean;
  layerId?: string;
  onClose?: (() => void) | null | undefined;
}
interface Navigation {
  pushHistoryLayer(id: string | undefined, onClose: (() => void) | null | undefined, options?: LayerOptions): boolean;
  popHistoryLayer(id: string | undefined): boolean;
  getHistoryLayerDepth(): number;
  hasHistoryLayer(id: string | undefined): boolean;
  isHistoryLayerPopstate(event: Event): boolean;
  handlePushState(key?: string, value?: string): void;
  handleReplaceState(key: string, value: string, callback?: () => void): void;
  useHistoryBackClose(options: HookOptions): void;
}
interface Entry {
  state: unknown;
  url: string;
}
interface TestPopstate extends Event {
  state: unknown;
}
class Popstate extends Event implements TestPopstate {
  readonly state: unknown;
  constructor(state: unknown) {
    super('popstate');
    this.state = state;
  }
}
interface Effect {
  dependencies: unknown[];
  cleanup?: () => void;
}
function hooks() {
  let index = 0;
  const refs: unknown[] = [];
  const effects = new Map<number, Effect>();
  const pending: Array<() => void> = [];
  return {
    react: {
      useRef(value: unknown) {
        const position = index++;
        if (!(position in refs)) refs[position] = { current: value };
        return refs[position];
      },
      useEffect(setup: () => void | (() => void), dependencies: unknown[]) {
        const position = index++;
        const old = effects.get(position);
        if (
          old &&
          old.dependencies.length === dependencies.length &&
          dependencies.every((value, i) => Object.is(value, old.dependencies[i]))
        )
          return;
        pending.push(() => {
          old?.cleanup?.();
          const cleanup = setup();
          effects.set(position, { dependencies, ...(typeof cleanup === 'function' ? { cleanup } : {}) });
        });
      },
    },
    render(api: Navigation, options: HookOptions) {
      index = 0;
      api.useHistoryBackClose(options);
      pending.splice(0).forEach(run => run());
    },
    unmount() {
      effects.forEach(effect => effect.cleanup?.());
      effects.clear();
    },
  };
}
function load({
  app = false,
  mobile = true,
  initialState = { extra: { rowid: 17 } },
}: { app?: boolean; mobile?: boolean; initialState?: unknown } = {}) {
  const runtime = hooks();
  const listeners: Array<{ handler: (event: TestPopstate) => void; capture: boolean }> = [];
  const entries: Entry[] = [{ state: initialState, url: 'https://example.test/portal/app?old=keep&remove=yes#hash' }];
  let index = 0;
  const pending: Array<() => void> = [];
  const goCalls: number[] = [];
  let pushFailure: unknown;
  let goFailure: unknown;
  const emit = (state: unknown) => {
    const event = new Popstate(state);
    listeners
      .slice()
      .sort((a, b) => Number(b.capture) - Number(a.capture))
      .forEach(listener => listener.handler(event));
    return event;
  };
  const history = {
    get state() {
      return entries[index]?.state;
    },
    pushState(state: unknown, _title: string, url?: string) {
      if (pushFailure) throw pushFailure;
      const old = entries[index];
      if (!old) throw Error('Missing current history');
      entries.splice(index + 1);
      entries.push({ state, url: url ? new URL(url, old.url).href : old.url });
      index++;
    },
    go(steps: number) {
      if (goFailure) throw goFailure;
      goCalls.push(steps);
      pending.push(() => {
        index = Math.max(0, Math.min(entries.length - 1, index + steps));
        emit(history.state);
      });
    },
  };
  const win = {
    isMingDaoApp: app,
    get location() {
      return { href: entries[index]?.url || '' };
    },
    addEventListener(_type: string, handler: (event: TestPopstate) => void, capture = false) {
      listeners.push({ handler, capture });
    },
  };
  const moduleLike: { exports: Partial<Navigation> } = { exports: {} };
  const { code } = transformFileSync(process.env.MOBILE_NAV_SOURCE || path.join(__dirname, 'mobileNavigation.ts'));
  new Function('module', 'exports', 'require', 'window', 'history', 'console', code)(
    moduleLike,
    moduleLike.exports,
    (name: string) =>
      name === 'react'
        ? runtime.react
        : name === 'src/utils/common'
          ? { browserIsMobile: () => mobile }
          : require(name),
    win,
    history,
    { error() {} },
  );
  const api = moduleLike.exports as Navigation;
  return {
    api,
    runtime,
    entries,
    goCalls,
    history,
    win,
    pending,
    failPush(error: unknown) {
      pushFailure = error;
    },
    failGo(error: unknown) {
      goFailure = error;
    },
    flush() {
      pending.splice(0).forEach(run => run());
    },
    back() {
      history.go(-1);
      const run = pending.shift();
      if (!run) throw Error('No navigation');
      run();
    },
    emit,
    listen(handler: (event: TestPopstate) => void) {
      listeners.push({ handler, capture: false });
    },
  };
}
const state = { extra: { rowid: 17 }, list: [{ unknown: 'same' }] };
const nav = load({ app: true, initialState: state });
const closed: string[] = [];
nav.listen(event => closed.push(nav.api.isHistoryLayerPopstate(event) ? 'layer-event' : 'page-event'));
assert.equal(
  nav.api.pushHistoryLayer('parent', () => closed.push('parent'), {
    urlParams: { page: 'detail', remove: null, empty: '', old: undefined },
  }),
  true,
);
assert.equal(nav.history.state !== state, true);
assert.equal((nav.history.state as { extra: unknown }).extra, state.extra);
assert.equal(new URL(nav.win.location.href).searchParams.get('page'), 'detail');
assert.equal(new URL(nav.win.location.href).hash, '#hash');
assert.equal(
  nav.api.pushHistoryLayer('parent', () => closed.push('latest-parent')),
  false,
);
assert.equal(nav.entries.length, 2);
nav.api.pushHistoryLayer('child', () => {
  closed.push('child');
  nav.api.popHistoryLayer('child');
});
nav.back();
assert.equal(nav.api.getHistoryLayerDepth(), 1);
assert.deepEqual(closed, ['child', 'layer-event']);
assert.equal(nav.goCalls.length, 1, 'Browser callback cannot consume another history frame');
nav.back();
assert.equal(nav.api.getHistoryLayerDepth(), 0);
assert.deepEqual(closed.slice(-2), ['latest-parent', 'layer-event']);
const manual = load();
manual.api.pushHistoryLayer('parent', () => closed.push('wrong-parent'));
manual.api.pushHistoryLayer('child', () => closed.push('wrong-child'));
assert.equal(manual.api.popHistoryLayer('child'), true);
manual.flush();
assert.equal(manual.api.hasHistoryLayer('parent'), true);
assert.equal(manual.api.popHistoryLayer('child'), false);
manual.api.pushHistoryLayer('child2', null);
assert.equal(manual.api.popHistoryLayer('parent'), true);
assert.equal(manual.goCalls.at(-1), -2);
manual.flush();
assert.equal(manual.api.getHistoryLayerDepth(), 0);
const legacy = load();
legacy.api.handlePushState('popup', 'value');
legacy.back();
assert.equal(legacy.api.getHistoryLayerDepth(), 0, 'Legacy null onClose remains legal');
legacy.api.handlePushState('popup', 'value');
let replaced = 0;
legacy.api.handleReplaceState('popup', 'value', () => {
  replaced++;
});
legacy.flush();
legacy.api.handleReplaceState('popup', 'value', () => {
  replaced++;
});
assert.equal(replaced, 1);
const web = load();
web.api.pushHistoryLayer('web', null, { urlParams: { new: 'param' } });
assert.equal(web.win.location.href, 'https://example.test/portal/app?old=keep&remove=yes#hash');
assert.equal(load({ mobile: false }).api.pushHistoryLayer('desktop', null), false);
for (const metadata of [null, 'ab', false, 17, [{ nested: 'identity' }]]) {
  const variant = load({ initialState: metadata });
  variant.api.pushHistoryLayer('meta', null);
  const actual = variant.history.state as Record<string, unknown>;
  const expected = Object.assign({}, metadata || {}, { __layerId: 'meta', __layerSeq: 1 });
  assert.deepEqual(actual, expected);
}
const failed = load();
const pushError = new Error('SDK push failure');
failed.failPush(pushError);
assert.throws(
  () => failed.api.pushHistoryLayer('broken', null),
  error => error === pushError,
);
assert.equal(failed.api.getHistoryLayerDepth(), 0, 'Failed push cannot leave a ghost layer');
failed.failPush(undefined);
failed.api.pushHistoryLayer('parent', () => closed.push('safe-parent'));
failed.api.pushHistoryLayer('child', () => closed.push('safe-child'));
const goError = new Error('SDK back failure');
failed.failGo(goError);
assert.throws(
  () => failed.api.popHistoryLayer('child'),
  error => error === goError,
);
assert.equal(failed.api.getHistoryLayerDepth(), 2, 'Failed back keeps the layer and its ownership');
failed.failGo(undefined);
const before = closed.length;
failed.back();
assert.deepEqual(closed.slice(before), ['safe-child'], 'A failed go cannot consume the next actual user back event');
const throwing = load();
throwing.api.pushHistoryLayer('parent', undefined);
throwing.api.pushHistoryLayer('child', () => {
  throw new Error('close callback failed');
});
assert.doesNotThrow(() => throwing.back());
assert.equal(throwing.api.hasHistoryLayer('parent'), true, 'A child callback exception cannot remove its parent');
const failedHook = load();
failedHook.failPush(pushError);
assert.throws(
  () => failedHook.runtime.render(failedHook.api, { visible: true, layerId: 'failed-hook', onClose: null }),
  error => error === pushError,
);
assert.equal(failedHook.api.getHistoryLayerDepth(), 0);
failedHook.failPush(undefined);
failedHook.runtime.render(failedHook.api, { visible: true, layerId: 'failed-hook', onClose: undefined });
assert.equal(
  failedHook.api.getHistoryLayerDepth(),
  1,
  'An initial history failure can retry without a false visible transition',
);
failedHook.failGo(goError);
assert.throws(
  () => failedHook.runtime.unmount(),
  error => error === goError,
);
assert.equal(
  failedHook.api.getHistoryLayerDepth(),
  1,
  'A failed unmount traversal does not claim that history was consumed',
);
failedHook.failGo(undefined);
failedHook.runtime.unmount();
failedHook.flush();
assert.equal(failedHook.api.getHistoryLayerDepth(), 0);
const host = load();
let options: HookOptions = { visible: false, layerId: 'hook', onClose: () => closed.push('old-hook') };
host.runtime.render(host.api, options);
assert.equal(host.api.getHistoryLayerDepth(), 0);
options = { ...options, visible: true };
host.runtime.render(host.api, options);
assert.equal(host.api.getHistoryLayerDepth(), 1);
options = { ...options, onClose: () => closed.push('new-hook') };
host.runtime.render(host.api, options);
const goBefore = host.goCalls.length;
host.back();
assert.equal(closed.at(-1), 'new-hook');
options = { ...options, visible: false };
host.runtime.render(host.api, options);
assert.equal(host.goCalls.length, goBefore + 1, 'Visible close after browser back cannot issue extra go');
options = { ...options, visible: true };
host.runtime.render(host.api, options);
host.runtime.unmount();
host.flush();
assert.equal(host.api.getHistoryLayerDepth(), 0);
const closeHost = load();
closeHost.runtime.render(closeHost.api, { visible: true, layerId: 'closing' });
closeHost.runtime.render(closeHost.api, { visible: false, layerId: 'closing' });
closeHost.flush();
assert.equal(closeHost.api.getHistoryLayerDepth(), 0);
assert.deepEqual(closeHost.goCalls, [-1]);
const malformed = load({ initialState: { __layerSeq: 'bad', extra: true } });
malformed.api.pushHistoryLayer('layer', null);
malformed.back();
assert.equal(
  malformed.api.getHistoryLayerDepth(),
  0,
  'Only the numeric sentinel is read; unknown metadata is not treated as a full history state',
);
console.log(
  'Actual mobile history module/hook nested layers, sentinel marking, App URLs, nullable legacy callbacks, failure rollback and cleanup passed',
);
