/** Execute actual save closure and the actual footer disabled expression; no live UI/SDK. */
import type { Node } from '@babel/types';
import type { SpecHarness } from '../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const t: typeof import('@babel/types') = require('@babel/types');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const lodash: typeof import('lodash') = require('lodash');
const moment: typeof import('moment') = require('moment');
const source = fs.readFileSync(path.join(__dirname, 'index.tsx'), 'utf8');
const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const found: Node[] = [];
function walk(node: Node): void {
  found.push(node);
  for (const key of t.VISITOR_KEYS[node.type] || []) {
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) { for (const child of value) if (t.isNode(child)) walk(child); }
    else if (t.isNode(value)) walk(value);
  }
}
walk(ast);
function slice(node: Node): string {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') throw new TypeError('missing actual source bounds');
  return source.slice(node.start, node.end);
}
const saveDeclarations = found.filter(node => t.isVariableDeclarator(node) && t.isIdentifier(node.id, { name: 'handleSettingStatus' }));
assert.equal(saveDeclarations.length, 1);
const saveNode = saveDeclarations[0]; assert.ok(saveNode);
const footer = found.filter(node => t.isJSXOpeningElement(node) && t.isJSXIdentifier(node.name, { name: 'Button' }) &&
  node.attributes.some(attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'className' }) && t.isStringLiteral(attr.value, { value: 'footerBtn bold' })));
assert.equal(footer.length, 1);
const disabledExpressions: Node[] = [];
for (const node of footer) if (t.isJSXOpeningElement(node)) for (const attr of node.attributes) {
  if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'disabled' }) &&
      t.isJSXExpressionContainer(attr.value) && !t.isJSXEmptyExpression(attr.value.expression)) disabledExpressions.push(attr.value.expression);
}
assert.equal(disabledExpressions.length, 1); const disabledNode = disabledExpressions[0]; assert.ok(disabledNode);
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
interface Context {
  isEdit: boolean;
  onStatusOption: Record<string, unknown>;
  statusList: Record<string, unknown>[];
  currentStatusId: unknown;
  initialOnStatusOption: Record<string, unknown>;
  updatedDateOption?: boolean;
  result?: boolean;
  withPendingRequest?: boolean;
}
async function execute(context: Context) {
  const alerts: unknown[][] = [], requests: Record<string, unknown>[] = [], patches: unknown[] = [], order: string[] = [];
  let refreshes = 0;
  const api = { setPersonalStatus: (params: unknown) => {
    assert.ok(record(params)); requests.push(params); order.push('request'); return Promise.resolve(context.result === undefined ? true : context.result);
  } };
  const names = ['_', 'moment', 'personalStyleApi', 'getStatus', 'alert', '_l', 'setData', 'isEdit', 'onStatusOption', 'statusList', 'currentStatusId', 'initialOnStatusOption', 'promise'];
  const code = harness.transformSync('const ' + slice(saveNode) + ';', { filename: 'actual-mobile-status-save.ts', sourceType: 'script' }).code;
  const factory = new Function(...names, code + '\nreturn handleSettingStatus;');
  const values = [lodash, moment, api, () => { refreshes++; order.push('refresh'); }, (...args: unknown[]) => { alerts.push(args); order.push('alert'); },
    (value: string) => value, (value: unknown) => { patches.push(value); order.push('patch'); }, context.isEdit, context.onStatusOption,
    context.statusList, context.currentStatusId, context.initialOnStatusOption,
    context.withPendingRequest ? { abort: () => { order.push('abort'); } } : null];
  const callback: unknown = Reflect.apply(factory, undefined, values);
  if (typeof callback !== 'function') throw new TypeError('actual save closure missing');
  Reflect.apply(callback, undefined, []);
  await Promise.resolve(); await Promise.resolve();
  const disabledCode = harness.transformSync('const disabled=(' + slice(disabledNode) + ');', { filename: 'actual-disabled.ts', sourceType: 'script' }).code;
  const disabled: unknown = Reflect.apply(new Function('_', 'currentStatusId', 'isEdit', 'onStatusOption', 'initialOnStatusOption', 'updatedDateOption', disabledCode + '\nreturn disabled;'), undefined,
    [lodash, context.currentStatusId, context.isEdit, context.onStatusOption, context.initialOnStatusOption, !!context.updatedDateOption]);
  return { alerts, requests, patches, order, refreshes, disabled };
}
const chosen = { statusId: 'c1', remark: 'Working', icon: 'work', durationOption: 10 };
const initial = { beginTime: 'initial-start', endTime: 'initial-end' };
const baseContext: Context = { isEdit: false, onStatusOption: {}, statusList: [chosen], currentStatusId: 'c1', initialOnStatusOption: initial };
const passed: string[] = [];
async function main(): Promise<void> {
  for (const [name, context] of [
    ['opaque-initial-id', { ...baseContext, statusList: [], currentStatusId: {}, withPendingRequest: true }],
    ['stale-id', { ...baseContext, currentStatusId: 'deleted' }],
    ['empty-status-list', { ...baseContext, statusList: [] }],
  ] satisfies Array<[string, Context]>) {
    const r = await execute(context); assert.equal(r.disabled, false, 'existing button condition does not ensure a matched option');
    assert.deepEqual(r.alerts, [['请选择状态', 3]]); assert.deepEqual(r.requests, []); assert.deepEqual(r.patches, []); assert.equal(r.refreshes, 0);
    assert.deepEqual(r.order, ['alert'], 'missing selection does not abort a previous request or write status'); passed.push(name);
  }
  const success = await execute(baseContext); assert.equal(success.requests.length, 1);
  assert.deepEqual(success.requests[0], { statusId: 'c1', beginTime: 'initial-start', endTime: 'initial-end', durationOption: 10, icon: 'work', remark: 'Working' });
  assert.equal(success.refreshes, 1); assert.deepEqual(success.alerts, [['设置完成']]); assert.deepEqual(success.patches, [{ visible: false, isEdit: true, updatedDateOption: false }]); passed.push('valid-selection');
  const edit = await execute({ ...baseContext, isEdit: true, onStatusOption: { ...chosen, remark: 'Edited' } });
  assert.equal(edit.requests[0]?.['remark'], 'Edited'); assert.deepEqual(edit.alerts, [['修改完成']]); passed.push('edit-selection');
  const emptyDraft = await execute({ ...baseContext, isEdit: true, onStatusOption: {} }); assert.deepEqual(emptyDraft.alerts, [['备注不能为空', 3]]); assert.deepEqual(emptyDraft.requests, []); passed.push('empty-edit-draft');
  const blank = await execute({ ...baseContext, statusList: [{ ...chosen, remark: '  ' }] }); assert.deepEqual(blank.alerts, [['备注不能为空', 3]]); assert.deepEqual(blank.requests, []); passed.push('blank-remark');
  const missingDate = await execute({ ...baseContext, statusList: [{ ...chosen, durationOption: 1000 }] }); assert.deepEqual(missingDate.alerts, [['请正确设置持续时间', 2]]); assert.deepEqual(missingDate.requests, []); passed.push('missing-custom-date');
  const expired = await execute({ ...baseContext, statusList: [{ ...chosen, durationOption: 1000, beginTime: '2000-01-01 00:00:00', endTime: '2000-01-02 00:00:00' }] }); assert.deepEqual(expired.alerts, [['请正确设置持续时间', 2]]); assert.deepEqual(expired.requests, []); passed.push('expired-custom-date');
  const future = await execute({ ...baseContext, statusList: [{ ...chosen, durationOption: 1000, beginTime: '9999-01-01 00:00:00', endTime: '9999-01-02 00:00:00' }] }); assert.equal(future.requests[0]?.['beginTime'], '9999-01-01 00:00:00'); assert.equal(future.requests[0]?.['endTime'], '9999-01-02 00:00:00'); passed.push('valid-custom-date');
  const failed = await execute({ ...baseContext, result: false }); assert.deepEqual(failed.alerts, [['设置失败', 2]]); assert.equal(failed.refreshes, 0); assert.deepEqual(failed.patches, []); passed.push('failed-sdk-result');
  const pending = await execute({ ...baseContext, withPendingRequest: true }); assert.deepEqual(pending.order.slice(0, 2), ['abort', 'request']); passed.push('valid-abort-order');
  assert.equal(passed.length, 12);
  console.log(JSON.stringify({ mobileStatusSaveCases: passed.length, cases: passed }));
  console.log('MobileMyStatus save regression passed: 12 actual-source save/button paths; missing selection, validation, request payload and callback effects');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
