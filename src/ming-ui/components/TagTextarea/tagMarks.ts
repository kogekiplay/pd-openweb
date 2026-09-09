// TagTextarea 的标记位置计算。
//
// 从 TagTextarea.tsx 里抽出来，原因和公式编辑器那边的 formulaMarks.ts 一样：
// CM5 的 markText 收 {line, ch}，CM6 的 Decoration 收全文绝对 offset。
// 换坐标系是这次迁移里最容易出静默错位的一环（错了不报错，只是 tag 画偏一格），
// 所以把它做成不依赖编辑器的纯函数，好用 CM5 的实际输出做差分验证。

/**
 * getRePosFromStr 正则匹配字段返回位置信息
 *
 * 保持 CM5 时代的原样：返回的是【行内】坐标 {line, start, stop}。
 * 它从 ming-ui 的 barrel 导出过，属于公开 API，不动。
 * */
export function getRePosFromStr(text = '', re = /\$[^ \r\n[\](){}!@%^&*+=]+?\$/g) {
  const lines = text.split('\n');
  const positions = [];
  let m;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    while ((m = re.exec(l)) !== null) {
      var tag = m[0].substring(1, m[0].length - 1);
      positions.push({
        line: i,
        start: m.index,
        stop: m.index + m[0].length,
        tag: tag,
      });
    }
  }

  return positions;
}

export const OPERATOR_RE = /\+|-|\*|\/|\(|\)|,/g;

/**
 * 各行行首在全文中的绝对偏移。
 * CM6 的 doc 用 \n 计一个字符，与 JS 字符串一致，所以直接累加「行长 + 1」即可。
 */
export function lineStartOffsets(text = '') {
  const offsets = [0];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length - 1; i++) {
    offsets.push(offsets[i] + lines[i].length + 1);
  }

  return offsets;
}

/**
 * 把 {line, start, stop} 换算成全文绝对 offset。
 */
export function toDocRange(pos, offsets) {
  const base = offsets[pos.line];

  return { from: base + pos.start, to: base + pos.stop };
}

/**
 * 算出该给哪些区间挂 replace 装饰。
 *
 * withOperators 对应 CM5 那边 `mode === FORMULA || mode === DATE || operatorsSetMargin`
 * 时才额外 markOperators 的条件。
 *
 * 返回按 from 升序排好的数组——CM6 的 RangeSetBuilder 要求 add 必须按起点递增，
 * 而 CM5 是先把全部 tag 标完、再把全部 operator 标完（两轮各自有序、合起来无序），
 * 所以这里必须排序，不能照搬 CM5 的顺序。
 */
export function computeTagMarks(text = '', { withOperators = false } = {}) {
  const offsets = lineStartOffsets(text);
  const tagPoss = getRePosFromStr(text);
  const marks = tagPoss.map((pos, i) => ({
    ...toDocRange(pos, offsets),
    kind: 'tag',
    tag: pos.tag,
    isLast: i === tagPoss.length - 1,
  }));

  if (withOperators) {
    getRePosFromStr(text, OPERATOR_RE).forEach(pos => {
      const range = toDocRange(pos, offsets);

      // 落在字段引用内部的操作符必须丢掉。
      // 字段名的正则只排除了 ` \r\n[](){}!@%^&*+=`，并没有排除 `-` `/` `,` `.`，
      // 而 insertColumnTag 生成的就是 `$控件id-1$` 这种形状——于是 `-` 会同时
      // 被操作符正则匹配到，产生一个落在 tag 区间【内部】的区间。
      // CM5 的 markText 允许区间重叠（行为未定义但不报错），CM6 的 RangeSetBuilder
      // 则要求区间严格有序不重叠，直接抛异常。这不是可选的优化，是必须的。
      if (marks.some(m => m.kind === 'tag' && range.from < m.to && range.to > m.from)) return;

      // 操作符只有一个字符，而 getRePosFromStr 的 tag 是按 `$x$` 剥两头算的
      // （单字符时 substring(1,0) 被 JS 反转成 substring(0,1)，凑巧等于原字符）。
      // 别依赖这个巧合，直接从原文切。
      marks.push({ ...range, kind: 'operator', tag: text.slice(range.from, range.to), isLast: false });
    });
  }

  return marks.sort((a, b) => a.from - b.from || a.to - b.to);
}

/**
 * FORMULA / DATE / ONLYTAG 模式下对输入字符的白名单过滤，
 * 对应 CM5 beforeChange 里那两段 text.map(...)。
 * 粘贴时多允许一个 `$`，因为粘进来的内容可能整段就是 `$id$` 形式的字段引用。
 */
export function sanitizeInput(text, { mode, isPaste }) {
  if (mode === 'formula') {
    return text
      .toUpperCase()
      .split('')
      .filter(c => (isPaste ? /[0-9A-Z+\-*/(),.$]/ : /[0-9A-Z+\-*/(),.]/).test(c))
      .join('');
  }

  if (mode === 'date') {
    return text
      .split('')
      .filter(c => (isPaste ? /[0-9YMdhm+\-$]/ : /[0-9YMdhm+-]/).test(c))
      .join('');
  }

  return text;
}
