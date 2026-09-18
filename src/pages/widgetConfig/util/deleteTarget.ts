import type { FormControl } from 'src/utils/controlTypes';

/** needDeleteWidgets 的一项：要么是控件对象（按 alias 匹配），要么是 controlId 字符串 */
export type DeleteTarget = { alias?: string } | string;

/**
 * 这个控件是不是本次要删的目标。
 *
 * needDeleteWidgets 的每一项【两种形态都有】：
 *   · Mingo 建表流程传的是 controlId【字符串】
 *     （CreateWorksheetBot/index.tsx 的 unsavedControlIds → selectedWidgetIds）
 *   · 选择器那条路传的是控件【对象】，按 alias 匹配
 *     （MingoGeneratedWidgetsSelector 用 convertAiRecommendControlToControlData 转出来的）
 *
 * 【2026-09-18 修了一个静默删错控件的 bug】原先写在 data.tsx 里的判定是
 *   `d.alias === w.alias || d === w.controlId`
 * d 是字符串时 `d.alias` 是 undefined，碰上【没有别名的控件】就成了
 * `undefined === undefined` → true，那个控件会被一起删掉。
 * 现在按形态分开判，并且要求 alias 两边都有值才算匹配。
 *
 * 【单独一个模块而不是留在 data.tsx 里】data.tsx 是 .tsx、顶部引了几十个上层模块，
 * spec 载不进来；拆出来之后这条判定可以被独立验证，见同目录的 deleteTarget.spec.ts。
 */
export function isDeleteTarget(target: DeleteTarget, widget: FormControl) {
  if (typeof target === 'string') return target === widget.controlId;
  return !!target.alias && target.alias === widget.alias;
}
