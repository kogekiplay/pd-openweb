/**
 * 版面几何快照探针 —— 批量改字号/间距时的安全网。
 *
 * 【为什么需要它】色值和圆角有棘轮盯着（audit-colors / audit-radius），
 * 改错了也只是"丑"。字号、行高、内外边距、控件高度改错了是**把版面压坏**：
 * 文字截断、按钮挤成一团、两栏错位。这一类**没有任何现有门禁能发现** ——
 * 也正因如此，排版/间距 token 立完之后故意没有批量映射（「只立尺子，不批量刷」）。
 *
 * 【为什么是几何快照而不是截图对比】
 * 截图要引无头浏览器、要处理像素容差、产物是二进制不能 review。
 * 几何快照是 JSON：能进 git、能逐行 diff、能在评审里看懂"哪个元素从 14px 变成 16px"。
 * 而且它量的正是会出事的那几个维度，不会被字体渲染差异之类的噪声淹没。
 *
 * 【怎么用】
 *   1. `node tools/capture-geometry.ts --print` 打出可粘贴的源码，
 *      在目标页面控制台里跑，把 JSON 存成 `tools/geometry/<名字>.before.json`
 *   2. 做改动
 *   3. 同一路由再跑一次，存成 `.after.json`
 *   4. `node tools/compare-geometry.ts <before> <after>`
 *
 * 【这个文件必须用纯 JS 语法写，不能加类型标注】
 * 它要被原样粘进浏览器控制台执行。写成 .ts 只是为了进 tsconfig.tools.browser.json
 * 的类型检查（那份带 DOM lib）。一旦写了 `: string` 这种标注，粘进控制台就是语法错误 ——
 * **而类型门禁照样通过**，所以这个约束坏了不会有任何地方报错。
 *
 * 【三个必须知道的坑，都是这类探针的通病】
 *
 * 坑一：**元素身份不能用下标**。DOM 顺序会因为异步内容、列表排序而变，
 *   用 index 配对会把 A 的几何和 B 的几何比，报出一堆假阳性。
 *   这里用"结构路径 + 稳定类名"做 key。
 *
 * 坑二：**必须剥掉哈希类名**。styled-components 的 `sc-xxxx` / `dBetQf`、
 *   antd cssinjs 的 `css-dev-only-do-not-override-xxx` / `css-var-_r_N_`
 *   **每次构建都不一样**，留着就等于每个元素的 key 都变了，两份快照零配对。
 *   这一条写错不会报错，只会让 diff 显示"全部新增 + 全部删除"。
 *
 * 坑三：**要确认页面静止**。骨架屏、懒加载、CSS transition 都会让同一页面在
 *   不同时刻量出不同几何，拿没静止的页面做对比只会得到一堆噪声。
 *
 *   **不要用"运行中动画数"当静止的判据** —— 一开始就是这么写的，实测立刻废掉：
 *   本应用每页都有 8 个 OverlayScrollbars 滚动条把手的动画常驻，
 *   它们只动 `transform`，跟版面毫无关系，但会让"动画数必须为 0"这条规则
 *   在每一页都误报中止。
 *
 *   正确做法是**直接量几何本身稳不稳**：隔 settleMs 采两次，报出漂移元素数。
 *   这才是真正要问的问题，而不是它的代理指标。实测那 8 个动画在场时漂移数是 0。
 *
 * 坑四：**数据派生的类名也要剥**，和坑二同理但更隐蔽。本仓的工作表行会带上
 *   `row-id-<UUID>`、`control-rule-undefined-<UUID>`、`cell-24`、`row-2` 这类类名 ——
 *   它们跟着**记录数据**变，不跟代码变。留着的话，只要期间有人增删了一条记录，
 *   两份快照就一行都配不上，diff 显示"全部新增 + 全部删除"，而改动本身一条都看不见。
 *   首次跑负向对照时就是这么发现的。
 */
export async function captureGeometry(settleMs = 400) {
  /** 不稳定的类名，必须剥掉：跟构建走的（坑二）和跟数据走的（坑四）。 */
  const VOLATILE_CLASS = [
    // —— 跟构建走（坑二）——
    /^sc-[A-Za-z0-9]+$/, // styled-components 的组件类
    /^css-dev-only-do-not-override-/, // antd cssinjs（开发态）
    /^css-var-_r_/, // antd cssinjs 的 CSS 变量作用域类
    /^css-[0-9a-z]{6,}$/, // antd cssinjs（生产态）

    // —— 跟数据走（坑四）——
    // 任何含 UUID 的类：row-id-<uuid>、control-rule-undefined-<uuid>、control-val-<uuid>…
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    /^(cell|row|col|rowHeight)-(\d+|NaN)$/, // 行列下标；兄弟序号已经能区分，不需要它
    /^control-(head|val|rule)-undefined$/, // 没有值时的占位类，随数据出现/消失
    // `cell-id-7301559378183747` 这类【每次渲染重新生成】的数字 id。
    // 跟上面那条只差一个 `-id-`，但漏掉它的代价很大：工作表主视图配对率
    // 卡在 72.9%，四分之一的页面实际没被检查。补上之后到 100%。
    /^[a-zA-Z]+-id-\d+$/,
  ];

  /**
   * styled-components 的内容哈希类要**按位置剥，不能按长度猜**（坑五）。
   *
   * class 属性的排布是固定的：`sc-<id> … <同样个数的内容哈希> … <用户类名>`，
   * 例如 `sc-iAzFDi sc-kRfPgF eiuRBV jTOmKK Font17 bold Hand` —— 两个 sc- 后面
   * 正好跟两个哈希。所以数出 sc- 的个数 N，把最后一个 sc- 之后的 N 个 token 剥掉。
   *
   * 最初写的是按长度 `/^[a-zA-Z]{5,8}$/`，实测漏得厉害：本页哈希长度分布是
   * 5/6/9/10，两头都漏。而且**不能简单放宽成 {3,10}** —— 那会把 `flex`、`bold`、
   * `cell` 这类真类名一起剥掉，让不同元素塌成同一个 key，后果比漏剥更糟。
   *
   * 漏剥的表现同坑二：改了 CSS -> 哈希变 -> key 变 -> 两份快照配不上。
   * 这条就是这么发现的：工作台第一批映射后，192/779 个元素配不上，
   * 差异只是多了个 4 字符的 `gjlh`。
   */
  function stripStyledHashes(raw) {
    let lastSc = -1;
    let scCount = 0;
    for (let i = 0; i < raw.length; i++) {
      if (/^sc-[A-Za-z0-9]+$/.test(raw[i])) {
        scCount++;
        lastSc = i;
      }
    }
    if (!scCount) return raw;
    return raw.filter((c, i) => !(i > lastSc && i <= lastSc + scCount));
  }

  function stableClasses(el) {
    if (typeof el.className !== 'string') return '';
    const raw = el.className.trim().split(/\s+/).filter(Boolean);
    return stripStyledHashes(raw)
      .filter(c => !VOLATILE_CLASS.some(re => re.test(c)))
      .sort() // 类名顺序在 React 重渲染时会变，排序后才稳定
      .join('.');
  }

  function signature(el) {
    const cls = stableClasses(el);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  }

  /**
   * 元素身份：从根往下的"标签.稳定类名[同签名兄弟里的序号]"链。
   * 序号是必须的 —— 列表里 20 个长得一模一样的行，不编号就全塌成一个 key。
   */
  function identity(el) {
    const parts = [];
    let n = el;

    while (n && n !== document.documentElement) {
      const sig = signature(n);
      const parent = n.parentElement;
      const twins = parent ? Array.prototype.filter.call(parent.children, s => signature(s) === sig) : [n];
      parts.unshift(twins.length > 1 ? sig + '[' + twins.indexOf(n) + ']' : sig);
      n = parent;
    }

    return parts.join('>');
  }

  /** px 字符串取整。半像素抖动（缩放、subpixel 布局）不该算差异。 */
  function px(v) {
    return Math.round(parseFloat(v) || 0);
  }

  /** 量一遍当前 DOM。纯同步，没有副作用。 */
  function measure() {
    const out = [];
    const all = document.querySelectorAll('body *');

    for (let i = 0; i < all.length; i++) {
      const el = all[i];

      // 【跳过右侧聊天栏】它是个**自己会变**的面板：聊天列表长度随新消息变化，
      // 于是里面那个"回到顶部"箭头的 y 会在两次采集之间跳一大截（实测 681 -> 540）。
      // 三个不同页面的对比里它都是唯一的差异来源，每次都得人工判成噪声。
      // 它不属于任何一次排版改动的作用域，整块排除掉，让"零变化"是真的零。
      if (el.closest('.ChatList-wrapper')) continue;

      // 【跳过 SVG 内部】<svg> 自己的盒子要量（它参与版面），但里面的 <g>/<path>
      // 不参与 CSS 布局，而且图标是异步取回来的、内部结构配不稳 ——
      // 实测工作台 779 个元素里有 154 个是图标内部，纯噪声。
      //
      // 用 closest 而不是 ownerSVGElement：后者只声明在 SVGElement 上，
      // 这里的 el 是 Element，要写 `(el as any)` 才过类型检查 ——
      // 而类型断言同样是 TS 语法，粘进控制台就废了（见文件头的纯 JS 约束）。
      const svgHost = el.closest('svg');
      if (svgHost && svgHost !== el) continue;

      const r = el.getBoundingClientRect();

      // 不可见的元素没有版面意义，量了只是噪声
      if (r.width === 0 && r.height === 0) continue;

      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;

      out.push({
        k: identity(el),
        // 坐标相对文档，滚动位置不同不该算差异
        x: Math.round(r.left + window.scrollX),
        y: Math.round(r.top + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
        fs: px(s.fontSize),
        lh: s.lineHeight === 'normal' ? 'normal' : px(s.lineHeight),
        m: [px(s.marginTop), px(s.marginRight), px(s.marginBottom), px(s.marginLeft)].join(' '),
        p: [px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft)].join(' '),
      });
    }

    return out;
  }

  // 见坑三：隔一会儿采两次，用漂移量证明页面确实静止了
  const first = measure();
  await new Promise(r => setTimeout(r, settleMs));
  const out = measure();

  const firstMap = new Map();
  for (let i = 0; i < first.length; i++) firstMap.set(first[i].k, first[i]);

  let drift = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    const b = firstMap.get(a.k);
    if (!b) continue; // 元素增减单独由 `元素数` 反映，不算漂移
    if (b.x !== a.x || b.y !== a.y || b.w !== a.w || b.h !== a.h || b.fs !== a.fs || b.m !== a.m || b.p !== a.p) {
      drift++;
    }
  }

  return {
    meta: {
      路由: location.pathname,
      标题: document.title,
      视口: window.innerWidth + 'x' + window.innerHeight,
      主题色: window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
      暗色: document.documentElement.getAttribute('data-theme') === 'dark',
      readyState: document.readyState,
      // 见坑三：不为 0 说明页面还在动，这份快照不可信
      采集间漂移元素数: drift,
      采集间元素数变化: out.length - first.length,
      静止判定间隔ms: settleMs,
      元素数: out.length,
      采集时刻: new Date().toISOString(),
    },
    elements: out,
  };
}
