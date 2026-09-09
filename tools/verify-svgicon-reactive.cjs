/**
 * SvgIcon 的「颜色/尺寸随 props 响应」回归测试。
 *
 * 守的是这个真实上线过的 bug：react-svg 11→19 之后，切换左侧表单时上一个表单的图标
 * 仍是选中色、新选中的反而不变色。根因是 react-svg 19 把 beforeInjection 存进内部
 * callbacksRef，注入 effect 的依赖数组里没有它，于是【只有 src 变了才重新注入】，
 * 而当时的 SvgIcon 恰恰是在 beforeInjection 里写死 fill 与 size 的真值。
 * v11 是类组件，componentDidUpdate 里 shallowDiffers 一比就整个重注入，
 * 而 beforeInjection 是内联箭头每渲染都是新函数 —— 于是每渲染必重注入，掩盖了这个问题。
 *
 * 所以本文件最核心的一条断言是「注入只发生了 1 次，但颜色/尺寸仍然跟着 props 变了」。
 * 只断言「颜色对」是抓不住回归的：旧代码在首次渲染时颜色也是对的。
 *
 * 分工说明：jsdom 不做真正的样式解析，currentColor 与 var() 的【最终计算值】在这里验不了，
 * 那部分是在真实浏览器上用生产页面的真实图标验过的（改 wrapper 的 color 后
 * svg 的 computed fill 立即跟随；--svg-icon-size 设 18/32/20px 时 svg 盒子随之变化）。
 * 本文件负责验 React 侧的接线：wrapper 上的真值会更新、注入产物里只有引用、且没有重注入。
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-svgicon-reactive.cjs
 *
 * 改动 src/ming-ui/components/SvgIcon.tsx 之后请跑一遍。
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
const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, url: 'https://example.test/' });
// SVGSVGElement 必须搬过来：injector 用 documentElement instanceof SVGSVGElement 判断响应是否是合法 svg，
// 全局缺了它就直接 false，表现为静默不注入。
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'getComputedStyle', 'DOMParser', 'SVGSVGElement', 'SVGElement', 'XMLSerializer']) {
  global[k] = dom.window[k] !== undefined ? dom.window[k] : dom.window;
}
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.IS_REACT_ACT_ENVIRONMENT = true;

// —— stub XHR：@tanem/svg-injector 用 XMLHttpRequest 拉 svg；url 带 .svg 后缀时它会跳过
//    content-type 校验（见 svg-injector.mjs 的 hasSvgExtension 分支），所以 stub 可以很薄。
//    同时记录请求次数，用来佐证「有没有重新注入」。
const SVG_SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#123456">' +
  '<path fill="#abcdef" d="M0 0h24v24H0z"/><circle fill="#ff0000" cx="12" cy="12" r="4"/>' +
  '</svg>';
let xhrCount = 0;
global.XMLHttpRequest = dom.window.XMLHttpRequest = class {
  open() { xhrCount++; }
  setRequestHeader() {}
  // injector 会调这两个；缺任何一个都会抛 TypeError 被它的 catch 吞成「加载失败」，
  // 表现为静默不注入——踩过一次，记在这里。
  overrideMimeType() {}
  abort() {}
  getResponseHeader() { return 'image/svg+xml'; }
  send() {
    this.readyState = 4;
    this.status = 200;
    this.responseText = SVG_SOURCE;
    // 必须用 image/svg+xml 而不是 text/xml：只有前者 jsdom 才会造出真正的 SVGSVGElement，
    // 否则上面那个 instanceof 判断过不了。
    this.responseXML = new dom.window.DOMParser().parseFromString(SVG_SOURCE, 'image/svg+xml');
    if (this.onreadystatechange) this.onreadystatechange();
  }
};

const babel = require(RW + 'node_modules/@babel/core');
const React = require(RW + 'node_modules/react');
const { createRoot } = require(RW + 'node_modules/react-dom/client');
const { act } = React;
const Module = require('module');

function compileTs(module, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false, configFile: false,
    presets: [
      [RW + 'node_modules/@babel/preset-env', { targets: { node: 'current' } }],
      [RW + 'node_modules/@babel/preset-react', { runtime: 'classic' }],
      [RW + 'node_modules/@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module._compile(code, filename);
}
Module._extensions['.ts'] = compileTs;
Module._extensions['.tsx'] = compileTs;

const SvgIcon = require(RW + 'src/ming-ui/components/SvgIcon.tsx').default;

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '   got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)));
}

const root = createRoot(document.getElementById('root'));
// injector 通过 defer() 异步回调，渲染后要放行一次宏任务才能看到注入结果。
const render = async props => {
  await act(async () => {
    root.render(React.createElement(SvgIcon, Object.assign({ url: '/icon.svg' }, props)));
  });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
};

async function main() {

// ---------- 首次渲染 ----------
console.log('A. 首次渲染');
await render({ fill: '#4CAF50', size: 22 });
const svg1 = document.querySelector('#root svg');
const wrapper = document.querySelector('#root > div');
check('注入出 svg', !!svg1, true);
check('只发了 1 次请求', xhrCount, 1);
check('svg 根节点 fill 是引用而非真值', svg1.getAttribute('fill'), 'currentColor');
check('svg 的尺寸走 CSS 变量', /width:\s*var\(--svg-icon-size\)/.test(svg1.getAttribute('style') || ''), true);
check('svg 的 style 里不含写死的像素值', /\d+px/.test(svg1.getAttribute('style') || ''), false);
check('wrapper 带上真实颜色', (wrapper.getAttribute('style') || '').includes('color: rgb(76, 175, 80)') || (wrapper.getAttribute('style') || '').includes('#4CAF50'), true);
check('wrapper 带上真实尺寸', /--svg-icon-size:\s*22px/.test(wrapper.getAttribute('style') || ''), true);
check('后代的 fill 已被剥离（好继承根节点）', [...svg1.querySelectorAll('*')].map(e => e.getAttribute('fill')), [null, null]);

// ---------- 只改颜色 ----------
// 这是抓回归的关键一段：旧实现下 wrapper 没有颜色、真值写在 svg 上且不会重写，
// 所以「颜色变了」和「没有重注入」必须同时成立。
console.log('\nB. 只改 fill（模拟切换选中项）');
await render({ fill: 'var(--color-text-secondary)', size: 22 });
const svg2 = document.querySelector('#root svg');
check('没有重新注入：svg 还是同一个节点', svg2 === svg1, true);
check('没有重新注入：请求次数没涨', xhrCount, 1);
check('svg 根节点仍是 currentColor', svg2.getAttribute('fill'), 'currentColor');
check('wrapper 的颜色已跟着 props 更新', /color:\s*var\(--color-text-secondary\)/.test(wrapper.getAttribute('style') || ''), true);
check('wrapper 上不再残留旧颜色', /76,\s*175,\s*80|#4CAF50/i.test(wrapper.getAttribute('style') || ''), false);

// ---------- 只改尺寸 ----------
console.log('\nC. 只改 size');
await render({ fill: 'var(--color-text-secondary)', size: 30 });
check('没有重新注入：svg 还是同一个节点', document.querySelector('#root svg') === svg1, true);
check('wrapper 的尺寸已跟着 props 更新', /--svg-icon-size:\s*30px/.test(wrapper.getAttribute('style') || ''), true);

// ---------- 改 url 应当重新注入 ----------
console.log('\nD. 改 url（这才应该重新注入）');
await render({ url: '/other.svg', fill: 'var(--color-text-secondary)', size: 30 });
check('换了 src 会重新请求', xhrCount, 2);

  console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
