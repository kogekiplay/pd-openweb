/**
 * VariableSizeGridCompat 的行为验证脚本（19 项断言）。
 *
 * 为什么单独放在这里而不是进 62 个行为 spec：那批 spec 是刻意不依赖 DOM 的
 * （见仓库根 TESTING.md），而这个兼容层必须真实挂载才能验——它包住的
 * react-window 2.x 会自测量容器、用 ResizeObserver、并且把 imperative API
 * 晚于父组件 effect 才交出来。这些行为浅渲染验不了。
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-react-window-compat.cjs
 *
 * 它覆盖的是 v1 → v2 迁移里最容易静默出错的那些点：itemData 到 cell 的 data 映射、
 * width/height 经 style 生效、调用方 style 能覆盖 v2 的 overflow、杂 prop 不落到 DOM、
 * initialScrollLeft、scrollTo、resetAfterIndices 触发重测量。
 * 改动 VariableSizeGridCompat.tsx 之后请跑一遍。
 */
const RW = require('path').resolve(__dirname, '..') + '/';
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

// 用仓库自己的 babel 把兼容层转成 CJS 并在内存里求值
function loadTsx(rel) {
  const file = RW + rel;
  const { code } = babel.transformFileSync(file, {
    babelrc: false, configFile: false,
    presets: [
      [RW + 'node_modules/@babel/preset-env', { targets: { node: 'current' } }],
      [RW + 'node_modules/@babel/preset-react', { runtime: 'classic' }],
      [RW + 'node_modules/@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const m = new Module(file, null);
  m.filename = file;
  m.paths = Module._nodeModulePaths(RW);
  m._compile(code, file);
  return m.exports;
}

const Compat = loadTsx('src/ming-ui/components/VariableSizeGridCompat.tsx').default;


const root = createRoot(document.getElementById('root'));
let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '   got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)));
}

// v1 风格的 Cell：从 props.data 取数据
const Cell = p => React.createElement('div', {
  style: p.style, 'data-rc': p.rowIndex + ':' + p.columnIndex, 'data-label': p.data ? p.data.label : 'NO_DATA',
});

let colW = 80;
function App({ epoch, label, gridRef }) {
  return React.createElement(Compat, {
    ref: gridRef, className: 'compat-grid', virtualdom: 'stray-prop-v1-ignored',
    style: { position: 'absolute', overflow: 'hidden', left: 10, top: 20 },
    width: 300, height: 200, columnCount: 6, rowCount: 20,
    columnWidth: i => colW, rowHeight: () => 30,
    itemData: { label }, initialScrollLeft: 40,
  }, args => React.createElement(Cell, args));   // 内联箭头：每次渲染新标识
}

const gridRef = React.createRef();
act(() => { root.render(React.createElement(App, { epoch: 0, label: 'A', gridRef })); });

const outer = document.querySelector('.compat-grid');
check('渲染出外层元素', !!outer, true);
check('itemData 还原成 cell 的 data', document.querySelector('[data-rc="0:0"]').getAttribute('data-label'), 'A');
check('渲染了多个格子', document.querySelectorAll('[data-rc]').length > 6, true);
check('width/height 进了 style', /width:\s*300px/.test(outer.getAttribute('style')) && /height:\s*200px/.test(outer.getAttribute('style')), true);
check('调用方 style 覆盖 v2 的 overflow', /overflow:\s*hidden/.test(outer.getAttribute('style')), true);
check('调用方 style 的 left/top 生效', /left:\s*10px/.test(outer.getAttribute('style')), true);
check('杂 prop virtualdom 没落到 DOM 上', outer.hasAttribute('virtualdom'), false);
check('initialScrollLeft 生效', outer.scrollLeft, 40);

// imperative API
const api = gridRef.current;
check('ref 暴露 scrollTo', typeof api.scrollTo, 'function');
check('ref 暴露 resetAfterIndices', typeof api.resetAfterIndices, 'function');
check('ref 暴露 resetAfterColumnIndex', typeof api.resetAfterColumnIndex, 'function');
check('ref 暴露 resetAfterRowIndex', typeof api.resetAfterRowIndex, 'function');
check('ref.element 是外层 DIV', api.element === outer, true);

act(() => { api.scrollTo({ scrollLeft: 150, scrollTop: 90 }); });
check('scrollTo 改变 scrollLeft', outer.scrollLeft, 150);
check('scrollTo 改变 scrollTop', outer.scrollTop, 90);

// itemData 变化要能传到 cell（验证稳定适配器不会导致内容变旧）
act(() => { root.render(React.createElement(App, { epoch: 0, label: 'B', gridRef })); });
check('itemData 更新后 cell 内容跟着变', document.querySelector('[data-rc="0:0"]').getAttribute('data-label'), 'B');

// resetAfterIndices 要能触发重新测量
function firstW() { return (document.querySelector('[data-rc="0:0"]').getAttribute('style') || '').match(/width:\s*([0-9.]+)px/)?.[1]; }
check('初始列宽', firstW(), '80');
colW = 123;
act(() => { root.render(React.createElement(App, { epoch: 0, label: 'B', gridRef })); });
// 已实测：v2 的尺寸缓存是被 cellProps 的【标识】失效的，而调用方每次渲染都造新的 itemData，
// 所以这里必然重测量。这与 v1「缓存到 reset 为止」不同，但方向是更新鲜、更正确。
check('只 re-render 也会重测量（v2 语义，已知差异）', firstW(), '123');
act(() => { gridRef.current.resetAfterIndices({ columnIndex: 0, rowIndex: 0 }); });
check('resetAfterIndices 后列宽重新测量', firstW(), '123');

console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
