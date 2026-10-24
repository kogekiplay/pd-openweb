import type { SpecHarness } from '../spec-harness';
const harness: SpecHarness = require('../spec-harness.ts');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
type Cleanup = () => void;
type Effect = () => Cleanup | void;
type Hook = { kind: 'ref'; current: unknown } | { kind: 'state'; value: unknown } |
  { kind: 'effect'; deps: readonly unknown[]; setup: Effect; cleanup: Cleanup | undefined; pending: boolean };
export interface LifecycleProps {
  data?: string;
  disabled?: boolean;
  registerRef?: (value: LifecycleEditor) => void;
}
interface NativeOptions { after(): void; }
export interface LifecycleEditor {
  value: string;
  destroyed: number;
  disabledCalls: number;
  enabledCalls: number;
  after(): void;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
/** Full product module; controlled native loading and a small hook scheduler expose pending-init races. */
function loadMarkdownLifecycle() {
  const hooks: Hook[] = [], editors: LifecycleEditor[] = [];
  const timers: Cleanup[] = [];
  let cursor = 0, replay = false;
  const fakeReact = {
    useRef(initial: unknown) {
      const index = cursor++;
      let slot = hooks[index];
      if (!slot) hooks[index] = slot = { kind: 'ref', current: initial };
      assert.equal(slot.kind, 'ref');
      return slot;
    },
    useState(initial: unknown) {
      const index = cursor++;
      let slot = hooks[index];
      if (!slot) hooks[index] = slot = { kind: 'state', value: initial };
      assert.ok(slot.kind === 'state');
      const state = slot;
      return [state.value, (value: unknown) => { state.value = value; }];
    },
    useEffect(setup: Effect, deps: readonly unknown[]) {
      const index = cursor++, previous = hooks[index];
      if (previous && previous.kind !== 'effect') throw new TypeError('Effect hook changed position');
      const effect = previous?.kind === 'effect' ? previous : undefined;
      if (!effect || replay || effect.deps.length !== deps.length || deps.some((value, i) => !Object.is(value, effect.deps[i]))) {
        hooks[index] = { kind: 'effect', deps, setup, cleanup: effect?.cleanup, pending: true };
      }
    },
  };
  class NativeEditor implements LifecycleEditor {
    value = '';
    destroyed = 0;
    disabledCalls = 0;
    enabledCalls = 0;
    vditor = { lute: { SetYamlFrontMatter() {}, SetIndentCodeBlock() {} } };
    private options: NativeOptions;
    constructor(_element: unknown, options: NativeOptions) { this.options = options; editors.push(this); }
    after() { this.options.after(); }
    setValue(value: string) { this.value = value; }
    getValue() { return this.value; }
    destroy() { this.destroyed++; }
    disabled() { this.disabledCalls++; }
    enable() { this.enabledCalls++; }
    insertValue(value: string) { this.value += value; }
  }
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  const source = path.join(harness.ROOT, 'src/ming-ui/components/MdMarkdown/index.tsx');
  const compiled = harness.transformFileSync(source, { plugins: ['@babel/plugin-transform-dynamic-import', '@babel/plugin-transform-modules-commonjs'] });
  assert.ok(compiled?.code);
  new Function('module', 'exports', 'require', 'window', '_l', 'setTimeout', compiled.code)(moduleLike, moduleLike.exports, (name: string): unknown => {
    if (name === 'react') return fakeReact;
    if (name === 'react/jsx-runtime' || name === 'styled-components' || name === 'prop-types' || name === 'lodash') return require(name);
    if (name === '@mdfe/vditor') return { __esModule: true, default: NativeEditor };
    if (name.endsWith('.css')) return {};
    if (name === 'src/utils/common' || name === 'src/utils/commonRequestBoundary' || name === 'src/utils/expression') return {};
    throw new Error('Unexpected lifecycle fixture dependency ' + name);
  }, { __customSubPath__: '' }, (value: string) => value, (callback: Cleanup) => { timers.push(callback); });
  const Subject = moduleLike.exports['default'];
  if (typeof Subject !== 'function') throw new TypeError('MdMarkdown module must export the actual component');
  const renderSubject = Subject;
  function attachRefs(tree: unknown): void {
    if (Array.isArray(tree)) { tree.forEach(attachRefs); return; }
    if (!object(tree) || !object(tree['props'])) return;
    const props = tree['props'], ref = props['ref'];
    if (object(ref)) ref['current'] = {};
    attachRefs(props['children']);
  }
  function render(props: LifecycleProps) {
    cursor = 0;
    attachRefs(renderSubject(props));
    for (const hook of hooks) if (hook.kind === 'effect' && hook.pending) {
      hook.cleanup?.();
      hook.cleanup = hook.setup() || undefined;
      hook.pending = false;
    }
  }
  function unmount() {
    for (const hook of hooks) if (hook.kind === 'effect') { hook.cleanup?.(); hook.cleanup = undefined; }
  }
  function replayEffects(props: LifecycleProps) { unmount(); replay = true; render(props); replay = false; }
  return { render, unmount, replayEffects, editors, timers, async flushLoading() { for (let i = 0; i < 10; i++) await Promise.resolve(); } };
}

export interface MarkdownLifecycleModule { loadMarkdownLifecycle: typeof loadMarkdownLifecycle; }
module.exports = { loadMarkdownLifecycle };
