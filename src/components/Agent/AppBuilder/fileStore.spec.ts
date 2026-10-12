import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
Reflect.set(globalThis, '_l', (text: string) => text);
harness.installRequireHook();

interface FileStoreModule {
  initialFileStore: () => {
    files: Record<string, unknown>;
    pathOrder: string[];
    focus: string | null;
    generationId?: string | number;
  };
  decodeFileEvent: (topic: string, payload: unknown) => unknown;
  reduceFileEvent: (state: any, event: any) => any;
  sidebarItemsOf: (state: any) => Array<{ key: string; count?: number; streaming?: boolean }>;
}
const store = require('./fileStore.ts') as FileStoreModule;

const initial = store.initialFileStore();
assert.ok(initial.files['/plan.md']);
assert.equal(store.decodeFileEvent('file:delta', { path: '/missing', delta: 'x' }), null);
assert.equal(store.decodeFileEvent('file:delta', { path: '/plan.md', delta: 3 }), null);

let state = store.reduceFileEvent(initial, { topic: 'file:begin', path: '/jsons/roles.json' });
assert.equal(state.focus, '/jsons/roles.json');
state = store.reduceFileEvent(state, {
  topic: 'file:delta',
  path: '/jsons/roles.json',
  delta: '{"roles":[{"name":"管理员"}]}',
});
assert.equal(state.files['/jsons/roles.json'].status, 'streaming');
assert.ok(Array.isArray(state.files['/jsons/roles.json'].parsed));
state = store.reduceFileEvent(state, { topic: 'file:end', path: '/jsons/roles.json' });
assert.equal(state.files['/jsons/roles.json'].status, 'ready');
assert.deepEqual(
  store.sidebarItemsOf(state).map(item => item.key),
  ['roles'],
);

state = store.reduceFileEvent(state, { topic: 'file:begin', path: '/jsons/app.json' });
state = store.reduceFileEvent(state, {
  topic: 'file:delta',
  path: '/jsons/app.json',
  delta: '{"planGenerationId":"one","appName":"旧"}',
});
state = store.reduceFileEvent(state, { topic: 'file:begin', path: '/plan.md' });
assert.ok(state.pathOrder.includes('/plan.md'));
state = store.reduceFileEvent(state, { topic: 'file:begin', path: '/jsons/app.json' });
state = store.reduceFileEvent(state, {
  topic: 'file:delta',
  path: '/jsons/app.json',
  delta: '{"planGenerationId":"two"}',
});
assert.deepEqual(state.pathOrder, ['/jsons/app.json'], 'A new plan generation clears stale tabs but keeps metadata');
assert.equal(state.focus, null);

state = store.reduceFileEvent(state, {
  topic: 'file:write',
  path: '/jsons/custom-actions.json',
  content: '{"customActions":[{"actions":[{},{}]}]}',
});
assert.equal(store.sidebarItemsOf(state).find(item => item.key === 'customActions')?.count, 2);
console.log('AppBuilder file registry/store boundaries passed');
