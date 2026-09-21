/**
 * 文字对比度探针 —— 把「看不清的字」变成可复现的数字。
 *
 * 【为什么需要它】这一类缺陷目视很难系统地找：
 *   · 工作流「已修改」胶囊白底白字，是张奇偶然点进去才发现的；
 *   · 后台首页的说明文字 1.89:1，灰到读不清，没人报过。
 * 它们都不报错、不影响功能，只是读不清。探针能一次扫完整页。
 *
 * 【怎么用】和几何探针同一套路：
 *   node tools/capture-contrast.ts        # 打出可粘贴的源码
 * 在目标页面控制台里跑，直接看返回的数组。
 *
 * 【判据用 WCAG AA】正文 4.5:1，大号（>=18.66px）或加粗大字（>=14px 且 >=600）3:1。
 *
 * 【这个文件必须用纯 JS 语法写，不能加类型标注】理由同 geometry-probe.ts：
 * 它要被原样粘进浏览器控制台。写成 .ts 只是为了进类型门禁。
 *
 * ─────────── 四个会让结果失真的点 ───────────
 *
 * 坑一：**有效背景要往上走**。元素自己的 background 多半是透明的，
 *   得一路找到第一个不透明的祖先；中间遇到半透明的要按 alpha 合成。
 *   直接拿 el 自己的 backgroundColor 去算，全页都会算成「透明底」。
 *
 * 坑二：**碰到背景图就放弃这个元素**。图片/渐变底上的对比度算不出来，
 *   硬算会产出一堆假阳性（按 rgba(0,0,0,0) 当白底算）。宁可不报。
 *
 * 坑三：**只看【自己直接含文字】的元素**。容器的 color 会被子元素继承，
 *   把容器也算进来的话，同一段文字会沿 DOM 链重复报好几次。
 *   判据是它有没有直接的 text node，不是 innerText 非空。
 *
 * 坑四：**结果里混着三类东西，必须分开看，不能一律当 bug**：
 *   · 真缺陷 —— 语义用错了档（说明文字用了 --color-text-disabled 这种）；
 *   · 设计取舍 —— 禁用态本来就该淡，WCAG 也豁免禁用控件；
 *   · 用户数据 —— 用户自己选的标签颜色、图标色，不能改。
 *   探针只负责报数，判断是人的事。
 */
export function captureContrast() {
  function parse(c) {
    const m = (c || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  function lum(c) {
    const f = v => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  /** 把半透明的前景合成到底色上。 */
  function over(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }

  /** 见坑一、坑二。返回 null 表示「判不了，跳过」。 */
  function effectiveBg(el) {
    let n = el;
    let acc = null;
    while (n && n !== document.documentElement) {
      const s = window.getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 1 || c.a >= 1) return acc;
      }
      n = n.parentElement;
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 };
  }

  function ratio(a, b) {
    const l1 = lum(a);
    const l2 = lum(b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  const out = [];
  const all = document.querySelectorAll('body *');

  for (let i = 0; i < all.length; i++) {
    const el = all[i];

    // 见坑三：只看自己直接含文字的
    let text = '';
    for (let k = 0; k < el.childNodes.length; k++) {
      if (el.childNodes[k].nodeType === 3) text += el.childNodes[k].textContent;
    }
    text = text.trim();
    if (!text) continue;

    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.1) continue;

    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;

    const fg = parse(s.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    if (!bg) continue;

    const eff = fg.a < 1 ? over(fg, bg) : fg;
    const cr = ratio(eff, bg);

    const size = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 600;
    const need = size >= 18.66 || (size >= 14 && bold) ? 3 : 4.5;
    if (cr >= need) continue;

    let cls = '';
    if (typeof el.className === 'string') {
      cls = el.className
        .trim()
        .split(/\s+/)
        .filter(c => c && !/^(sc-|css-)/.test(c))
        .slice(0, 3)
        .join('.');
    }

    out.push({
      比: Math.round(cr * 100) / 100,
      需要: need,
      字: text.slice(0, 16),
      字号: Math.round(size),
      色: s.color,
      底: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
      元素: (el.tagName.toLowerCase() + (cls ? '.' + cls : '')).slice(0, 48),
    });
  }

  out.sort((a, b) => a.比 - b.比);
  return out;
}
