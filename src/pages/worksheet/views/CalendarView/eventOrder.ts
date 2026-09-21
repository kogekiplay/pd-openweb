/**
 * 把「视图设置 -> 排序」接到 FullCalendar 的 `eventOrder` 上。
 *
 * 【为什么需要这个】日历视图的设置抽屉里一直有「排序」那一栏，建视图时还会自动
 * 写一条默认排序（`moreSort: [{ controlId: 'ctime', isAsc: true }]`），
 * 但**渲染时从来没读过它** —— index.tsx 里 `eventOrder` 写死成 `'start'`。
 * 所以在排序里选什么，日历上一点变化都没有。
 *
 * 【这件事为什么重要，不只是"顺序好看点"】一格里放不下的事件会被折进「+N 更多」。
 * 露在外面的是哪一条，完全由排序决定。考勤这类表一天 90 条、只露 1~2 条，
 * 按开始时间排就等于"露最早打卡的那个"，几乎没有信息量；能按「迟到时长」
 * 「异常状态」排之后，露出来的才是真正要看的。
 *
 * 【故意不动取数那一侧】actions/calendarview.ts 里的 `sortControls` 也是按开始时间
 * 钉死的，但那个不是"用户想要的排序"，而是**翻页方向**（`isAsc: !isUp`，
 * 向前翻要新的在前）。改它会弄坏增量加载。用户排序只该影响**显示顺序**，
 * 所以只接 eventOrder 这一处。
 *
 * 【不 import 任何东西】保持纯函数、零依赖，spec 才能直接把它 require 进去跑
 * （和同目录风格的 calendar/delta.ts 一样）。
 */

export type SortRule = { controlId?: string; isAsc?: boolean };
export type ControlLike = { controlId?: string; type?: number; sourceControlType?: number };

/** FullCalendar 传给比较函数的对象：`{ ...extendedProps, ...eventDef, start, end, ... }`，
 *  而 extendedProps 就是整行记录，所以 `obj[controlId]` 直接能取到单元格原值。 */
export type CompareObj = Record<string, any>;

export type CellKind = 'number' | 'date' | 'text';

/** 数值型控件：数值 / 金额 / 等级 / 公式 / 汇总 */
const NUMERIC_TYPES = [6, 8, 28, 31, 37];
/** 日期型控件：日期 / 日期时间 */
const DATE_TYPES = [15, 16];

/** 他表字段(30) 的真实类型藏在 sourceControlType 里，和 utils/control.ts 的 isTimeStyle 同一套拆法 */
function realType(control: ControlLike): number | undefined {
  return control.type === 30 ? control.sourceControlType : control.type;
}

export function cellKindOf(control?: ControlLike): CellKind {
  if (!control) return 'text';
  const t = realType(control);
  if (t !== undefined && NUMERIC_TYPES.indexOf(t) > -1) return 'number';
  if (t !== undefined && DATE_TYPES.indexOf(t) > -1) return 'date';
  return 'text';
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

/**
 * 单个单元格的比较。
 *
 * 【为什么不能直接用 FullCalendar 自带的 flexibleCompare】HAP 的单元格值**都是字符串**，
 * 库那个比较器对字符串一律按字典序 —— 数值列会排成 "10" < "9"，日期列碰上
 * "2026/9/9" 和 "2026/9/10" 也是错的。所以按控件类型分开比。
 *
 * 空值恒排在最后，**不跟着升降序翻面** —— 升序时把一堆空值顶到最前面，
 * 是"排序坏了"的典型观感。表格类 UI 的通行做法也是空值垫底。
 */
export function compareEmpty(a: unknown, b: unknown): number | null {
  const ae = isEmpty(a);
  const be = isEmpty(b);
  if (!ae && !be) return null;
  if (ae && be) return 0;
  return ae ? 1 : -1;
}

export function compareCell(a: unknown, b: unknown, kind: CellKind): number {
  const empty = compareEmpty(a, b);
  if (empty !== null) return empty;

  if (kind === 'number') {
    const an = parseFloat(String(a));
    const bn = parseFloat(String(b));
    // 解析不出来就退回文本比，别返回 NaN —— Array.prototype.sort 拿到 NaN 的行为是未定义的
    if (!isNaN(an) && !isNaN(bn)) return an === bn ? 0 : an < bn ? -1 : 1;
  } else if (kind === 'date') {
    const at = Date.parse(String(a).replace(/-/g, '/'));
    const bt = Date.parse(String(b).replace(/-/g, '/'));
    if (!isNaN(at) && !isNaN(bt)) return at === bt ? 0 : at < bt ? -1 : 1;
  }

  const as = String(a);
  const bs = String(b);
  // 中文按拼音排，localeCompare 不带 locale 时各浏览器表现不一致
  return as === bs ? 0 : as.localeCompare(bs, 'zh-Hans-CN');
}

/**
 * 生成 FullCalendar 的 eventOrder 值。
 *
 * 返回的数组里可以混 function 和字符串（库的 parseFieldSpecs 支持），
 * 末尾垫一个 `'start'` 做同值兜底 —— 否则同一个排序值的几条记录顺序会随机漂，
 * 每次重渲染露出来的那条都不一样。
 */
export function buildEventOrder(
  moreSort?: SortRule[],
  controls?: ControlLike[],
): Array<string | ((a: CompareObj, b: CompareObj) => number)> {
  const rules = (moreSort || []).filter(r => !!r && !!r.controlId);
  if (!rules.length) return ['start'];

  const kindById: Record<string, CellKind> = {};
  for (const c of controls || []) {
    if (c && c.controlId) kindById[c.controlId] = cellKindOf(c);
  }

  const cmp = (a: CompareObj, b: CompareObj): number => {
    for (const rule of rules) {
      const id = rule.controlId as string;
      /* 【空值那一档不能跟着降序翻面】先单独判空：空值恒垫底。
         如果把它并进 compareCell 再统一取负，降序时一堆空值会被顶到最前面 ——
         写 spec 的时候就是这么错的，第 5 组钉住。 */
      const empty = compareEmpty(a[id], b[id]);
      if (empty !== null) {
        if (empty) return empty;
        continue; // 两边都空，这一级分不出来，看下一级
      }
      const d = compareCell(a[id], b[id], kindById[id] || 'text');
      if (d) return rule.isAsc === false ? -d : d;
    }
    return 0;
  };

  return [cmp, 'start'];
}
