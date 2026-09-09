/**
 * react-window 1 → 2 原生重写的行为验证脚本。
 *
 * 为什么单独放在这里而不是进 62 个行为 spec：那批 spec 是刻意不依赖 DOM 的
 * （见仓库根 TESTING.md），而这里验的东西必须真实挂载——react-window 2 会自测量容器、
 * 用 ResizeObserver、并且把 imperative API 晚于父组件 effect 才交出来。浅渲染验不了。
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-react-window-grid.cjs
 *
 * 覆盖两块：
 *   A. src/ming-ui/components/gridCellStyle.ts —— 纯函数，把 v2 的 transform 坐标还原成
 *      v1 的 left / top 数值。下游 CellControls / 记录色条 / 编辑浮层 都靠它。
 *   B. src/ming-ui/components/FixedTable/Grid.tsx 真实挂载 —— cellProps.data 映射、
 *      尺寸经 style 生效、覆盖 v2 的 overflow 与 maxWidth/maxHeight、gridRef 回调交出
 *      带 element 的 API、initialScrollLeft、ariaAttributes 不泄漏给业务 Cell、
 *      格子 style 已还原、只 re-render 即重测量、直接写 element.scrollLeft 生效。
 *
 * MDTable.tsx 的类组件路径用的是完全相同的三个机制（cellComponent + cellProps、
 * element.scrollLeft/Top、重渲即重测量），但它的 import 图要 webpack 别名和 jQuery 全局，
 * 不在这里挂载；靠 tsc 门禁 + 浏览器里的子表手工核对。
 * 改动上述两个文件之后请跑一遍。
 */
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

function loadJsdom() {
  const candidates = [process.env.JSDOM_PATH, RW + 'node_modules/jsdom', 'jsdom'].filter(Boolean);

  for (const c of candidates) {
    try { return require(c); } catch (e) { /* 试下一个 */ }
  }

  console.error('找不到 jsdom。请按文件头的说明装好后用 JSDOM_PATH 指过来。');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'getComputedStyle']) {
  global[k] = dom.window[k] !== undefined ? dom.window[k] : dom.window;
}
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.IS_REACT_ACT_ENVIRONMENT = true;

const babel = require(RW + 'node_modules/@babel/core');
const React = require(RW + 'node_modules/react');
const { createRoot } = require(RW + 'node_modules/react-dom/client');
const { act } = React;
const Module = require('module');

// 用仓库自己的 babel 把 .ts / .tsx 转成 CJS。注册成 require 扩展钩子，
// 这样 Grid.tsx 里 `import ... from '../gridCellStyle'` 这种相对引用能自然解析。
function compileTs(module, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false, configFile: false,
    presets: [
      [RW + 'node_modules/@babel/preset-env', { targets: { node: 'current' } }],
      [RW + 'node_modules/@babel/preset-react', { runtime: 'classic' }],
      [RW + 'node_modules/@babel/preset-typescript', { onlyRemoveTypeImports: true }],
    ],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module._compile(code, filename);
}
Module._extensions['.ts'] = compileTs;
Module._extensions['.tsx'] = compileTs;

const { normalizeGridCellStyle, RESET_V2_CONTAINER_BOX } = require(RW + 'src/ming-ui/components/gridCellStyle.ts');
const Grid = require(RW + 'src/ming-ui/components/FixedTable/Grid.tsx').default;

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '   got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)));
}

// ---------- A. gridCellStyle ----------
console.log('A. gridCellStyle.ts');
{
  const v2 = { position: 'absolute', left: 0, right: undefined, transform: 'translate(160px, 90px)', height: 30, width: 80 };
  const out = normalizeGridCellStyle(v2);
  check('transform → left/top 数值', [out.left, out.top], [160, 90]);
  check('transform 被移除', 'transform' in out, false);
  check('其余键保留', [out.position, out.width, out.height], ['absolute', 80, 30]);
  check('不改原对象', v2.transform, 'translate(160px, 90px)');
  check('小数坐标', normalizeGridCellStyle({ left: 0, transform: 'translate(12.5px, 0px)' }).left, 12.5);
  check('无 transform 原样返回', normalizeGridCellStyle({ left: 5, top: 6 }), { left: 5, top: 6 });
  check('undefined 原样返回', normalizeGridCellStyle(undefined), undefined);
  check('非 translate 的 transform 原样返回', normalizeGridCellStyle({ left: 0, transform: 'scale(2)' }), {
    left: 0,
    transform: 'scale(2)',
  });
  // rtl 下 v2 给的是 right: 0 + 负向 translate。负号能被正则匹配，若不拦住就会算出一个负 left
  // 再和 right: 0 打架，所以必须原样返回。
  const rtl = { right: 0, transform: 'translate(-160px, 90px)', width: 80, height: 30 };
  check('rtl（无 left、负向 translate）原样返回', normalizeGridCellStyle(rtl), rtl);
  check('容器盒模型复位包含三键', RESET_V2_CONTAINER_BOX, { maxHeight: 'none', maxWidth: 'none', flexGrow: 0 });
}

// ---------- B. FixedTable/Grid.tsx 真实挂载 ----------
console.log('\nB. FixedTable/Grid.tsx');
const root = createRoot(document.getElementById('root'));

// 业务 Cell 的最小替身：像 WorksheetTable 的 Cell 一样从 props.data 取数据；
// 顺带把收到的 style 与 ariaAttributes 情况记到 DOM 上供断言。
const Cell = p => React.createElement('div', {
  style: p.style,
  'data-rc': p.rowIndex + ':' + p.columnIndex,
  'data-label': p.data ? p.data.label : 'NO_DATA',
  'data-grid-id': p.data && p.data.grid ? p.data.grid.id : 'NO_GRID',
  'data-has-aria': 'ariaAttributes' in p ? '1' : '0',
  'data-has-transform': p.style && 'transform' in p.style ? '1' : '0',
  'data-left': p.style ? String(p.style.left) : 'none',
  'data-top': p.style ? String(p.style.top) : 'none',
});

// 第 0 列是左冻结列、宽度固定 80，让 center 网格的 config.width（也是它的 key）保持稳定；
// 只有 center 的列宽跟着 colW 变，这样「重测量」断言验的是重渲而不是 key 变化导致的重挂。
let colW = 80;
const refs = [];
function App({ label }) {
  return React.createElement(Grid, {
    id: 'main-center',
    leftFixed: false, rightFixed: false, topFixed: false, bottomFixed: false,
    width: 400, height: 300, columnHeadHeight: 34,
    rowCount: 20, columnCount: 6,
    topFixedCount: 1, bottomFixedCount: 0, leftFixedCount: 1, rightFixedCount: 0,
    rowHeight: 30,
    getColumnWidth: i => (i === 0 ? 80 : colW),
    Cell,
    tableData: { label },
    setRef: api => refs.push(api),
    cache: { left: 40 },
  });
}
// 期望的 config：left=80 top=34 width=320 height=266 columnCount=5 rowCount=20

act(() => { root.render(React.createElement(App, { label: 'A' })); });

const outer = document.querySelector('.main-center');
const styleAttr = () => outer.getAttribute('style') || '';
check('渲染出外层元素', !!outer, true);
check('渲染了多个格子', document.querySelectorAll('[data-rc]').length > 5, true);
check('cellProps.data 还原成 cell 的 data', document.querySelector('[data-rc="0:0"]').getAttribute('data-label'), 'A');
check('data.grid 带上网格 id', document.querySelector('[data-rc="0:0"]').getAttribute('data-grid-id'), 'main-center');
check('宽高经 style 生效', /width:\s*320px/.test(styleAttr()) && /height:\s*266px/.test(styleAttr()), true);
check('left/top 定位生效', /left:\s*80px/.test(styleAttr()) && /top:\s*34px/.test(styleAttr()), true);
check('覆盖 v2 的 overflow: auto', /overflow:\s*hidden/.test(styleAttr()), true);
check('解除 v2 的 max-width/max-height', /max-width:\s*none/.test(styleAttr()) && /max-height:\s*none/.test(styleAttr()), true);
check('ariaAttributes 没泄漏给业务 Cell', document.querySelector('[data-rc="0:0"]').getAttribute('data-has-aria'), '0');
check('格子 style 已去掉 transform', document.querySelector('[data-rc="0:1"]').getAttribute('data-has-transform'), '0');
check('格子 style 的 left/top 是数值', [
  document.querySelector('[data-rc="0:1"]').getAttribute('data-left'),
  document.querySelector('[data-rc="1:0"]').getAttribute('data-top'),
], ['80', '30']);

// gridRef 回调交出的 API
const api = refs.filter(Boolean).pop();
check('setRef 收到 v2 imperative API', !!api && typeof api.scrollToCell === 'function', true);
check('api.element 是外层 DIV', api && api.element === outer, true);
check('initialScrollLeft（cache.left）已应用', outer.scrollLeft, 40);

// FixedTable/index.tsx 的 setScrollX/Y 就是这样写的
act(() => { api.element.scrollLeft = 150; api.element.scrollTop = 90; });
check('直接写 element.scrollLeft 生效', outer.scrollLeft, 150);
check('直接写 element.scrollTop 生效', outer.scrollTop, 90);

// tableData 变化要传到 cell（cellProps 每次渲染都是新对象 → v2 memo 必然失效）
act(() => { root.render(React.createElement(App, { label: 'B' })); });
check('tableData 更新后 cell 内容跟着变', document.querySelector('[data-rc="0:0"]').getAttribute('data-label'), 'B');

// 只 re-render 就重测量（这就是 index.tsx 里 forceUpdate 变成 state bump 的依据）
function cellWidth(rc) { return (document.querySelector('[data-rc="' + rc + '"]').getAttribute('style') || '').match(/width:\s*([0-9.]+)px/)?.[1]; }
check('初始列宽', cellWidth('0:0'), '80');
colW = 123;
act(() => { root.render(React.createElement(App, { label: 'B' })); });
check('列宽函数变化后只 re-render 即重测量', cellWidth('0:0'), '123');
check('后续格子的 left 也随之重算', document.querySelector('[data-rc="0:1"]').getAttribute('data-left'), '123');
check('重测量期间外层未重挂（滚动位置保留）', outer.scrollLeft, 150);

console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
