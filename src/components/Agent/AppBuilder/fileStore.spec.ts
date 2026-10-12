import type { SpecHarness } from '../../../../scripts/spec-harness';
import type { FileEntry, FileMap, FileState } from './fileTypes';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
Reflect.set(globalThis, '_l', (text: string) => text);
harness.installRequireHook();
const root = path.resolve(__dirname, '../../../..');
const before = process.env['BUILDER_FILES_BEFORE_REV'];
type FileTopic = 'file:begin' | 'file:delta' | 'file:end' | 'file:write' | 'file:focus';
type FileEvent =
  | { topic: 'file:begin' | 'file:end' | 'file:focus'; path: string }
  | { topic: 'file:delta'; path: string; delta: string }
  | { topic: 'file:write'; path: string; content: string };
interface FileStoreState {
  files: FileMap;
  focus: string | null;
  pathOrder: string[];
  generationId: string | number | undefined;
  metaBuffer: string;
  regenFired: boolean;
}
interface FileStoreModule {
  initialFileStore(): FileStoreState;
  decodeFileEvent(topic: FileTopic, payload: unknown): FileEvent | null;
  reduceFileEvent(state: FileStoreState, event: FileEvent): FileStoreState;
  reduceFileStore(
    state: FileStoreState,
    event: FileEvent | { topic: 'focus'; value: string | null | ((previous: string | null) => string | null) },
  ): FileStoreState;
  sidebarItemsOf(state: FileStoreState): Array<{ key: string; count?: number; streaming?: boolean }>;
  readGenerationId(content: string): string | number | undefined;
}
interface RegistryModule {
  makeInitialFiles(): FileMap;
  parseFile(entry: FileEntry | undefined, content: string): unknown;
  serializeFile(entry: FileEntry | undefined, parsed: unknown): string;
  entryByPath(path: string): FileEntry | undefined;
  entryByKey(key: string): FileEntry | undefined;
}
const store: FileStoreModule = require('./fileStore.ts');
const registry: RegistryModule = require('./fileRegistry.ts');
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function invoke(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  if (typeof fn !== 'function') throw new TypeError('Missing observed callable');
  return Reflect.apply(fn, receiver, args);
}
function file(state: FileStoreState, name: string): FileState {
  const found = state.files[name];
  assert.ok(found);
  return found;
}
function emit(
  state: FileStoreState,
  topic: FileTopic,
  path: string,
  fields: Record<string, unknown> = {},
): FileStoreState {
  const event = store.decodeFileEvent(topic, { path, ...fields });
  assert.ok(event);
  return store.reduceFileEvent(state, event);
}
function historicalRegistry(revision: string): RegistryModule {
  const source = execFileSync('git', ['show', `${revision}:src/components/Agent/AppBuilder/fileRegistry.ts`], {
    cwd: root,
    encoding: 'utf8',
  });
  const result = harness.transformSync(source, {
    filename: 'fileRegistry.ts',
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  assert.ok(result?.code);
  const target: { exports: RegistryModule | Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', result.code)(target, target.exports, require);
  return target.exports as RegistryModule;
}
function hookFixture() {
  const slots: unknown[] = [];
  let cursor = 0,
    dirty = false;
  const events = new Map<string, (payload: unknown) => unknown>();
  const synchronized: unknown[] = [];
  const effects: Array<() => unknown> = [];
  const React = {
    useReducer(reducer: unknown, argument: unknown, initialize: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = invoke(undefined, initialize, argument);
      return [
        slots[index],
        (action: unknown) => {
          slots[index] = invoke(undefined, reducer, slots[index], action);
          dirty = true;
        },
      ];
    },
    useCallback(fn: unknown) {
      cursor++;
      return fn;
    },
    useEffect(fn: () => unknown) {
      cursor++;
      effects.push(fn);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, 'useFileStore.ts'), 'utf8');
  const result = harness.transformSync(source, {
    filename: 'useFileStore.ts',
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  assert.ok(result?.code);
  const target: { exports: Record<string, unknown> } = { exports: {} };
  function imports(request: string): unknown {
    if (request === 'react') return React;
    if (request === './fileStore') return store;
    if (request === '../agentBus')
      return {
        useAgentBus: () => ({ emit: (_topic: string, payload: unknown) => synchronized.push(payload) }),
        useAgentEvent: (topic: string, handler: (payload: unknown) => unknown) => events.set(topic, handler),
      };
    return require(request);
  }
  new Function('module', 'exports', 'require', result.code)(target, target.exports, imports);
  function render(): Record<string, unknown> {
    cursor = 0;
    effects.length = 0;
    const value = invoke(undefined, target.exports['useFileStore']);
    assert.ok(object(value));
    for (const effect of effects) effect();
    dirty = false;
    return value;
  }
  let latest = render();
  return {
    emit(topic: string, payload: unknown) {
      invoke(undefined, events.get(topic), payload);
      if (dirty) latest = render();
      return latest;
    },
    latest: () => latest,
    synchronized: () => synchronized,
  };
}
function publicContracts() {
  const directory = fs.mkdtempSync(path.join(root, 'node_modules/.cache/builder-file-contract-'));
  try {
    const source = path.join(directory, 'contract.ts'),
      config = path.join(directory, 'tsconfig.json');
    fs.writeFileSync(
      source,
      `import {useFileStore} from '${root}/src/components/Agent/AppBuilder/useFileStore';
import {decodeFileEvent} from '${root}/src/components/Agent/AppBuilder/fileStore';
import type {FileStoreState} from '${root}/src/components/Agent/AppBuilder/fileStore';
import type {FileState,SidebarItem} from '${root}/src/components/Agent/AppBuilder/fileTypes';
export function contracts(state:FileStoreState,value:ReturnType<typeof useFileStore>){
const file:FileState|undefined=value.files['/plan.md']; const item:SidebarItem|undefined=value.sidebarItems[0];void file;void item;
value.setFocus(null);value.setFocus(previous=>previous||'/plan.md');
const event=decodeFileEvent('file:delta',{path:'/plan.md',delta:'x'});if(event?.topic==='file:delta'){const text:string=event.delta;void text;}
// @ts-expect-error JSON fields require runtime validation.
value.files['/jsons/app.json']?.parsed.appName;
// @ts-expect-error Unknown file status is not a producer value.
state.files['/plan.md']={content:'x',parsed:'x',status:'complete'};
// @ts-expect-error Focus is a file path or null.
value.setFocus(3);
// @ts-expect-error Sidebar keys are finite.
const invalid:SidebarItem['key']='billing';void invalid;
}
`,
    );
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [source, path.join(root, 'types/global.d.ts')],
        exclude: [],
      }),
    );
    execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', config, '--pretty', 'false'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const initial = store.initialFileStore();
assert.equal(Object.keys(initial.files).length, 8);
const isolated = registry.makeInitialFiles();
assert.notEqual(initial.files['/jsons/roles.json']?.parsed, isolated['/jsons/roles.json']?.parsed);
for (const payload of [null, [], 'bad', { path: '/missing', delta: 'x' }, { path: 1 }, { path: '/plan.md', delta: 3 }])
  assert.equal(store.decodeFileEvent('file:delta', payload), null);
assert.deepEqual(store.decodeFileEvent('file:write', { path: '/plan.md', content: null }), {
  topic: 'file:write',
  path: '/plan.md',
  content: '',
});
assert.deepEqual(store.decodeFileEvent('file:delta', { path: '/plan.md' }), {
  topic: 'file:delta',
  path: '/plan.md',
  delta: '',
});
assert.equal(store.reduceFileEvent(initial, { topic: 'file:begin', path: '/missing' }), initial);
assert.equal(store.reduceFileStore(initial, { topic: 'focus', value: '/missing' }), initial);

const cases = [
  ['/plan.md', '# Overview\n\nContent'],
  ['/jsons/roles.json', '[{"name":"管理员"}]'],
  ['/jsons/roles.json', '{"ignored":[1],"roles":[{"name":"管理员"}]}'],
  ['/jsons/roles.json', '{"items":[{"name":"成员"}]}'],
  ['/jsons/roles.json', '{"roles":[{"name":"半截'],
  ['/jsons/app.json', '{"appName":"应用","navGroups":[{"name":"Group"}]}'],
  ['/jsons/worksheets.json', 'null'],
] as const;
const old = before ? historicalRegistry(before) : undefined;
for (const [name, content] of cases) {
  const parsed = registry.parseFile(registry.entryByPath(name), content);
  if (old) assert.deepEqual(parsed, old.parseFile(old.entryByPath(name), content));
}
assert.throws(() => registry.parseFile(undefined, '{}'), /unknown file/);
assert.equal(registry.serializeFile(registry.entryByKey('overview'), { wrong: true }), '');

let state = emit(initial, 'file:begin', '/jsons/roles.json');
assert.equal(state.focus, '/jsons/roles.json');
assert.equal(store.sidebarItemsOf(state)[0]?.streaming, true);
state = emit(state, 'file:delta', '/jsons/roles.json', { delta: '{"roles":[' });
state = emit(state, 'file:delta', '/jsons/roles.json', { delta: '{"name":"管理员"}]}' });
assert.deepEqual(file(state, '/jsons/roles.json').parsed, [{ name: '管理员' }]);
state = emit(state, 'file:end', '/jsons/roles.json');
assert.equal(file(state, '/jsons/roles.json').status, 'ready');
assert.deepEqual(
  store.sidebarItemsOf(state).map(item => item.key),
  ['roles'],
);
state = emit(state, 'file:write', '/plan.md', { content: 'History plan' });
assert.deepEqual(
  store.sidebarItemsOf(state).map(item => item.key),
  ['roles', 'overview'],
);
state = emit(state, 'file:write', '/jsons/app.json', { content: '{"planGenerationId":"one","appName":"旧"}' });
assert.deepEqual(
  store.sidebarItemsOf(state).map(item => item.key),
  ['roles', 'overview'],
);
const original = state;
state = emit(state, 'file:begin', '/jsons/app.json');
state = emit(state, 'file:delta', '/jsons/app.json', { delta: '{"planGenerationId":"o' });
assert.ok(state.pathOrder.includes('/plan.md'), 'An unfinished string cannot trigger regeneration');
state = emit(state, 'file:delta', '/jsons/app.json', { delta: 'ne","appName":"相同"}' });
assert.equal(state.generationId, 'one');
assert.ok(state.pathOrder.includes('/plan.md'));
state = emit(state, 'file:begin', '/jsons/app.json');
state = emit(state, 'file:delta', '/jsons/app.json', { delta: '{"planGenerationId":"two"' });
assert.deepEqual(state.pathOrder, ['/jsons/app.json']);
assert.equal(state.focus, null);
assert.deepEqual(file(state, '/jsons/roles.json').parsed, []);
assert.deepEqual(file(original, '/jsons/roles.json').parsed, [{ name: '管理员' }], 'Earlier snapshots remain intact');
state = emit(state, 'file:write', '/jsons/custom-actions.json', {
  content: '{"customActions":[null,{"actions":[{},{}]},{"actions":3}]}',
});
assert.equal(store.sidebarItemsOf(state).find(item => item.key === 'customActions')?.count, 2);
state = emit(state, 'file:delta', '/jsons/app.json', { delta: ',"appName":"新","navGroups":[]}' });
assert.equal(
  store.sidebarItemsOf(state).find(item => item.key === 'customActions')?.count,
  2,
  'Later chunks do not reset newly received files again',
);
assert.equal(file(state, '/jsons/app.json').content, '{"planGenerationId":"two","appName":"新","navGroups":[]}');
state = emit(state, 'file:write', '/jsons/app.json', { content: '{"planGenerationId":"history"}' });
assert.ok(state.pathOrder.includes('/jsons/custom-actions.json'), 'History loads never trigger streaming regeneration');
state = emit(state, 'file:begin', '/jsons/roles.json');
state = emit(state, 'file:delta', '/jsons/roles.json', { delta: 'false' });
assert.equal(file(state, '/jsons/roles.json').parsed, false, 'Falsy JSON must replace the prior value');
state = store.reduceFileStore(state, { topic: 'focus', value: () => '/plan.md' });
assert.equal(state.focus, '/plan.md');

for (const [content, expected] of [
  ['{"planGenerationId":"unclosed', undefined],
  ['{"nested":{"planGenerationId":"wrong"},"planGenerationId":"right"}', 'right'],
  ['{"appName":"planGenerationId","planGenerationId":"right"}', 'right'],
  ['{"appName":"planGenerationId"}', undefined],
  ['{"planGenerationId":12', undefined],
  ['{"planGenerationId":12e', undefined],
  ['{"planGenerationId":12e2}', 1200],
  ['{"planGenerationId":0}', 0],
  [JSON.stringify({ memo: '{"planGenerationId":1}', planGenerationId: 'escaped"id' }), 'escaped"id'],
] as const)
  assert.equal(store.readGenerationId(content), expected, content);

const hook = hookFixture();
hook.emit('file:write', { path: '/jsons/roles.json', content: '{"roles":[{}]}' });
hook.emit('file:begin', { path: '/plan.md' });
hook.emit('file:delta', { path: '/plan.md', delta: '# One' });
hook.emit('file:delta', { path: '/plan.md', delta: '\nTwo' });
hook.emit('file:end', { path: '/plan.md' });
hook.emit('file:focus', { path: '/plan.md' });
const latest = hook.latest();
assert.equal(latest['focus'], '/plan.md');
const files = latest['files'];
assert.ok(object(files));
const markdown = files['/plan.md'];
assert.ok(object(markdown));
assert.equal(markdown['content'], '# One\nTwo');
assert.equal(markdown['status'], 'ready');
assert.ok(hook.synchronized().length > 1);
const synchronized = hook.synchronized().at(-1);
assert.ok(object(synchronized));
assert.equal(synchronized['files'], files);
const snapshots = hook.synchronized().length;
hook.emit('file:delta', { path: '/unknown', delta: 'x' });
assert.equal(hook.synchronized().length, snapshots);
publicContracts();
console.log(
  JSON.stringify({
    registryHistoricalCases: cases.length,
    historicalAB: !!old,
    streamedChunks: true,
    metadataOwnership: true,
    regenerationFragments: true,
    historyBaseline: true,
    numericAndEscapedIds: true,
    typedPayloads: true,
    customActionsCount: true,
    actualHookAndBusBinding: true,
  }),
);
