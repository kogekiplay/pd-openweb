/**
 * isDeleteTarget 的行为 spec —— 守住「Mingo 删控件时不要连累没有别名的控件」。
 *
 * 【被守的 bug】2026-09-18。原先这条判定写在 util/data.tsx 里，是
 *   `d.alias === w.alias || d === w.controlId`
 * needDeleteWidgets 的每一项两种形态都有：
 *   · Mingo 建表流程传的是 controlId【字符串】
 *     （CreateWorksheetBot/index.tsx 的 unsavedControlIds → selectedWidgetIds）
 *   · 选择器那条路传的是控件【对象】，按 alias 匹配
 * d 是字符串时 `d.alias` 是 undefined，碰上没有别名的控件就成了
 * `undefined === undefined` → true，那个控件被一起删掉。
 * 下面第 3、4 条就是钉死这件事的。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');

type WidgetLike = { controlId?: string; alias?: string };
type IsDeleteTarget = (target: WidgetLike | string, widget: WidgetLike) => boolean;

/** 载入真实模块。它只 import 一个类型（编译后不留痕迹），所以不需要任何替身。 */
function loadIsDeleteTarget(): IsDeleteTarget {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'deleteTarget.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports.isDeleteTarget as IsDeleteTarget;
}

const isDeleteTarget = loadIsDeleteTarget();

// 1. 字符串形态：按 controlId 匹配
assert.strictEqual(isDeleteTarget('ctrl-1', { controlId: 'ctrl-1', alias: 'a1' }), true);
assert.strictEqual(isDeleteTarget('ctrl-1', { controlId: 'ctrl-2', alias: 'a2' }), false);

// 2. 对象形态：按 alias 匹配
assert.strictEqual(isDeleteTarget({ alias: 'a1' }, { controlId: 'ctrl-1', alias: 'a1' }), true);
assert.strictEqual(isDeleteTarget({ alias: 'a1' }, { controlId: 'ctrl-2', alias: 'a2' }), false);

// 3. 【核心】字符串形态遇上【没有别名】的控件，不能命中。
//    修复前这里是 undefined === undefined → true，控件会被误删。
assert.strictEqual(
  isDeleteTarget('ctrl-1', { controlId: 'ctrl-3' }),
  false,
  '传 controlId 字符串时，不该误伤没有别名的控件',
);

// 4. 对象形态自身 alias 缺失时，也不能靠「两边都是 undefined」命中
assert.strictEqual(
  isDeleteTarget({}, { controlId: 'ctrl-3' }),
  false,
  'alias 两边都缺时不算匹配，否则一次删除会清掉所有无别名控件',
);

// 5. 字符串形态不该去撞别名
assert.strictEqual(isDeleteTarget('a1', { controlId: 'ctrl-1', alias: 'a1' }), false);

console.log('isDeleteTarget spec: 7 条断言全部通过');
