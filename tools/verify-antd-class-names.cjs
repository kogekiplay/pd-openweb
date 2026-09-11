/**
 * antd 4 → 6 的【样式选择器】差分：本仓覆盖的每一条 .ant-* 选择器，
 * 在新版里还找不找得到对应元素。
 *
 * 为什么这是本次升级的核心判据：
 * antd 5 起改用 CSS-in-JS，DOM 结构与类名大量变动。本仓有 112 个 less/css 文件
 * 覆盖了 292 个不同的 .ant-* 类名（另有 199 个 ts/tsx 里按 .ant-* 取元素）。
 * 类名一旦对不上，**样式就静默失效** —— 不报错、不影响构建、tsc 看不见、
 * 单元测试也测不到，只有人肉打开那个界面才发现「这儿怎么歪了」。
 * 486 个文件逐个肉眼比对不现实，所以把它变成可机检的：
 *
 *   同一个组件，在 antd 4 和 antd 6 下各渲染一次，收集渲染结果里出现的【全部类名】，
 *   然后拿本仓覆盖的选择器逐条去比：4 里有、6 里没有的，就是会失效的那些。
 *
 * 输出是一张【按组件归类的待办清单】，也是交给人做界面验证时的清单依据。
 *
 * 几个刻意的设计：
 *   - 弹层类组件（Select/Dropdown/Modal/Drawer/Popover/Tooltip…）默认不渲染内容，
 *     必须强制打开（open/visible）并把 portal 里的节点也收进来，否则会得出
 *     「这些选择器两版都不存在」的假结论。
 *   - 只报本仓【真的写了覆盖】的选择器，不报 antd 内部所有类名的变化 ——
 *     后者几千条，全是噪声。
 *   - 带下限断言：某个组件在 v4 下一个类名都没收集到，说明渲染失败而不是「没变化」，
 *     直接判为脚本坏了。
 *
 * 运行：
 *   mkdir -p /tmp/antd4 /tmp/antd6   # 分别 npm i antd@4.19.0 / antd@6.6.3
 *   cd /tmp/antdN/node_modules && for p in react react-dom scheduler; do \
 *     rm -rf $p && ln -s <repo>/node_modules/$p $p; done
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-antd-class-names.cjs
 */
const fs = require('fs');
const path = require('path');

// 兜底看门狗：真挂住时直接失败，别让人等
setTimeout(() => {
  console.error('  超时 180s —— 大概率是某个用例挂住了，按失败处理');
  process.exit(3);
}, 180000).unref();

const RW = path.resolve(__dirname, '..') + '/';

function loadJsdom() {
  for (const c of [process.env.JSDOM_PATH, RW + 'node_modules/jsdom', 'jsdom'].filter(Boolean)) {
    try {
      return require(c);
    } catch (e) {
      /* 试下一个 */
    }
  }

  console.error('找不到 jsdom，见其它 verify-* 脚本文件头。');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const dom = new JSDOM('<!doctype html><div id="app"></div>', { pretendToBeVisual: true, url: 'https://example.test/' });
// 【别手写白名单】第一版就是漏了 SVGElement（@ant-design/icons v6 要用），
// 结果每个用例都抛 ReferenceError。更坑的是当时 harness 捕获后继续跑，
// React 对每个未捕获的渲染错误都要构造完整组件栈（靠 throw/catch 取栈帧，极慢），
// 23 个用例 × 2 个版本叠起来，整个脚本跑了 8 分钟还没完 —— 全耗在错误处理上。
// 改成把 jsdom window 上所有 DOM 构造器整体搬过来，再加几个常用实例。
for (const k of Object.getOwnPropertyNames(dom.window)) {
  // 大写开头的函数 = DOM 构造器/接口。整体搬，不要挑 —— 挑就一定会漏
  // （第一版挑漏了 SVGElement，第二版用正则又漏了 ShadowRoot）。
  if (!/^[A-Z]/.test(k) || global[k] !== undefined) continue;

  try {
    if (typeof dom.window[k] === 'function') global[k] = dom.window[k];
  } catch (e) {
    /* 某些属性取值会抛，跳过 */
  }
}
for (const k of [
  'window', 'document', 'navigator', 'getComputedStyle', 'location', 'history',
  'localStorage', 'sessionStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.self = global.window;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.window.matchMedia =
  global.window.matchMedia ||
  (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const React = require(RW + 'node_modules/react');
const { createRoot } = require(RW + 'node_modules/react-dom/client');

const A4 = process.env.ANTD4 || '/tmp/antd4/node_modules/antd';
const A6 = process.env.ANTD6 || '/tmp/antd6/node_modules/antd';

for (const p of [A4, A6]) {
  if (!fs.existsSync(p)) {
    console.error(`找不到 ${p}，见本文件头的安装说明。`);
    process.exit(2);
  }
}

/* ---------- 1. 本仓覆盖了哪些 .ant-* 选择器 ---------- */

function collectOverridden() {
  const found = new Map(); // 类名 -> 出现过的文件（去重后前几个）

  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);

      if (e.isDirectory()) {
        if (!/(^|\/)(node_modules|library)$/.test(abs)) walk(abs);
      } else if (/\.(less|css)$/.test(e.name)) {
        const src = fs.readFileSync(abs, 'utf8');

        for (const m of src.matchAll(/\.(ant-[a-z0-9-]+)/g)) {
          const cls = m[1];

          if (!found.has(cls)) found.set(cls, []);

          const list = found.get(cls);

          if (list.length < 3 && !list.includes(abs)) list.push(abs);
        }
      }
    }
  };

  walk(RW + 'src');

  return found;
}

const overridden = collectOverridden();

if (overridden.size < 100) {
  console.error(`只扫到 ${overridden.size} 个被覆盖的 .ant-* 类名，扫描逻辑大概率坏了。`);
  process.exit(2);
}

/* ---------- 2. 在两个版本下分别渲染，收集出现过的类名 ---------- */

// 每个用例：组件名 -> 渲染函数。弹层类一律强制打开，否则收不到内容区的类名。
function buildCases(antd, React) {
  const {
    Button, Input, InputNumber, Select, Checkbox, Radio, Switch, Slider, Divider, Spin, Skeleton,
    Table, Tabs, Pagination, Steps, Collapse, Tree, Menu, Dropdown, Modal, Drawer, Popover, Tooltip,
    DatePicker, TimePicker, ConfigProvider,
  } = antd;
  const h = React.createElement;
  const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

  return {
    btn: () => h(Button, { type: 'primary' }, 'x'),
    input: () => h('div', null, h(Input, { defaultValue: 'x' }), h(InputNumber, { defaultValue: 1 })),
    select: () => h(Select, { open: true, options: opts, defaultValue: 'a', style: { width: 100 } }),
    checkbox: () => h(Checkbox, { checked: true }, 'x'),
    radio: () => h(Radio.Group, { value: 1 }, h(Radio, { value: 1 }, 'x')),
    switch: () => h(Switch, { checked: true }),
    slider: () => h(Slider, { defaultValue: 30 }),
    divider: () => h(Divider, null, 'x'),
    spin: () => h(Spin, { spinning: true }, h('div', null, 'x')),
    skeleton: () => h(Skeleton, { active: true }),
    table: () =>
      h(Table, {
        dataSource: [{ key: 1, a: 'x' }],
        columns: [{ title: 'A', dataIndex: 'a', sorter: true, filters: [{ text: 'x', value: 'x' }] }],
        pagination: { current: 1, total: 50 },
        rowSelection: {},
      }),
    tabs: () => h(Tabs, { defaultActiveKey: '1', items: [{ key: '1', label: 'a', children: 'x' }, { key: '2', label: 'b', children: 'y' }] }),
    pagination: () => h(Pagination, { current: 1, total: 100, showSizeChanger: true, showQuickJumper: true }),
    steps: () => h(Steps, { current: 1, items: [{ title: 'a' }, { title: 'b' }] }),
    collapse: () => h(Collapse, { defaultActiveKey: ['1'], items: [{ key: '1', label: 'a', children: 'x' }] }),
    tree: () => h(Tree, { defaultExpandAll: true, checkable: true, treeData: [{ title: 'a', key: '1', children: [{ title: 'b', key: '2' }] }] }),
    menu: () =>
      h(Menu, {
        defaultOpenKeys: ['sub'],
        defaultSelectedKeys: ['1'],
        mode: 'inline',
        items: [{ key: 'sub', label: 'sub', children: [{ key: '1', label: 'a' }] }],
      }),
    dropdown: () => h(Dropdown, { open: true, menu: { items: [{ key: '1', label: 'a' }] } }, h('a', null, 'x')),
    modal: () => h(Modal, { open: true, title: 't' }, 'x'),
    drawer: () => h(Drawer, { open: true, title: 't' }, 'x'),
    popover: () => h(Popover, { open: true, title: 't', content: 'c' }, h('a', null, 'x')),
    tooltip: () => h(Tooltip, { open: true, title: 't' }, h('a', null, 'x')),
    picker: () => h('div', null, h(DatePicker, { open: true }), h(TimePicker, {})),
  };
}

async function classNamesFor(antdPath) {
  const antd = require(antdPath);
  const cases = buildCases(antd, React);
  const byCase = {};

  for (const [name, render] of Object.entries(cases)) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const before = new Set([...document.querySelectorAll('*')].map(e => e));

    try {
      await React.act(async () => {
        root.render(render());
      });
      await React.act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });
    } catch (e) {
      // 【就地失败】不要 continue：渲染错误几乎一定是 harness 自己没搭对
      //（缺全局、缺 props），继续跑只会让 React 为每个用例构造组件栈、
      // 把脚本拖成几分钟，而且最后得出的「差异」全是假的。
      console.error(`\n  用例 ${name} 在 ${antdPath.includes('antd4') ? 'antd4' : 'antd6'} 下渲染抛错，判据不成立：`);
      console.error(`    ${e.message.split('\n')[0]}`);
      process.exit(2);
    }

    // portal 渲染到 body 上，所以整棵 body 都要扫，再排掉渲染前就存在的节点
    const cls = new Set();

    for (const el of document.querySelectorAll('*')) {
      if (before.has(el) && !host.contains(el)) continue;

      for (const c of el.classList || []) if (c.startsWith('ant-')) cls.add(c);
    }

    byCase[name] = { classes: cls };

    await React.act(async () => {
      root.unmount();
    });
    host.remove();
  }

  return byCase;
}

(async () => {
  const v4 = await classNamesFor(A4);
  const v6 = await classNamesFor(A6);

  const allV4 = new Set();
  const allV6 = new Set();
  const renderErrors = [];

  for (const [name, r] of Object.entries(v4)) {
    if (r.error) renderErrors.push(`v4 ${name}: ${r.error}`);
    else {
      if (!r.classes.size) renderErrors.push(`v4 ${name}: 一个 ant-* 类名都没收到（渲染失败，不是「没变化」）`);

      r.classes.forEach(c => allV4.add(c));
    }
  }

  for (const [name, r] of Object.entries(v6)) {
    if (r.error) renderErrors.push(`v6 ${name}: ${r.error}`);
    else r.classes.forEach(c => allV6.add(c));
  }

  console.log(`\n  用例 ${Object.keys(v4).length} 个组件`);
  console.log(`  antd 4 渲染出的类名: ${allV4.size}     antd 6: ${allV6.size}`);
  console.log(`  本仓覆盖的 .ant-* 类名: ${overridden.size}`);

  if (renderErrors.length) {
    console.log('\n  渲染问题（这些用例的结论不可信）:');
    renderErrors.slice(0, 20).forEach(e => console.log('    ' + e));
  }

  // 只对「v4 里真的渲染出来过」的选择器下结论 —— 其余的说明本用例没覆盖到，另行人工确认
  const broken = [];
  const uncovered = [];

  for (const [cls, files] of overridden) {
    if (!allV4.has(cls)) {
      uncovered.push(cls);
      continue;
    }

    if (!allV6.has(cls)) broken.push({ cls, files: files.map(f => f.replace(RW, '')) });
  }

  console.log(`\n  === 判定 ===`);
  console.log(`  本用例覆盖到的选择器: ${overridden.size - uncovered.length}`);
  console.log(`  其中【antd 6 下不再出现】: ${broken.length}   ← 升级后这些覆盖样式会静默失效`);
  console.log(`  本用例没覆盖到、需人工确认的: ${uncovered.length}`);

  if (broken.length) {
    const byComp = new Map();

    for (const b of broken) {
      const comp = b.cls.replace(/^ant-/, '').split('-')[0];

      if (!byComp.has(comp)) byComp.set(comp, []);

      byComp.get(comp).push(b);
    }

    console.log('\n  按组件归类（这就是需要人工验证的界面清单）:');
    [...byComp.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([comp, list]) => {
        console.log(`\n    ${comp}（${list.length} 条）`);
        list.slice(0, 6).forEach(b => console.log(`      .${b.cls}   ← ${b.files[0]}`));

        if (list.length > 6) console.log(`      …还有 ${list.length - 6} 条`);
      });
  }

  fs.writeFileSync(
    '/tmp/antd-broken-selectors.json',
    JSON.stringify({ broken, uncovered, v4Only: [...allV4].filter(c => !allV6.has(c)) }, null, 2),
  );
  console.log('\n  完整结果已写入 /tmp/antd-broken-selectors.json');
  // jsdom 会留下未关闭的句柄，不显式退出的话进程挂在那里、最后被看门狗误判成超时
  process.exit(broken.length ? 1 : 0);
})();
