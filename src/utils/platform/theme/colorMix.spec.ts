/**
 * Actual-source spec for the 7.5.4 color-mix fallback (colorMix.ts).
 *
 * The working-tree module is loaded through the spec harness (real source, real
 * @ctrl/tinycolor). The pre-fix official module is replayed from its git blob, so the
 * regression below is real source too. The DOM is a minimal stub: it records style
 * writes and dispatches events, but it does NOT compute CSS. So this spec proves control
 * flow and the color math, and nothing about real browser color-mix or computed styles.
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const { transformFileSync, transformSync } = require('../../../../scripts/spec-harness.ts');

type StyleWrite = { name: string; value: string; priority?: string };
interface FakeStyle {
  store: Map<string, { value: string; priority: string }>;
  writes: StyleWrite[];
  getPropertyValue(name: string): string;
  getPropertyPriority(name: string): string;
  setProperty(name: string, value: string, priority?: string): void;
  removeProperty(name: string): void;
  removeAttribute(name: string): void;
}

function fakeStyle(): FakeStyle {
  const store = new Map<string, { value: string; priority: string }>();
  const writes: StyleWrite[] = [];
  return {
    store,
    writes,
    getPropertyValue(name) { const entry = store.get(name); return entry ? entry.value : ''; },
    getPropertyPriority(name) { const entry = store.get(name); return entry ? entry.priority : ''; },
    setProperty(name, value, priority) {
      store.set(name, { value, priority: priority || '' });
      writes.push({ name, value, priority });
    },
    removeProperty(name) { store.delete(name); writes.push({ name, value: '' }); },
    removeAttribute() { /* the resolver resets inline style first */ },
  };
}

function elementClass(): { new (): object } {
  const Klass = function FakeElement() { /* realm marker only */ };
  Object.defineProperty(Klass, 'name', { value: 'FakeElement' });
  return Klass;
}
const ElementCtor = elementClass();

interface FakeElementHandle {
  element: Record<string, unknown>;
  style: FakeStyle;
}

function fakeElement(tagName?: string): FakeElementHandle {
  const element = Object.create(ElementCtor.prototype) as Record<string, unknown>;
  const style = fakeStyle();
  Object.assign(element, {
    tagName,
    style,
    children: [] as unknown[],
    parentElement: null as unknown,
    ownerDocument: null as unknown,
    appendChild(child: unknown) { (element.children as unknown[]).push(child); return child; },
    addEventListener() { /* element level listeners are irrelevant here */ },
    removeEventListener() { /* symmetrical no-op */ },
    remove() { /* probe cleanup */ },
  });
  return { element, style };
}

/** Minimal document/window stub. view.Element is the constructor the guard checks. */
function makeView(options: { supportsColorMix: boolean }) {
  const frames: Array<() => void> = [];
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const record = (type: string, listener: (event: unknown) => void) => {
    const list = listeners.get(type) || [];
    list.push(listener);
    listeners.set(type, list);
  };
  const view: Record<string, unknown> = {
    Element: ElementCtor,
    CSS: { supports: () => options.supportsColorMix },
    MutationObserver: function FakeMutationObserver() {
      return { observe: () => undefined, disconnect: () => undefined, takeRecords: () => undefined };
    },
    requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: () => undefined,
    getComputedStyle: () => ({ color: 'rgb(0, 0, 255)', getPropertyValue: () => '' }),
    addEventListener: (type: string, listener: (event: unknown) => void) => record(type, listener),
    removeEventListener: () => undefined,
  };
  const head = fakeElement('HEAD');
  const body = fakeElement('BODY');
  const document: Record<string, unknown> = {
    defaultView: view,
    head: head.element,
    body: body.element,
    createElement: () => fakeElement('SPAN').element,
    addEventListener: (type: string, listener: (event: unknown) => void) => record(type, listener),
    removeEventListener: () => undefined,
  };
  return { view, document, frames, listeners };
}

interface ColorMixModule {
  mixColors(color: string, percent: number, mixColor?: string): string | undefined;
  observeColorMix(element: unknown, mixes?: Record<string, unknown> | null): () => void;
}

/** Evaluate already transformed code with only @ctrl/tinycolor resolved for real. */
function evaluate(code: string): ColorMixModule {
  const module = { exports: {} as Record<string, unknown> };
  const requireStub = (name: string): unknown => {
    if (name === '@ctrl/tinycolor') return require('@ctrl/tinycolor');
    throw new Error('Unstubbed module requested by real source: ' + name);
  };
  new Function('require', 'module', 'exports', code)(requireStub, module, module.exports);
  return module.exports as ColorMixModule;
}

/** Load the working tree module through the repo babel pipeline. */
function load(file: string): ColorMixModule {
  return evaluate(transformFileSync(path.resolve(__dirname, file)).code);
}

/**
 * Replay the pre-fix official module from git.
 * transformSync with an explicit js filename keeps the parse mode at javascript;
 * transformFileSync would resolve to the sibling .ts and hide the regression.
 * Only called when HAP_COLOR_MIX_BEFORE names a readable object, so a shallow clone
 * (which has no such commit) still runs this spec against the current behaviour.
 */
const OFFICIAL_PATH = 'src/utils/platform/theme/colorMix.js';
function loadOfficial(ref: string): ColorMixModule {
  const source = execFileSync('git', ['show', ref + ':' + OFFICIAL_PATH], { encoding: 'utf8' });
  return evaluate((transformSync(source, { filename: 'colorMix.js' }) as { code: string }).code);
}

const actual = load('colorMix.ts');

// ------------------------------------------------- pure mixColors (real TinyColor)
assert.equal(actual.mixColors('red', 50, 'blue'), 'rgb(128, 0, 128)', '50/50 red and blue are opaque');
assert.equal(actual.mixColors('#ff0000', 50, '#0000ff'), 'rgb(128, 0, 128)', 'hex input follows the same math');
assert.equal(actual.mixColors('rgba(255, 0, 0, 0.5)', 0, 'blue'), 'rgb(0, 0, 255)', 'weight 0 keeps only the mixed color, now opaque');
assert.equal(actual.mixColors('blue', 25, 'red'), 'rgb(191, 0, 64)', 'an uneven weight follows the same math');
assert.equal(actual.mixColors('not-a-color', 50, 'blue'), undefined, 'invalid color is rejected');
assert.equal(actual.mixColors('red', 150, 'blue'), undefined, 'percent above 100 is rejected');
assert.equal(actual.mixColors('red', Number.NaN, 'blue'), undefined, 'non finite percent is rejected');

// ---------------------------------------------- native support writes no styles
{
  const { view, document } = makeView({ supportsColorMix: true });
  const host = fakeElement('DIV');
  host.element.ownerDocument = document;
  document.defaultView = view;
  const cleanup = actual.observeColorMix(host.element, { '--x': { color: 'red', percent: 50, mixColor: 'blue' } });
  assert.equal(typeof cleanup, 'function', 'the native branch still returns a cleanup function');
  assert.equal(host.style.writes.length, 0, 'native color-mix support must not write any style');
  cleanup();
}

// ------------------------------- empty mixes also short-circuit without writes
{
  const { view, document } = makeView({ supportsColorMix: false });
  const host = fakeElement('DIV');
  host.element.ownerDocument = document;
  document.defaultView = view;
  const cleanup = actual.observeColorMix(host.element, {});
  assert.equal(host.style.writes.length, 0, 'no entries means no work');
  cleanup();
}

// ---------------------------------- fallback writes the mix and restores original
{
  const { view, document } = makeView({ supportsColorMix: false });
  const host = fakeElement('DIV');
  host.element.ownerDocument = document;
  document.defaultView = view;
  host.style.store.set('--x', { value: 'green', priority: 'important' });
  const cleanup = actual.observeColorMix(host.element, { '--x': { color: 'red', percent: 50, mixColor: 'blue' } });
  assert.equal(host.style.getPropertyValue('--x'), 'rgb(128, 0, 128)', 'the fallback writes the mixed color');
  assert.equal(host.style.getPropertyPriority('--x'), '', 'the mix is written without priority');
  cleanup();
  assert.equal(host.style.getPropertyValue('--x'), 'green', 'cleanup restores the original value');
  assert.equal(host.style.getPropertyPriority('--x'), 'important', 'cleanup restores the original priority');
}

// ----------------------------- loaded LINK schedules; null / look-alike must not
{
  const { view, document, frames, listeners } = makeView({ supportsColorMix: false });
  const host = fakeElement('DIV');
  host.element.ownerDocument = document;
  document.defaultView = view;
  const cleanup = actual.observeColorMix(host.element, { '--x': { color: 'red', percent: 50, mixColor: 'blue' } });
  const loadListeners = listeners.get('load') || [];
  assert.equal(loadListeners.length, 1, 'exactly one capture load listener is registered');
  const scheduled = frames.length;

  loadListeners.forEach(listener => listener({ target: null }));
  loadListeners.forEach(listener => listener({ target: { tagName: 'LINK' } }));
  assert.equal(frames.length, scheduled, 'null and non-Element targets must not schedule a frame');

  const link = fakeElement('LINK');
  assert.equal(link.element instanceof ElementCtor, true, 'the LINK fixture really is an Element instance');
  loadListeners.forEach(listener => listener({ target: link.element }));
  assert.equal(frames.length, scheduled + 1, 'a loaded LINK schedules exactly one frame');
  cleanup();
}

// ---- regression red: the pre-fix official handler has no Element guard at all.
//      Gated by HAP_COLOR_MIX_BEFORE because a shallow clone lacks that git object.
const BEFORE_REF = process.env['HAP_COLOR_MIX_BEFORE'];
if (BEFORE_REF) {
  const official = loadOfficial(BEFORE_REF);
  assert.equal(typeof official.mixColors, 'function', 'the official blob really loads');
  assert.equal(official.mixColors('red', 50, 'blue'), actual.mixColors('red', 50, 'blue'), 'the color math is unchanged by the guard');
  const { view, document, listeners } = makeView({ supportsColorMix: false });
  const host = fakeElement('DIV');
  host.element.ownerDocument = document;
  document.defaultView = view;
  const cleanup = official.observeColorMix(host.element, { '--x': { color: 'red', percent: 50, mixColor: 'blue' } });
  const officialLoad = listeners.get('load') || [];
  assert.equal(officialLoad.length, 1, 'the official source registers the same capture load listener');
  assert.throws(
    () => officialLoad.forEach(listener => listener({ target: null })),
    /null|undefined/i,
    'the unguarded official handler throws on a null target, which the Element guard fixes',
  );
  cleanup();
}

console.log('colorMix.spec: OK');