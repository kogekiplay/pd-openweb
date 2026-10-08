const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
interface Row { entityId: string; size: number; createTime?: string; _isDraft?: boolean; app?: { appName: string } }
const row = (id: string, size = 10): Row => ({ entityId: id, size, createTime: '2026-10-08', app: { appName: id } });
const calls: Array<{ method: string; args: Record<string, unknown>; resolve: (value: unknown) => void; aborted: boolean }> = [];
const cleanups: Array<() => void> = [];
const api = new Proxy<Record<string, (args: Record<string, unknown>) => Promise<unknown> & { abort: () => void }>>({}, { get: (_target: unknown, method: string) => (args: Record<string, unknown>) => {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>(done => { resolve = done; });
  const call = { method, args, resolve, aborted: false }; calls.push(call);
  return Object.assign(promise, { abort: () => { call.aborted = true; } });
} });
const cache = new Map<string, Record<string, unknown>>();
function load<T>(relative: string): T {
  const filename = path.resolve(root, relative); const prior = cache.get(filename); if (prior) return prior as T;
  const mod: { exports: Record<string, unknown> } = { exports: {} }; cache.set(filename, mod.exports);
  const { code } = transformFileSync(filename, { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  function localRequire(request: string): unknown {
    if (request === 'react') return { useRef: (current: unknown) => ({ current }), useMemo: (create: () => unknown) => create(), useEffect: (effect: () => void | (() => void)) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } };
    if (request === 'ming-ui/functions') return { dialogSelectApp: () => {}, dialogSelectWorksheet: () => {} };
    if (request === '../components/QuickLimitSetting') return { __esModule: true, default: () => null };
    if (request === 'src/utils/services/request/error') return { alertIfNotUnauthorized: () => {} };
    if (request.includes('/api/') || request.includes('/apiV2/') || request.startsWith('src/api/')) return { __esModule: true, default: api };
    if (request.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), request)) + (request.endsWith('useQuotaActions') ? '.tsx' : '.ts'));
    return require(request);
  }
  const translate = (text: string, ...values: unknown[]) => values.reduce<string>((value, item, index) => value.replaceAll(`%${index}`, String(item)), text);
  new Function('module', 'exports', 'require', '_l', 'md', 'window', 'alert', code)(mod, mod.exports, localRequire, translate, { global: { SysSettings: {}, Account: {} } }, { platformENV: {} }, () => {});
  cache.set(filename, mod.exports); return mod.exports as T;
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function main(): Promise<void> {
  const utils = load<{ getNextSelectedIds: (value: unknown) => string[]; updateSelectedLimitSize: (rows: Row[], ids: string[], size: number) => Row[]; getPersistedLimitCount: (rows: Row[]) => number; getAddDraftLimitsPatch: (value: unknown) => { limits: Row[]; total: number }; getRemovedPersistedLimitCount: (rows: Row[], ids: string[]) => number; getResettableLimits: (rows: Row[]) => Row[]; getLimitParams: (value: unknown) => { adds: Row[]; edits: Row[]; dels: Row[] }; getLimitResultPatch: (value: unknown) => { limits: Row[]; initialLimits: Row[]; selectedIds: string[] }; getCancelPatch: (value: unknown) => { size: number; limits: Row[]; total: number }; getLimitListRequestParams: (value: unknown) => Record<string, unknown>; shouldApplyLimitResult: (value: unknown) => boolean }>('src/pages/Admin/app/quota/utils.ts');
  const original = [row('a'), row('b'), row('c')];
  assert.deepEqual(utils.getNextSelectedIds({ limits: original, selectedIds: ['a'], entityId: 'c', lastSelectedId: 'a', shiftKey: true }), ['a', 'b', 'c']);
  assert.deepEqual(utils.getNextSelectedIds({ limits: original, selectedIds: ['a', 'b', 'c'], entityId: 'b', lastSelectedId: 'c', shiftKey: true }), ['a']);
  const edited = utils.updateSelectedLimitSize(original, ['b'], 20); assert.equal(original[1]?.size, 10); assert.equal(edited[1]?.size, 20); assert.equal(edited[0], original[0]);
  const patch = utils.getAddDraftLimitsPatch({ limits: original, addedLimits: [row('draft')], total: 7 });
  assert.equal(patch.total, 7); assert.equal(patch.limits[0]?._isDraft, true); assert.equal(utils.getPersistedLimitCount(patch.limits), 3);
  assert.equal(utils.getRemovedPersistedLimitCount(patch.limits, ['a', 'draft']), 1);
  assert.deepEqual(utils.getResettableLimits([row('a'), { ...row('draft'), _isDraft: true }, { entityId: 'deleted', size: 1, createTime: 'now' }]).map(item => item.entityId), ['a']);
  assert.deepEqual(utils.getLimitParams({ initialLimits: [row('a'), row('b')], limits: [{ ...row('a'), size: 20 }, row('new')] }), { adds: [{ entityId: 'new', size: 10 }], edits: [{ entityId: 'a', size: 20 }], dels: [{ entityId: 'b', size: 10 }] });
  const appended = utils.getLimitResultPatch({ append: true, list: [row('a'), row('next')], total: 8, previous: { limits: patch.limits, initialLimits: original, selectedIds: ['draft'] } });
  assert.equal(appended.limits.length, 5); assert.deepEqual(appended.selectedIds, ['draft']); assert.equal(appended.initialLimits.some(item => item._isDraft), false);
  const canceled = utils.getCancelPatch({ initialLimits: original, initialSize: -1, initialTotal: 7 }); assert.equal(canceled.size, -1); assert.equal(canceled.total, 7); assert.deepEqual(canceled.limits, original);
  assert.equal(utils.getLimitListRequestParams({ projectId: 'p', businessType: 3, pageIndex: 1, entityIds: [], sortField: 'size', sortType: 1 })['sortType'], 3);
  assert.deepEqual(utils.getLimitListRequestParams({ projectId: 'p', businessType: 4, pageIndex: 1, entityIds: [], sortField: 'createTime', sortType: 1 })['sorter'], { createTime: 'ascend' });
  assert.equal(utils.shouldApplyLimitResult({ requestId: 1, latestRequestId: 2 }), false);

  const actionHook = load<{ default: (props: Record<string, unknown>) => { confirmReset: () => void } }>('src/pages/Admin/app/quota/hooks/useQuotaActions.tsx').default;
  let state: Record<string, unknown> = { limits: original, resetRows: [row('a'), { ...row('draft'), _isDraft: true }], selectedIds: ['a', 'draft'], resetVisible: true, resetLoading: false };
  const setState = (patch: Record<string, unknown>) => { Object.assign(state, patch); };
  const actions = actionHook({ projectId: 'p', businessType: 3, globalUnit: 'GB', state, setState, loadLimits: () => Promise.resolve(), loadAppList: () => {} });
  actions.confirmReset(); actions.confirmReset(); assert.equal(calls.length, 1, 'a second reset click must reuse the active request lock');
  assert.equal(calls[0]?.method, 'resetUsage'); assert.deepEqual(calls[0]?.args, { projectId: 'p', appIds: ['a'] });
  calls[0]?.resolve(false); await tick(); assert.deepEqual(state['selectedIds'], ['a', 'draft']); assert.equal(state['resetVisible'], true); assert.equal(state['resetLoading'], false);
  state = { limits: original, resetRows: [row('a')], selectedIds: ['a'], resetVisible: true, resetLoading: false };
  actionHook({ projectId: 'p', businessType: 4, globalUnit: '千次', state, setState, loadLimits: () => Promise.resolve(), loadAppList: () => {} }).confirmReset();
  assert.equal(calls[1]?.method, 'resetUageLimit'); assert.deepEqual(calls[1]?.args, { projectId: 'p', entityIds: ['a'] }); calls[1]?.resolve(true); await tick(); assert.deepEqual(state['selectedIds'], []);

  calls.length = 0; let updated = 0;
  state = { limits: [row('a', 20)], initialLimits: [row('a', 10)], size: -1, initialSize: -1, loading: false, total: 1 };
  const save = load<{ default: (props: Record<string, unknown>) => () => void }>('src/pages/Admin/app/quota/hooks/useQuotaSave.ts').default({ projectId: 'p', businessType: 3, state, setState, updateData: () => { updated++; }, loadLimits: () => Promise.resolve() });
  save(); save(); assert.equal(calls.length, 2); assert.equal(calls[0]?.aborted, true);
  calls[0]?.resolve(true); await tick(); assert.equal(updated, 0); assert.equal(state['saveLoading'], true, 'a late canceled save must not release the latest save state');
  calls[1]?.resolve(true); await tick(); assert.equal(updated, 1); assert.equal(state['saveLoading'], false);
  cleanups.forEach(cleanup => cleanup());
  console.log('quota: shift selection, draft counts, add/edit/delete payload, paging, cancel, stale-result isolation and both batch reset/save protocols passed');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
