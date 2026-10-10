const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const parser = require('@babel/parser');
const { transformFileSync, transformSync } = require('../../scripts/spec-harness.ts');
interface Member {
  account?: string;
  fullname?: string;
  email?: string;
  mobilePhone?: string;
  user?: number | string;
  [extra: string]: unknown;
}
interface HintResult {
  accountInfos: Member[];
  existAccountInfos: Member[];
}
interface AlertCall {
  content: unknown;
  type?: number;
}
const calls: AlertCall[] = [];
const rendered: unknown[] = [];
let mobile = false;
function load(file: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const target: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', ...Object.keys(globals), transformFileSync(file).code)(
    target,
    target.exports,
    (name: string) => {
      if (name in imports) return imports[name];
      throw new Error('Unstubbed invitation dependency: ' + name);
    },
    ...Object.values(globals),
  );
  return target.exports;
}
const message = Object.fromEntries(
  ['success', 'error', 'warning', 'info', 'loading'].map(kind => [kind, (options: unknown) => rendered.push(options)]),
);
const alertModule = load(path.resolve(__dirname, '../ming-ui/functions/alert/index.tsx'), {
  react: require('react'),
  'react/jsx-runtime': require('react/jsx-runtime'),
  antd: { message },
  'antd-mobile': { Toast: { show: (options: unknown) => rendered.push(options) } },
  'src/utils/common': { browserIsMobile: () => mobile },
});
const actualAlert = alertModule.antAlert as (message: unknown, type?: number) => unknown;
const boundary = load(path.join(__dirname, 'inviteBoundary.ts'), {});
const helper = load(
  path.join(__dirname, 'inviteCommon.ts'),
  { './inviteBoundary': boundary },
  {
    _l: (text: string) => text,
    alert: (content: unknown, type?: number) => {
      calls.push({ content, type });
      actualAlert(content, type);
    },
  },
).existAccountHint as (response: unknown) => HintResult | undefined;
const successful: Member = { account: 'new@example.com', accountId: 'new-id', metadata: { extra: 1 } };
const existing: Member = { fullname: 'Existing', email: 'existing@example.com', mobilePhone: '123', user: 3 };
const limited = { account: 'limited@example.com' };
const failed = { fullname: 'Failed', user: '2' };
const forbidden = { fullname: 'Forbidden', user: 4 };
const response = {
  sendMessageResult: 1,
  results: [
    { accountInfos: [successful], existAccountInfos: [existing], limitAccountInfos: [limited] },
    { failedAccountInfos: [failed], forbidAccountInfos: [forbidden] },
  ],
};
const result = helper(response);
assert.deepEqual(result, { accountInfos: [successful], existAccountInfos: [existing] });
assert.equal(result?.accountInfos[0], successful, 'returned member and unknown metadata identities are preserved');
assert.equal(result?.existAccountInfos[0], existing);
assert.equal(calls.at(-1)?.type, 3);
const content = calls.at(-1)?.content;
assert.equal(typeof content, 'string');
if (typeof content === 'string') {
  for (const expected of [
    '以下用户邀请成功',
    '以下用户已存在，不能重复邀请',
    '以下用户超过邀请数量限制，无法邀请',
    '以下用户邀请失败',
    '以下用户账号来源类型受限',
    'Existing：existing@example.com / 123（待审批）',
    'Failed：（被拒绝加入，需从后台恢复权限）',
    'Forbidden：（被暂停权限，需从后台恢复权限）',
  ])
    assert.ok(content.includes(expected), expected);
  assert.ok(content.indexOf('以下用户邀请成功') < content.indexOf('以下用户已存在'));
  assert.ok(content.indexOf('以下用户超过邀请数量限制') < content.indexOf('以下用户邀请失败'));
}
for (const value of [
  { sendMessageResult: 1 },
  { sendMessageResult: 2, results: null },
  { results: [] },
  { results: [{ accountInfos: null, existAccountInfos: undefined }] },
]) {
  assert.deepEqual(helper(value), { accountInfos: [], existAccountInfos: [] });
  assert.deepEqual(calls.at(-1), { content: '邀请成功', type: undefined });
}
const statusFailure = helper({ sendMessageResult: 0, results: { invalid: true } });
assert.equal(statusFailure, undefined);
assert.deepEqual(calls.at(-1), { content: '邀请失败', type: 2 });
for (const value of [
  undefined,
  null,
  {},
  [],
  1,
  { results: null },
  { sendMessageResult: '1' },
  { sendMessageResult: 99 },
  { results: {} },
  { results: [null] },
  { results: [false] },
  { results: [{ accountInfos: {} }] },
  { results: [{ accountInfos: [null] }] },
  { results: [{ existAccountInfos: ['invalid member'] }] },
  { results: [{ failedAccountInfos: [{ fullname: {} }] }] },
  { results: [{ forbidAccountInfos: [{ user: {} }] }] },
  { results: [{ limitAccountInfos: [{ email: false }] }] },
]) {
  const alertCount = calls.length;
  assert.equal(helper(value), undefined);
  assert.equal(calls.length, alertCount + 1, 'bad response reports a single completed failure');
  assert.deepEqual(calls.at(-1), { content: '邀请失败', type: 2 });
}
assert.deepEqual(
  helper({
    results: [{ accountInfos: [{ account: 'a' }, { account: 'b' }] }, { accountInfos: [{ account: 'c' }] }],
  })?.accountInfos.map(member => member.account),
  ['a', 'b', 'c'],
);
helper({ results: [{ failedAccountInfos: [{}] }] });
assert.equal(typeof calls.at(-1)?.content, 'string');
assert.ok(
  String(calls.at(-1)?.content).includes('undefined'),
  'absent display fields preserve the existing missing-name notice',
);
for (const mobileMode of [false, true]) {
  mobile = mobileMode;
  helper({
    results: [{ failedAccountInfos: [{ fullname: '<img src=x onerror="alert(1)">Name<script>payload</script>' }] }],
  });
  const displayed = rendered.at(-1);
  assert.ok(displayed && typeof displayed === 'object' && 'content' in displayed);
  if (displayed && typeof displayed === 'object' && 'content' in displayed) {
    assert.equal(typeof displayed.content, 'string');
    assert.equal(String(displayed.content).includes('<'), false, 'actual alert strips tags before text rendering');
    assert.ok(String(displayed.content).includes('Namepayload'));
  }
}
// Run the actual only consumer that acts on returned accounts; all effects are local mocks.
const groupFile = path.resolve(__dirname, '../pages/Group/settingGroup/index.tsx');
const groupSource: string = fs.readFileSync(groupFile, 'utf8');
const groupAst = parser.parse(groupSource, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
let callbackSource = '';
require('@babel/traverse').default(groupAst, {
  ArrowFunctionExpression(p) {
    const candidate = groupSource.slice(p.node.start, p.node.end);
    if (candidate.includes('const formatedData = existAccountHint(res);')) callbackSource = candidate;
  },
});
assert.ok(callbackSource);
const groupEvents: unknown[][] = [],
  reloads: unknown[] = [];
const callbackModule: { exports: unknown } = { exports: {} };
const callbackGlobals = {
  existAccountHint: helper,
  success: (...args: unknown[]) => groupEvents.push(args),
  groupID: 'group',
  getGroupInfo: () => reloads.push('info'),
  getGroupUsers: (value: unknown) => reloads.push(value),
  location: { href: 'https://example.local/group' },
  window: { close: () => reloads.push('close') },
};
new Function(
  'module',
  ...Object.keys(callbackGlobals),
  transformSync('module.exports = ' + callbackSource, { filename: groupFile }).code,
)(callbackModule, ...Object.values(callbackGlobals));
const applyGroupResult = callbackModule.exports as (response: unknown) => void;
applyGroupResult({ results: [{ accountInfos: [successful] }] });
assert.deepEqual(groupEvents, [['ADD_MEMBERS', { groupId: 'group', accounts: [successful] }]]);
assert.deepEqual(reloads, ['info', { pageIndex: 1, keywords: '' }]);
for (const response of [null, {}, { sendMessageResult: 0 }, { results: [{ accountInfos: [null] }] }, { results: [] }])
  applyGroupResult(response);
assert.equal(groupEvents.length, 1, 'failed/malformed/empty results never report successful group-member addition');
console.log(
  'Invitation result decoding, notice categories, member order/reference and real alert text rendering passed',
);
