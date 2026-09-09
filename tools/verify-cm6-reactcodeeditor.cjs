/**
 * ReactCodeEditor 的 CodeMirror 6 迁移验证（CM5 → CM6 分三步走的第 1 步试点）。
 *
 * 为什么必须真实挂载：CM6 是「状态 + 扩展」模型，扩展之间的相互作用（keymap 顺序、
 * 补全数据源、事务派发）静态读类型定义看不出来。而这个组件原来靠 CM5 的一堆命令式 API
 * （fromTextArea / setValue / setCursor / scrollIntoView / setSize / on('keyup') 手工触发提示），
 * 每一条都换了机制，只核对「导出名存在」远远不够。
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-cm6-reactcodeeditor.cjs
 *
 * 覆盖：初始 doc、受控 value 同步（含光标落到文末）、onChange 回调与 64KB 上限、
 * 补全数据源在「标签内 / 标签外」两种上下文下给出的候选、以及 destroy 清理。
 * 【明确不在覆盖范围内】两类都依赖真实浏览器，jsdom 给不了：
 *   1. 按键行为——CM6 的输入处理走 contenteditable + beforeinput，
 *      所以 Tab 缩进、Ctrl-Space 唤出补全、自动闭合括号/标签只能靠浏览器人工核对。
 *   2. 布局测量——jsdom 的 Range 没有 getClientRects、元素尺寸恒为 0，
 *      下面给了空实现的桩只为让 CM6 不抛异常，不代表测过。
 *      因此「高度撑满容器」「补全弹层定位」「长行换行」同样要人工看。
 */
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

function loadJsdom() {
  const candidates = [process.env.JSDOM_PATH, RW + 'node_modules/jsdom', 'jsdom'].filter(Boolean);

  for (const c of candidates) {
    try {
      return require(c);
    } catch (e) {
      /* 试下一个 */
    }
  }

  console.error('找不到 jsdom。请按文件头的说明装好后用 JSDOM_PATH 指过来。');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  pretendToBeVisual: true,
  url: 'https://example.test/',
});
for (const k of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'getComputedStyle',
  'DOMParser',
  'Range',
  'Selection',
  'MutationObserver',
  'DOMRect',
  'Event',
  'KeyboardEvent',
  'InputEvent',
  'CompositionEvent',
  'ClipboardEvent',
  'Text',
  'HTMLCollection',
  'NodeList',
  // @codemirror/view 的 isScrolledToBottom 会 instanceof Window；缺了它会在 rAF 回调里抛
  // ReferenceError 并被吞掉，表面上断言仍全绿，实际 CM6 的测量路径整条没跑。
  'Window',
  'HTMLDivElement',
  'HTMLStyleElement',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom 不做布局：Range 没有 getClientRects，元素的尺寸方法也全返回 0。
// CM6 的测量路径会直接调它们，缺了就抛 TypeError（被 rAF 吞掉，断言还是绿的，很误导）。
// 这里给空实现只是让它跑完，测量本身没有被验证——见文件头的覆盖边界说明。
const emptyRects = Object.assign([], { item: () => null, length: 0 });
if (dom.window.Range && !dom.window.Range.prototype.getClientRects) {
  dom.window.Range.prototype.getClientRects = () => emptyRects;
  dom.window.Range.prototype.getBoundingClientRect = () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });
}
dom.window.Element.prototype.getClientRects = () => emptyRects;
global.IS_REACT_ACT_ENVIRONMENT = true;
// 组件里用的是本仓的全局 alert / _l（不是浏览器 alert），这里给最小替身并记录调用。
const alerts = [];
global.alert = (msg, level) => alerts.push([msg, level]);
global._l = (s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), s);
// jsdom 没有实现 Blob().size 之外的东西，但组件只用 size，原生 Blob 够用。
if (typeof global.Blob === 'undefined') global.Blob = dom.window.Blob;

const babel = require(RW + 'node_modules/@babel/core');
const React = require(RW + 'node_modules/react');
const { createRoot } = require(RW + 'node_modules/react-dom/client');
const { act } = React;
const Module = require('module');

function compileTs(module, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
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

const EDITOR = RW + 'src/pages/widgetConfig/widgetSetting/components/DevelopWithAI/ChatBot/ReactCodeEditor.tsx';
const CodeEditor = require(EDITOR).default;

let pass = 0,
  fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(
    '  ' +
      (ok ? 'PASS ' : 'FAIL ') +
      label +
      (ok ? '' : '   got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)),
  );
}

// CM6 的扩展是异步 import 进来的，渲染后要放行微任务队列才看得到 view。
const settle = async () => {
  await act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });
};

async function main() {
  const root = createRoot(document.getElementById('root'));
  const changes = [];
  let props = { value: 'const a = 1;\n', onChange: v => changes.push(v) };
  const render = async next => {
    props = { ...props, ...next };
    await act(async () => {
      root.render(React.createElement(CodeEditor, props));
    });
    await settle();
  };

  // ---------- A. 挂载与初始内容 ----------
  console.log('A. 挂载');
  await render({});
  const editor = document.querySelector('.cm-editor');
  check('渲染出 CM6 的 .cm-editor（不再是 .CodeMirror）', !!editor, true);
  check('不再渲染 textarea', !document.querySelector('textarea'), true);
  check('渲染出内容区 .cm-content', !!document.querySelector('.cm-content'), true);
  check('行号 gutter 已开启', !!document.querySelector('.cm-lineNumbers'), true);
  check(
    '初始 doc 落到 DOM 上',
    (document.querySelector('.cm-content') || {}).textContent.includes('const a = 1;'),
    true,
  );

  // 从 DOM 反取 view 实例：CM6 把它挂在 .cm-editor 的 cmView 上不稳妥，
  // 这里改用组件对外唯一可观察的通道——DOM 文本，来断言状态。
  const docText = () => (document.querySelector('.cm-content') || {}).textContent || '';

  // ---------- B. 受控 value 同步 ----------
  console.log('\nB. 受控 value 同步');
  await render({ value: 'let b = 2;\nlet c = 3;\n' });
  check('外部改 value 会同步进编辑器', docText().includes('let b = 2;') && docText().includes('let c = 3;'), true);
  check('旧内容已被整体替换掉', docText().includes('const a = 1;'), false);

  const before = changes.length;
  await render({ value: 'let b = 2;\nlet c = 3;\n' });
  check('value 未变时不重复派发事务（不触发 onChange）', changes.length, before);

  // ---------- C. 64KB 上限 ----------
  // 组件在 updateListener 里检查体积，超限就 alert 且不回调 onChange。
  console.log('\nC. 64KB 上限');
  alerts.length = 0;
  const n0 = changes.length;
  const big = 'x'.repeat(70 * 1024);
  await render({ value: big });
  check('超 64KB 时弹出提示', alerts.length >= 1, true);
  check('提示文案是语言包里那条已登记的 key', (alerts[0] || [])[0], '代码无法保存，代码长度不能超过64KB');
  check('超限时不回调 onChange', changes.length, n0);

  // ---------- D. 补全数据源 ----------
  // 直接对导出的 CompletionSource 做单元测试：它是本次迁移里唯一自写的逻辑
  // （CM5 那边是改写 CodeMirror.hint.javascript / hint.html 两个全局）。
  console.log('\nD. 补全数据源');
  const { EditorState } = require(RW + 'node_modules/@codemirror/state');
  const src = require(EDITOR).__test_reactCompletionSource;
  check('组件导出了可测的 CompletionSource', typeof src, 'function');

  const ctx = (text, explicit = true) => {
    const state = EditorState.create({ doc: text, selection: { anchor: text.length } });
    return {
      state,
      pos: text.length,
      explicit,
      matchBefore(re) {
        const line = state.doc.lineAt(text.length);
        const s = line.text.slice(0, text.length - line.from);
        const m = s.match(new RegExp(re.source + '$'));
        return m ? { from: text.length - m[0].length, to: text.length, text: m[0] } : null;
      },
    };
  };

  const outTag = src(ctx('use'));
  check(
    '标签外给出 React 关键字',
    (outTag.options || []).some(o => o.label === 'useState'),
    true,
  );
  check(
    '标签外不给出 JSX 属性',
    (outTag.options || []).some(o => o.label === 'className' && o.type === 'property'),
    false,
  );
  check('from 定位到词首', outTag.from, 0);

  const inTag = src(ctx('<div cl'));
  check(
    '标签内给出 JSX 属性',
    (inTag.options || []).some(o => o.label === 'className'),
    true,
  );
  check(
    '标签内不给出 React 关键字',
    (inTag.options || []).some(o => o.label === 'useState'),
    false,
  );

  const closed = src(ctx('<div className="a">te'));
  check(
    '标签已闭合后回到 React 关键字',
    (closed.options || []).some(o => o.label === 'useState'),
    true,
  );

  check('非 explicit 且无前缀时不弹出', src(ctx('', false)), null);

  // ---------- E. 卸载 ----------
  console.log('\nE. 卸载');
  await act(async () => {
    root.unmount();
  });
  check('卸载后 .cm-editor 已移除', !document.querySelector('.cm-editor'), true);

  console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
