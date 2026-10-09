const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
interface ObservedStoreValue {
  store: Record<string, unknown>;
  setValue: (key: string, value: unknown) => void;
}
interface StoreModule {
  GlobalStoreProvider: (props: { children: unknown }) => { props: { value: ObservedStoreValue } };
  useGlobalStore: (options?: { optional: true }) => ObservedStoreValue | undefined;
}
const source = transformFileSync(path.join(__dirname, 'GlobalStore.tsx')).code;
const emitter = new EventEmitter();
function load(react: unknown): StoreModule {
  const module = { exports: {} };
  const imports: Record<string, unknown> = {
    react,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'src/utils/common': { emitter },
  };
  return new Function('module', 'exports', 'require', `${source}\nreturn module.exports;`)(
    module,
    module.exports,
    (name: string) => {
      if (!(name in imports)) throw new Error(`Unstubbed import ${name}`);
      return imports[name];
    },
  );
}

const realStore = load(React);
function RequiredReader() {
  const value = realStore.useGlobalStore();
  assert.ok(value);
  return React.createElement('span', null, JSON.stringify(value.store));
}
function OptionalReader() {
  return React.createElement('span', null, String(realStore.useGlobalStore({ optional: true })));
}
assert.throws(
  () => renderToStaticMarkup(React.createElement(RequiredReader)),
  /GlobalStoreProvider is required/,
  'A required consumer outside the provider must fail clearly',
);
assert.equal(renderToStaticMarkup(React.createElement(OptionalReader)), '<span>undefined</span>');
assert.equal(
  renderToStaticMarkup(React.createElement(realStore.GlobalStoreProvider, null, React.createElement(RequiredReader))),
  '<span>{}</span>',
  'Real React consumers receive the initial finite store from their provider',
);

// Controlled hooks observe the actual provider's queued updates and effect cleanup.
let state: ObservedStoreValue['store'] | undefined;
let cleanup: (() => void) | undefined;
let mounted = false;
const controlledStore = load({
  ...React,
  useState: (initial: ObservedStoreValue['store']) => {
    if (!state) state = initial;
    return [
      state,
      (update: (previous: ObservedStoreValue['store']) => ObservedStoreValue['store']) => {
        state = update(state || {});
      },
    ];
  },
  useEffect: (effect: () => () => void) => {
    if (!mounted) {
      cleanup = effect();
      mounted = true;
    }
  },
});
function renderProvider(): ObservedStoreValue {
  return controlledStore.GlobalStoreProvider({ children: null }).props.value;
}
assert.deepEqual(renderProvider().store, {});
assert.equal(emitter.listenerCount('UPDATE_GLOBAL_STORE'), 1);
emitter.emit('UPDATE_GLOBAL_STORE', 'mingoCreateWorksheetAction', true);
emitter.emit('UPDATE_GLOBAL_STORE', 'mingoIsCreatingWorksheetStatus', 1);
assert.deepEqual(renderProvider().store, { mingoCreateWorksheetAction: true, mingoIsCreatingWorksheetStatus: 1 });
const command = {
  action: 'createFromEmpty',
  worksheetInfo: { appId: 'app', projectId: 'project', worksheetId: 'worksheet', name: 'Tasks' },
};
emitter.emit('UPDATE_GLOBAL_STORE', 'mingoCreateWorksheetAction', command);
assert.equal(renderProvider().store.mingoCreateWorksheetAction, command, 'Command object references stay intact');
renderProvider().setValue('mingoIsCreatingWorksheetStatus', 2);
emitter.emit('UPDATE_GLOBAL_STORE', 'activeWorksheet');
assert.equal(renderProvider().store.mingoIsCreatingWorksheetStatus, 2);
assert.equal(renderProvider().store.activeWorksheet, undefined);
cleanup?.();
assert.equal(emitter.listenerCount('UPDATE_GLOBAL_STORE'), 0, 'Unmount removes the original subscribed callback');
const lastState = renderProvider().store;
emitter.emit('UPDATE_GLOBAL_STORE', 'mingoIsCreatingWorksheetStatus', false);
assert.equal(renderProvider().store, lastState, 'Unmounted providers receive no further event updates');
console.log(
  'Global store: real React context, required/optional consumers, state updates and listener cleanup passed.',
);
