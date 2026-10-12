const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const harness: import('../../scripts/spec-harness').SpecHarness = require('../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../..');
function load() {
  const file = path.join(root, 'src/socket/socketTypes.ts');
  const module: { exports: unknown } = { exports: {} };
  const transformed = harness.transformSync(fs.readFileSync(file, 'utf8'), { filename: file });
  assert.ok(transformed?.code);
  new Function('module', 'exports', transformed.code)(module, module.exports);
  assert.ok(module.exports && typeof module.exports === 'object');
  return module.exports as Record<string, unknown>;
}
const types = load();
function call(name: string, value: unknown): unknown {
  const fn = types[name];
  if (typeof fn !== 'function') throw new TypeError(`Missing decoder ${name}`);
  return Reflect.apply(fn, undefined, [value]);
}
assert.deepEqual(call('decodeCustomNotice', {
  id: 'notice-1', status: 2, title: '升级完成', msg: '<p>完成</p>', link: '/app/1', linkText: '查看', color: '#fff', type: 102,
}), { id: 'notice-1', status: 2, title: '升级完成', msg: '<p>完成</p>', link: '/app/1', linkText: '查看', color: '#fff', type: 102 });
assert.deepEqual(call('decodeCustomNotice', { id: 'n', status: 1, title: '处理中', msg: '稍候' }), {
  id: 'n', status: 1, title: '处理中', msg: '稍候', link: undefined, linkText: undefined, color: undefined, type: undefined,
});
for (const value of [null, [], { id: 1, status: 1, title: 'x', msg: 'x' }, { id: 'x', status: 1, title: 'x' }])
  assert.equal(call('decodeCustomNotice', value), null);
assert.deepEqual(call('decodeMarketNotice', { noticeId: 'm1', type: 1, displayType: 2, desc: '<p>系统</p>', createTime: '2026-10-13', title: '标题', link: '/help', linkText: '打开' }), {
  noticeId: 'm1', type: 1, displayType: 2, desc: '<p>系统</p>', createTime: '2026-10-13', title: '标题', link: '/help', linkText: '打开',
});
assert.deepEqual(call('decodeMarketNotice', { noticeId: 'm2' }), { noticeId: 'm2', displayType: undefined, desc: undefined, type: undefined, createTime: undefined, title: undefined, link: undefined, linkText: undefined });
for (const value of [null, [], { noticeId: 1 }]) assert.equal(call('decodeMarketNotice', value), null, 'Required notice id is validated');
assert.deepEqual(call('decodeMarketNotice', { noticeId: 'm', type: '1' }), { noticeId: 'm', displayType: undefined, desc: undefined, type: undefined, createTime: undefined, title: undefined, link: undefined, linkText: undefined });
assert.deepEqual(call('decodeMarketNotice', null), null);
console.log(JSON.stringify({ customNoticeCases: 6, marketNoticeCases: 6, malformedPayloadsIgnored: true }));
