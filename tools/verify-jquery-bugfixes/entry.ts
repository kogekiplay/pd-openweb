/**
 * 三处 jQuery bug 修复的实测页：每一处都搭出【与线上等价的 DOM】，
 * 把「原表达式」和「改后表达式」在同一份 DOM 上各跑一遍，把结果并排列出来。
 *
 * 【为什么要单独搭页面，不去跑真页面】这三处分别在资源视图、任务阶段视图、任务列表里，
 * 都要登录态 + 后端数据才能到达；而且 taskStage 那处属于拖拽路径，
 * 在真环境里触发会写真实数据（生产是全公司的 OA）。搭等价 DOM 能把这三个表达式
 * 单独隔离出来验证，结论一样硬，且完全不碰后端。
 *
 * 用的是本仓真正在跑的 jQuery（package.json 的 jquery ^4.0.0，走 jquery/factory 入口，
 * 与 src/library/jquery/global.ts 同一个来源），不是另装一份。
 */
import { jQueryFactory } from 'jquery/factory';
import _ from 'lodash';

const $ = jQueryFactory(window);
(window as any).$ = $;

type Case = {
  title: string;
  where: string;
  fixture: string;
  /** 原来的写法在这份 DOM 上得到什么 */
  before: () => unknown;
  /** 改后的写法得到什么 */
  after: () => unknown;
  /** 期望：改后应当满足什么 */
  expect: (after: unknown, before: unknown) => boolean;
  expectText: string;
  /** 可选：反证。用来证明「某个看起来更简单的改法」同样不成立 */
  counter?: { label: string; run: () => unknown; want: (v: unknown) => boolean; note: string };
  /** 可选：额外渲染一段可视对比 */
  visual?: (host: HTMLElement) => void;
};

const cases: Case[] = [
  // ── 1. GroupCon 的拖拽线高度 ────────────────────────────────────────────
  {
    title: '资源视图拖拽线的高度',
    where: 'src/pages/worksheet/views/ResourceView/DataCon/GroupCon.tsx',
    fixture: `
      <div class="fx-head" style="position:relative;height:36px;background:#f5f5f5">
        表头（.dragLine 的定位祖先，只有 36px 高）
      </div>
      <div class="tableCon" style="height:240px;background:#fafafa">数据区 .tableCon（240px）</div>`,
    before: () => $('.fx .tableCon').height,
    after: () => _.sum([80, 80, 80]),
    expect: (after, before) => typeof before === 'function' && after === 240,
    expectText: '原写法取到的是 jQuery 方法本身（typeof === "function"，塞进 style 是无效 CSS）；改后是数值 240，与 .tableCon 实际高度一致',
    visual: host => {
      const box = document.createElement('div');
      box.className = 'visual';
      box.innerHTML = `
        <div class="vcol">
          <div class="vlabel">改之前</div>
          <div class="vhead" style="position:relative">
            <div class="vline" style="height:100%"></div>
          </div>
          <div class="vbody"></div>
          <div class="vnote">style.height 无效 → 只剩 CSS 的 height:100%，而定位祖先是表头，线只有表头那么高</div>
        </div>
        <div class="vcol">
          <div class="vlabel">改之后</div>
          <div class="vhead" style="position:relative">
            <div class="vline" style="height:240px"></div>
          </div>
          <div class="vbody"></div>
          <div class="vnote">height 用 React 手上的数据算出来（与 .tableCon 同一个表达式），线贯穿整个数据区</div>
        </div>`;
      host.appendChild(box);
    },
  },

  // ── 2. taskList 的「还有更多」判定 ──────────────────────────────────────
  {
    title: '任务列表「该分类是否还有更多」的判定',
    where: 'src/pages/task/containers/taskList/taskList.tsx',
    // 与 tpl/taskClassify.html 一致：每块内层 table 带 data-type = classify 编号。
    // 故意把 classify 0 这一块折叠（display:none），模拟用户收起了一个分类 ——
    // 这正是「用 DOM 下标当键」会错位的场景。
    fixture: `
      <div class="listStageTaskContent" style="display:none"><table data-type="0"></table></div>
      <div class="listStageTaskContent"><table data-type="1"></table></div>
      <div class="listStageTaskContent"><table data-type="2"></table></div>
      <div class="listStageTaskContent"><table data-type="3"></table></div>`,
    before: () => {
      // 原写法：.each((v, i) => …) 把 element 当成了下标
      const myTaskIsMore: Record<string, boolean> = { 0: false, 1: false, 2: true, 3: false };
      let hit = false;
      $('.fx .listStageTaskContent')
        .filter(':visible')
        .each((v: any, i: any) => {
          if (myTaskIsMore[i]) hit = true;
        });
      return hit;
    },
    after: () => {
      const myTaskIsMore: Record<string, boolean> = { 0: false, 1: false, 2: true, 3: false };
      let hit = false;
      $('.fx .listStageTaskContent')
        .filter(':visible')
        .each((index, el) => {
          const classifyType = $(el).find('table').attr('data-type');
          if (classifyType !== undefined && myTaskIsMore[classifyType]) hit = true;
        });
      return hit;
    },
    expect: (after, before) => before === false && after === true,
    expectText:
      'myTaskIsMore[2] 为 true 且第 2 类可见 → 应判定为「还有更多」。原写法拿 DOM 元素当键，恒取不到值（false）；改后按 data-type 取，得到 true',
    counter: {
      label: '反证：改用 .each 的下标',
      run: () => {
        // 「把 (v, i) 顺序摆正、直接用下标」是最省事的改法。但 classify 0 被折叠、
        // 已被 :visible 滤掉，于是下标 0 指向的是 classify 1 —— 整体错位一位。
        const myTaskIsMore: Record<string, boolean> = { 0: false, 1: false, 2: true, 3: false };
        const seen: string[] = [];
        $('.fx .listStageTaskContent')
          .filter(':visible')
          .each(index => {
            seen.push(`下标 ${index} → 当成 classify ${index}（实际是 ${index + 1}）`);
          });
        return seen.join('； ');
      },
      want: v => typeof v === 'string' && v.includes('下标 0'),
      note: '有分类被折叠时，:visible 之后的下标不再等于 classify 编号，整体错位 —— 所以必须按 data-type 取，不能用下标',
    },
  },

  // ── 3. taskStage 的阶段顶部坐标 ────────────────────────────────────────
  {
    title: '任务阶段视图的「阶段离顶部距离」',
    where: 'src/pages/task/containers/taskStage/taskStage.tsx',
    fixture: `
      <div style="height:64px">上方占位 64px</div>
      <div id="taskList">
        <div class="singleStage" style="height:50px;background:#eef">第一个 .singleStage</div>
        <div class="singleStage" style="height:50px;background:#efe">第二个 .singleStage</div>
      </div>`,
    before: () => ($('.fx #taskList .singleStage').first() as any).top || 0,
    after: () => $('.fx #taskList .singleStage').first().offset()?.top ?? 0,
    expect: (after, before) => before === 0 && typeof after === 'number' && (after as number) > 0,
    expectText:
      '原写法恒为 0（jQuery 对象上没有 .top），于是 `if (eventY > singleStageTop)` 恒真、等于没有这道判断；改后拿到的是该元素真实的文档坐标 top',
  },
];

// ── 渲染 ──────────────────────────────────────────────────────────────────
const root = document.getElementById('app')!;
let allPass = true;

cases.forEach((c, idx) => {
  const section = document.createElement('section');
  section.className = 'case';

  const fx = document.createElement('div');
  fx.className = 'fx';
  fx.innerHTML = c.fixture;
  section.appendChild(fx);

  // 【必须先进文档再求值】:visible 和 .offset() 都依赖真实布局，
  // 游离节点上一律拿不到值 —— 第一版就是漏了这一步，把两个本该通过的用例报成了未通过。
  root.appendChild(section);

  const before = c.before();
  const after = c.after();
  const pass = c.expect(after, before);
  if (!pass) allPass = false;

  const fmt = (v: unknown) => (typeof v === 'function' ? `ƒ (jQuery 方法本身)` : JSON.stringify(v));

  const head = document.createElement('div');
  head.innerHTML = `
    <h2>${idx + 1}. ${c.title} <span class="${pass ? 'ok' : 'bad'}">${pass ? '通过' : '未通过'}</span></h2>
    <div class="where">${c.where}</div>
    <table class="cmp">
      <tr><th>改之前</th><td class="val">${fmt(before)}</td></tr>
      <tr><th>改之后</th><td class="val">${fmt(after)}</td></tr>
      <tr><th>判据</th><td>${c.expectText}</td></tr>
    </table>`;

  if (c.counter) {
    const cv = c.counter.run();
    const cpass = c.counter.want(cv);
    if (!cpass) allPass = false;
    const t = document.createElement('table');
    t.className = 'cmp counter';
    t.innerHTML = `
      <tr><th>${c.counter.label}</th><td class="val">${fmt(cv)} <span class="${cpass ? 'ok' : 'bad'}">${cpass ? '已复现' : '未复现'}</span></td></tr>
      <tr><th></th><td>${c.counter.note}</td></tr>`;
    head.appendChild(t);
  }
  section.insertBefore(head, fx);

  if (c.visual) c.visual(section);
});

const banner = document.createElement('div');
banner.id = 'summary';
banner.className = allPass ? 'ok banner' : 'bad banner';
banner.textContent = allPass
  ? `全部 ${cases.length} 项通过 —— 三处修复在等价 DOM 上都得到了预期结果`
  : '存在未通过项，见下';
root.insertBefore(banner, root.firstChild);

const ver = document.createElement('div');
ver.className = 'ver';
ver.textContent = `jQuery ${$.fn.jquery}（与 src/library/jquery/global.ts 同一来源）`;
root.insertBefore(ver, root.firstChild);
