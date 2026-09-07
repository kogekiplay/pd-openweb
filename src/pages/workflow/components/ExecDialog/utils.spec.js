const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness');

function requireEsm(file) {
  const module = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

const { canDirectSubmitApproveAction, getApproveActionTypeList, getOperationLogActionText } =
  requireEsm('./utils.js');
const auth = { passTypeList: [101], overruleTypeList: [101] };

assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth }), true);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'overrule', auth }), true);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'return', auth }), true);

// ── 分支可区分性 ──────────────────────────────────────────────────────────
// 上面那个 auth 的 passTypeList 与 overruleTypeList 取值相同（都是 [101]），
// 于是 getApproveActionTypeList 里的
//     action === 'pass' ? auth.passTypeList : auth.overruleTypeList
// 把两个分支【整个对调】，上面 17 条断言一条都不会响 —— 变异测试实测存活。
// 下面用两组取值不同的 auth 把这个盲区堵上：任何一次分支对调都会立刻失败。
// 注意 'return' 走的也是 else 分支（读 overruleTypeList），这一点一并钉住。
const authPassOnly = { passTypeList: [101], overruleTypeList: [100] };
assert.deepStrictEqual(getApproveActionTypeList('pass', authPassOnly), [101]);
assert.deepStrictEqual(getApproveActionTypeList('overrule', authPassOnly), [100]);
assert.deepStrictEqual(getApproveActionTypeList('return', authPassOnly), [100]);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth: authPassOnly }), true);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'overrule', auth: authPassOnly }), false);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'return', auth: authPassOnly }), false);

const authOverruleOnly = { passTypeList: [100], overruleTypeList: [101] };
assert.deepStrictEqual(getApproveActionTypeList('pass', authOverruleOnly), [100]);
assert.deepStrictEqual(getApproveActionTypeList('overrule', authOverruleOnly), [101]);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth: authOverruleOnly }), false);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'overrule', auth: authOverruleOnly }), true);

assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth, btnDescMap: { 4: 'pass desc' } }), false);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth, btnDescMap: { 4: '   ' } }), true);
assert.strictEqual(
  canDirectSubmitApproveAction({ action: 'overrule', auth, btnDescMap: { 5: 'overrule desc' } }),
  false,
);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'return', auth, btnDescMap: { 17: 'return desc' } }), false);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth, encrypt: true }), false);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth: { passTypeList: [100] } }), false);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'pass', auth: { passTypeList: [1] } }), false);
assert.strictEqual(canDirectSubmitApproveAction({ action: 'transfer', auth }), false);

assert.strictEqual(getOperationLogActionText(4, { 4: '批准' }, { 4: '同意' }), '批准');
assert.strictEqual(getOperationLogActionText(4, { 4: '同意' }, { 4: '默认同意' }, { btnmap_4: '批准' }), '批准');
assert.strictEqual(getOperationLogActionText(5, { 5: '驳回' }, { 5: '拒绝' }), '驳回');
assert.strictEqual(getOperationLogActionText(8, {}, { 8: '转审' }), '转审');
assert.strictEqual(getOperationLogActionText(99, {}, {}), '');
assert.strictEqual(getOperationLogActionText(4, null, { 4: '同意' }, null), '同意');

console.log('ExecDialog utils tests passed');
