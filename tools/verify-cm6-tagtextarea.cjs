/**
 * TagTextarea（CM6 版）的集成验证：真实挂载组件，验「纯函数测不到」的那一层。
 *
 * 分工：
 *   tools/verify-cm6-tagmarks.cjs —— 标记【区间计算】，已用真实 CM5 差分锁死（165 项）
 *   本文件                        —— 区间怎么被翻成 Decoration、对外的 offset 方法、
 *                                    输入拦截（原 beforeChange）、onChange 事件对象形状
 *
 * 为什么必须真实挂载：这些都在 CM6 的状态/扩展体系里，静态读代码看不出来——
 * StateField 是否随 doc 重算、Decoration.replace 是否真把 `$id$` 换成了标签、
 * transactionFilter 的取消/改写是否生效、光标在插入后落在正确的一侧
 * （CM6 默认映射到插入内容【之前】，第 2 步在 insertTag 上踩过这个坑）。
 *
 * 输入模拟用 view.dispatch 带 userEvent 注解，而不是合成键盘事件：CM6 的输入走
 * contenteditable + beforeinput，jsdom 里驱不动；但 transactionFilter 看到的东西
 * 与真实输入完全一样（就是带 userEvent 的事务），所以这一层测得是真的。
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-cm6-tagtextarea.cjs
 *
 * 【明确不在覆盖范围内】都依赖真实浏览器：
 *   1. 真实按键、输入法组合（compositionend 的时序）、粘贴
 *   2. 真实布局测量 —— jsdom 里尺寸恒为 0。M 段把 clientHeight 打成桩，
 *      验的只是阈值判断与类/高度切换那段逻辑；「量出来的数对不对」要真机看
 *     （已核对：60 行纯文本会封顶到默认的 500px）
 *   3. placeholder / 光标颜色 / 行号等纯样式表现
 */
const fs = require('fs');
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
  'Text',
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
  'Window',
  'HTMLDivElement',
  'HTMLStyleElement',
  'HTMLCollection',
  'NodeList',
  // syncHeight 的下一帧补量要用；jsdom 在 pretendToBeVisual 下提供这两个
  'requestAnimationFrame',
  'cancelAnimationFrame',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom 不做布局；CM6 的测量路径会直接调这些，缺了就在 rAF 里静默抛
//（表现为「断言全绿但其实什么都没跑」，很误导）
const zeroRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
const emptyRects = Object.assign([], { item: () => null, length: 0 });
dom.window.Range.prototype.getBoundingClientRect = () => zeroRect;
dom.window.Range.prototype.getClientRects = () => emptyRects;
dom.window.Element.prototype.getClientRects = () => emptyRects;
global.IS_REACT_ACT_ENVIRONMENT = true;
// 每个字段标签的 widget 都在 toDOM 里 createRoot + render，而 toDOM 是 CM6 在自己的
// 视图更新周期里调的，天生落在 act() 作用域之外——这是「CM6 拥有 DOM、React 只负责
// 往 widget 里填内容」这个设计的必然结果，不是测试写错了。这类警告每个标签刷一条，
// 会把真正的 FAIL 淹掉，所以只压这一条，其它 React 警告照旧透出来。
const origWarn = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('was not wrapped in act')) return;

  origWarn(...args);
};
global._l = (s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), s);
global.md = { global: { Config: {}, SysSettings: {} } };

const babel = require(RW + 'node_modules/@babel/core');
const Module = require('module');
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx'];
const ALIASES = { worksheet: 'src/pages/worksheet', mobile: 'src/pages/Mobile', statistics: 'src/pages/Statistics' };

function resolveFile(base) {
  for (const ext of EXTS) {
    const c = base + ext;

    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }

  for (const ext of EXTS.filter(Boolean)) {
    const c = path.join(base, 'index' + ext);

    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }

  return null;
}

// TagTextarea 只从 ming-ui/antd-components 取一个 Tooltip（而且只在 rightIcon 时用到），
// 但那个桶的 import 图会一路拖进整个 ming-ui + antd，在 jsdom 里又慢又脆。换成最小桩。
// 【这意味着 rightIcon 那颗按钮的 Tooltip 表现没有被验证】，它是纯展示，要人工看。
fs.mkdirSync('/tmp/cm6-tt-stubs', { recursive: true });
fs.writeFileSync(
  '/tmp/cm6-tt-stubs/antdComponents.js',
  "const React = require('" + RW + "node_modules/react');\n" + 'exports.Tooltip = ({ children }) => children;\n',
);
// 按【请求字符串】打桩，而不是按解析后的路径：`ming-ui/antd-components` 这个请求
// 在真实构建里根本到不了 webpack —— .babelrc 的 babel-plugin-import 会先把它改写成
// `ming-ui/antd-components/Tooltip`（libraryDirectory: ''），所以那个目录压根没有
// index 文件。本 harness 用的是 babelrc: false，裸请求就漏了出来，直接解析必然失败。
const REQUEST_STUBS = { 'ming-ui/antd-components': '/tmp/cm6-tt-stubs/antdComponents.js' };

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  let resolved = null;

  if (REQUEST_STUBS[request]) return REQUEST_STUBS[request];

  if (!request.startsWith('.') && !path.isAbsolute(request)) {
    const head = request.split('/')[0];
    const mapped = ALIASES[head] ? request.replace(head, ALIASES[head]) : request;

    for (const base of [RW + mapped, RW + 'src/' + mapped]) {
      const hit = resolveFile(base);

      if (hit) {
        resolved = hit;
        break;
      }
    }
  }

  if (!resolved) resolved = origResolve.call(this, request, parent, ...rest);

  return resolved;
};

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
Module._extensions['.less'] = m => m._compile('module.exports = {};', 'noop.less');
Module._extensions['.css'] = Module._extensions['.less'];

const _ = require(RW + 'node_modules/lodash');
const React = require(RW + 'node_modules/react');
const { createRoot } = require(RW + 'node_modules/react-dom/client');
const { act } = require(RW + 'node_modules/react');
const TT = RW + 'src/ming-ui/components/TagTextarea/';
const TagTextarea = require(TT + 'TagTextarea.tsx').default;
const { MODE } = require(TT + 'enum.ts');

let pass = 0;
let fail = 0;
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

const CONTROLS = { c1: '数量', c2: '单价', '67f0a1b2c3-1': '带短横的字段' };
const settle = () => new Promise(r => setTimeout(r, 10));

async function mount(props = {}) {
  const host = document.createElement('div');
  document.getElementById('root').appendChild(host);
  const changes = [];
  let inst = null;
  const root = createRoot(host);
  await act(async () => {
    root.render(
      React.createElement(TagTextarea, {
        getRef: r => (inst = r),
        renderTag: id => React.createElement('span', { className: 'tagName' }, CONTROLS[id] || id),
        onChange: (err, value, obj) => changes.push({ value, origin: obj && obj.origin, obj }),
        ...props,
      }),
    );
  });
  // 编辑器是异步 import 进来的，等一拍
  await act(async () => {
    await settle();
  });

  return { inst, host, changes, unmount: () => act(() => root.unmount()) };
}

const contentText = host => {
  const c = host.querySelector('.cm-content');

  return c ? c.textContent : null;
};
// 用带 userEvent 注解的事务模拟输入 —— transactionFilter 看到的与真实输入一致
const typeAt = (inst, text, at, userEvent = 'input.type') =>
  inst.view.dispatch({
    changes: { from: at, to: at, insert: text },
    selection: { anchor: at + text.length },
    userEvent,
  });

async function main() {
  // ---------- A. 挂载与 DOM ----------
  console.log('A. 挂载');
  {
    const { inst, host, unmount } = await mount({ defaultValue: 'hello' });
    check('渲染出 CM6 的 .cm-editor', !!host.querySelector('.cm-editor'), true);
    check('defaultValue 进入文档', inst.getValue(), 'hello');
    check('DOM 里有内容', contentText(host), 'hello');
    check('暴露 offset 方法', typeof inst.getCursor, 'function');
    check('暴露 CM6 view 逃生口', !!inst.view, true);
    unmount();
    check('unmount 后 view 被销毁', inst.view, null);
    check('unmount 后 .cm-editor 移除', !host.querySelector('.cm-editor'), true);
  }

  // ---------- B. 字段引用 → 标签 widget ----------
  console.log('\nB. 字段标签（Decoration.replace + widget）');
  {
    const { inst, host, unmount } = await mount({ defaultValue: '$c1$' });
    await settle();
    check('原始 $c1$ 文本已被替换', contentText(host).includes('$c1$'), false);
    check('渲染出 .columnTagCon', host.querySelectorAll('.columnTagCon').length, 1);
    check('renderTag 的结果进了 DOM', contentText(host).includes('数量'), true);

    // doc 一变装饰就重算 —— CM5 的命令式 clear+markText 换成 StateField 之后最该验的一条
    inst.setValue('$c2$');
    await settle();
    check('换字段后标签跟着换', contentText(host).includes('单价'), true);
    check('旧字段名不残留', contentText(host).includes('数量'), false);

    inst.setValue('纯文本');
    await settle();
    check('没有字段引用时不留标签', host.querySelectorAll('.columnTagCon').length, 0);

    inst.setValue('$c1$ 和 $c2$');
    await settle();
    check('两个字段两个标签', host.querySelectorAll('.columnTagCon').length, 2);
    unmount();
  }

  // ---------- C. 含短横的字段名（CM6 的 RangeSetBuilder 硬要求）----------
  // insertColumnTag 生成的就是 `$控件id-1$`，而操作符正则会匹配到里面那个 `-`，
  // 产生一个落在 tag 区间【内部】的区间。CM5 的 markText 容忍重叠，
  // CM6 的 RangeSetBuilder 会直接抛「Ranges must be added sorted」。
  // tagMarks 里剔掉了这类，这里验它在真实 view 上确实不炸。
  console.log('\nC. 含短横的字段名 + 操作符标记（重叠区间）');
  {
    let threw = null;
    let host = null;
    let inst = null;
    let unmount = null;

    try {
      const m = await mount({ defaultValue: '$67f0a1b2c3-1$', mode: MODE.FORMULA, operatorsSetMargin: true });
      host = m.host;
      inst = m.inst;
      unmount = m.unmount;
      await settle();
    } catch (e) {
      threw = String(e && e.message);
    }

    check('挂载不抛异常', threw, null);
    check('标签正常渲染', host && contentText(host).includes('带短横的字段'), true);
    check('tag 内部的 - 没有被单独标成操作符', host && host.querySelectorAll('.operator').length, 0);

    inst.setValue('$a-1$ + $b-2$');
    await settle();
    check('两个含短横字段 + 一个真操作符', host.querySelectorAll('.columnTagCon').length, 2);
    check('只标出 tag 外面那个 +', host.querySelectorAll('.operator').length, 1);
    check('操作符文本正确', host.querySelector('.operator').textContent, '+');
    unmount();
  }

  // ---------- D. 操作符标记 ----------
  console.log('\nD. 操作符标记（FORMULA / DATE / operatorsSetMargin 才有）');
  {
    const a = await mount({ defaultValue: '1+2*3', mode: MODE.FORMULA });
    await settle();
    check('FORMULA 下标出操作符', a.host.querySelectorAll('.operator').length, 2);
    a.unmount();

    const b = await mount({ defaultValue: '1+2*3', mode: MODE.TEXT });
    await settle();
    check('TEXT 下不标操作符', b.host.querySelectorAll('.operator').length, 0);
    b.unmount();

    const c = await mount({ defaultValue: '1+2*3', mode: MODE.TEXT, operatorsSetMargin: true });
    await settle();
    check('operatorsSetMargin 下也标', c.host.querySelectorAll('.operator').length, 2);
    c.unmount();
  }

  // ---------- E. 对外 offset 方法（15 个消费方在用，原来是 cmObj 上的 CM5 句柄）----------
  console.log('\nE. 对外 offset 方法（原 cmObj 句柄）');
  {
    const { inst, unmount } = await mount({ defaultValue: 'ab\ncde\nf' });
    const cm = inst;
    check('getValue', cm.getValue(), 'ab\ncde\nf');
    check('lineCount', cm.lineCount(), 3);
    check('lineAt(0) 第一行', _.pick(cm.lineAt(0), ['line', 'ch', 'text']), { line: 0, ch: 0, text: 'ab' });
    check('lineAt(7) 第三行', _.pick(cm.lineAt(7), ['line', 'ch', 'text']), { line: 2, ch: 0, text: 'f' });
    check('lineAt 越界被夹住', _.pick(cm.lineAt(999), ['line', 'text']), { line: 2, text: 'f' });
    check('lineAt(5) 给出行列', _.pick(cm.lineAt(5), ['line', 'ch']), { line: 1, ch: 2 });
    check('lineAt(3) 是第二行行首', _.pick(cm.lineAt(3), ['line', 'ch']), { line: 1, ch: 0 });
    check('lineAt 带 from/to/text', _.pick(cm.lineAt(5), ['from', 'to', 'text']), { from: 3, to: 6, text: 'cde' });

    cm.setCursor(5);
    check('setCursor / getCursor 往返（offset）', cm.getCursor(), 5);
    cm.setCursor(999);
    check('setCursor 超出被夹到文末', cm.getCursor(), 8);
    cm.setCursor(-5);
    check('setCursor 负数被夹到 0', cm.getCursor(), 0);
    check('滚动位置可读写', cm.getScrollPos(), { left: 0, top: 0 });
    unmount();
  }

  // ---------- F. replaceRange 的光标一侧（CM6 默认会落在插入内容【之前】）----------
  console.log('\nF. replaceRange / insertColumnTag 的光标位置');
  {
    const { inst, changes, unmount } = await mount({ defaultValue: 'ab' });
    const cm = inst;
    cm.replaceRange('XY', 1, undefined, 'insertfield');
    await settle();
    check('replaceRange 插在正确位置', cm.getValue(), 'aXYb');
    check('光标落在插入内容之后', cm.getCursor(), 3);
    check('origin 透传给 onChange', changes[changes.length - 1].origin, 'insertfield');

    // ch: 3 而不是 4 —— 'aXYb' 一共 4 个字符，to=4 就是文末，那样测不出 to 有没有被尊重
    cm.replaceRange('Z', 0, 3, 'insertfn');
    await settle();
    check('带 to 的 replaceRange 做替换（尾字符保留）', cm.getValue(), 'Zb');
    check('替换后光标落在插入内容之后', cm.getCursor(), 1);
    unmount();
  }

  {
    const { inst, changes, unmount } = await mount({ defaultValue: '' });
    inst.insertColumnTag('c1');
    await settle();
    check('insertColumnTag 插入 $id$', inst.getValue(), '$c1$');
    check('光标落在插入内容之后', inst.getCursor(), 4);
    check('origin 为 inserttag', changes[changes.length - 1].origin, 'inserttag');

    inst.insertColumnTag('c2');
    await settle();
    check('连续插入不反序（无 autoComma）', inst.getValue(), '$c1$$c2$');
    unmount();
  }

  {
    const { inst, unmount } = await mount({ defaultValue: '$c1$', mode: MODE.FORMULA, autoComma: true });
    inst.setCursor(4);
    inst.insertColumnTag('c2');
    await settle();
    check('紧挨 $ 时自动补逗号', inst.getValue(), '$c1$,$c2$');
    unmount();
  }

  // ---------- G. 输入拦截（原 beforeChange）----------
  console.log('\nG. 输入拦截（原 beforeChange → transactionFilter）');
  {
    const { inst, unmount } = await mount({ defaultValue: '', mode: MODE.ONLYTAG });
    typeAt(inst, 'abc', 0);
    await settle();
    check('ONLYTAG 拒绝普通输入', inst.getValue(), '');

    inst.insertColumnTag('c1');
    await settle();
    check('ONLYTAG 允许 inserttag', inst.getValue(), '$c1$');

    inst.view.dispatch({ changes: { from: 0, to: 4, insert: '' }, userEvent: 'delete.backward' });
    await settle();
    check('ONLYTAG 允许删除', inst.getValue(), '');

    inst.setValue('$c2$');
    await settle();
    check('ONLYTAG 允许 setValue', inst.getValue(), '$c2$');
    unmount();
  }

  {
    const { inst, unmount } = await mount({ defaultValue: '', mode: MODE.FORMULA });
    typeAt(inst, 'a', 0);
    await settle();
    check('FORMULA 把输入转大写', inst.getValue(), 'A');

    typeAt(inst, '你', 1);
    await settle();
    check('FORMULA 过滤掉中文', inst.getValue(), 'A');
    check('被整段过滤后光标不动', inst.getCursor(), 1);

    typeAt(inst, '+1', 1);
    await settle();
    check('FORMULA 放行数字与运算符', inst.getValue(), 'A+1');
    check('过滤后光标落在插入之后', inst.getCursor(), 3);

    typeAt(inst, '$', 3);
    await settle();
    check('FORMULA 非粘贴时过滤 $', inst.getValue(), 'A+1');

    typeAt(inst, '$x$', 3, 'input.paste');
    await settle();
    check('FORMULA 粘贴时保留 $（并转大写）', inst.getValue(), 'A+1$X$');
    unmount();
  }

  {
    const { inst, unmount } = await mount({ defaultValue: '', mode: MODE.DATE });
    typeAt(inst, '3d', 0);
    await settle();
    check('DATE 放行 3d（不转大写）', inst.getValue(), '3d');

    typeAt(inst, 'abc', 2);
    await settle();
    check('DATE 过滤掉 abc', inst.getValue(), '3d');

    typeAt(inst, '1Y2M', 2);
    await settle();
    check('DATE 放行 YMdhm', inst.getValue(), '3d1Y2M');
    unmount();
  }

  {
    const { inst, unmount } = await mount({ defaultValue: 'abc', mode: MODE.TEXT });
    typeAt(inst, '你好', 3);
    await settle();
    check('TEXT 模式不过滤任何字符', inst.getValue(), 'abc你好');
    unmount();
  }

  // ---------- H. onChange 事件对象（CM5 形状，工作流公式在读）----------
  console.log('\nH. onChange 的事件对象形状');
  {
    const { inst, changes, unmount } = await mount({ defaultValue: 'ab', mode: MODE.TEXT });
    changes.length = 0;

    typeAt(inst, 'X', 2);
    await settle();
    check('触发了一次 onChange', changes.length, 1);
    check('value 正确', changes[0].value, 'abX');
    check('origin 为 +input', changes[0].origin, '+input');
    check('text 是按行切开的数组', changes[0].obj.text, ['X']);
    check('removed 为空行', changes[0].obj.removed, ['']);
    check('from 是绝对 offset', changes[0].obj.from, 2);
    check('to 是绝对 offset', changes[0].obj.to, 2);

    changes.length = 0;
    inst.view.dispatch({ changes: { from: 0, to: 1, insert: '' }, userEvent: 'delete.backward' });
    await settle();
    check('删除的 origin 为 +delete', changes[0].origin, '+delete');
    check('删除的 removed 带被删文本', changes[0].obj.removed, ['a']);

    changes.length = 0;
    typeAt(inst, 'PQ', 0, 'input.paste');
    await settle();
    check('粘贴的 origin 为 paste', changes[0].origin, 'paste');

    changes.length = 0;
    inst.setValue('zzz');
    await settle();
    check('setValue 不触发 onChange（与 CM5 一致）', changes.length, 0);

    changes.length = 0;
    inst.view.dispatch({ changes: { from: 0, to: 3, insert: 'k' }, userEvent: 'undo' });
    await settle();
    check('undo 的 origin 为 undo', changes[0].origin, 'undo');
    check('多行插入 text 按行切', (typeAt(inst, 'p\nq', 0), await settle(), changes[changes.length - 1].obj.text), [
      'p',
      'q',
    ]);
    unmount();
  }

  // ---------- I. updateTextareaView 强制重画 ----------
  console.log('\nI. updateTextareaView（props 变了但文档没变时强制重画）');
  {
    let name = '旧名字';
    const host = document.createElement('div');
    document.getElementById('root').appendChild(host);
    let inst = null;
    const root = createRoot(host);
    await act(async () => {
      root.render(
        React.createElement(TagTextarea, {
          getRef: r => (inst = r),
          defaultValue: '$c1$',
          renderTag: () => React.createElement('span', null, name),
        }),
      );
    });
    await act(async () => {
      await settle();
    });
    check('初始渲染用旧名字', contentText(host).includes('旧名字'), true);

    name = '新名字';
    check('只改闭包不重画时仍是旧名字', contentText(host).includes('旧名字'), true);

    await act(async () => {
      inst.updateTextareaView();
      await settle();
    });
    check('updateTextareaView 后换成新名字', contentText(host).includes('新名字'), true);
    check('旧名字不残留', contentText(host).includes('旧名字'), false);
    await act(() => root.unmount());
  }

  // ---------- J. setValue 同值也要重画 ----------
  console.log('\nJ. setValue 同值时的重画（CM5 的副作用）');
  {
    let name = '甲';
    const host = document.createElement('div');
    document.getElementById('root').appendChild(host);
    let inst = null;
    const root = createRoot(host);
    await act(async () => {
      root.render(
        React.createElement(TagTextarea, {
          getRef: r => (inst = r),
          defaultValue: '$c1$',
          renderTag: () => React.createElement('span', null, name),
        }),
      );
    });
    await act(async () => {
      await settle();
    });
    name = '乙';
    await act(async () => {
      inst.setValue('$c1$');
      await settle();
    });
    check('setValue 同值仍触发重画', contentText(host).includes('乙'), true);
    check('光标没被打回原点（同值时不做全文替换）', inst.getValue(), '$c1$');
    await act(() => root.unmount());
  }

  // ---------- K. 只读 ----------
  console.log('\nK. 只读');
  {
    const { inst, host, unmount } = await mount({ defaultValue: '$c1$', readonly: true });
    await settle();
    check('只读下字段仍渲染成标签', contentText(host).includes('数量'), true);
    check(
      '只读下仍可聚焦选中（contenteditable 不关）',
      host.querySelector('.cm-content').getAttribute('contenteditable'),
      'true',
    );
    check('noCursor 类挂上（靠 CSS 藏光标）', !!host.querySelector('.tagInputareaIuput.noCursor'), true);
    // 这两条是【机制断言】而不是行为断言：CM6 拦真实输入的位置在 DOMChange
    // （"Ignore changes when the editor is read-only"）和 handlers.paste/drop/cut 里，
    // 都在 contenteditable 的输入通道上，jsdom 里驱不动。而直接 view.dispatch 是
    // 【不受 readOnly 约束】的——CM5 的 readOnly 也一样，只读控件的内容本来就是
    // 靠代码 setValue 填进去的。所以这里验 facet 生效 + CM6 自己的只读标记。
    check('readOnly facet 生效', inst.view.state.readOnly, true);
    check('CM6 打上 aria-readonly', host.querySelector('.cm-content').getAttribute('aria-readonly'), 'true');

    inst.replaceRange('x', 0, undefined, 'setValue');
    await settle();
    check('只读下代码仍可写入（与 CM5 一致）', inst.getValue(), 'x$c1$');
    unmount();
  }

  // ---------- L. 原子区间 ----------
  console.log('\nL. 原子区间（方向键/删除把标签当整体）');
  {
    const { inst, unmount } = await mount({ defaultValue: 'a$c1$b' });
    await settle();
    const { EditorSelection } = require(RW + 'node_modules/@codemirror/state');
    // 'a$c1$b' 的偏移：a=0、$=1、c=2、1=3、$=4、b=5，标签占区间 [1,5)。
    // moveByChar 会尊重 atomicRanges：从标签左边界(1)往右一步应直接落到右边界(5)，
    // 而不是逐字符走到 2。
    check('从标签左侧右移一步跳过整个标签', inst.view.moveByChar(EditorSelection.cursor(1), true).head, 5);
    check('再右移一步走过 b', inst.view.moveByChar(EditorSelection.cursor(5), true).head, 6);
    check('从标签右侧左移一步跳回左边界', inst.view.moveByChar(EditorSelection.cursor(5), false).head, 1);
    unmount();
  }

  // ---------- M. maxHeight 封顶 ----------
  // jsdom 不做布局，clientHeight 恒为 0，所以这里把 .cm-content 的 clientHeight
  // 打成可控的桩，验的是【阈值判断 + 类/内联高度的切换】这段逻辑本身。
  // 真实测量已在浏览器里核对过：60 行纯文本会被封顶到 500px（不传 maxHeight 时的默认值）。
  console.log('\nM. maxHeight 封顶（clientHeight 打桩，只验判断逻辑）');
  {
    const { inst, host, unmount } = await mount({ defaultValue: 'x', maxHeight: 100 });
    await settle();
    const content = host.querySelector('.cm-content');
    let fake = 0;
    Object.defineProperty(content, 'clientHeight', { get: () => fake, configurable: true });
    const con = host.querySelector('.tagInputareaIuput');

    fake = 50;
    inst.syncHeight();
    check('未到阈值：保留 autoHeight', con.classList.contains('autoHeight'), true);
    check('未到阈值：高度 auto', con.style.height, 'auto');

    fake = 98; // 恰好等于 maxHeight - 2，应判为已达
    inst.syncHeight();
    check('恰好到阈值：去掉 autoHeight', con.classList.contains('autoHeight'), false);
    check('恰好到阈值：高度固定', con.style.height, '100px');

    fake = 97;
    inst.syncHeight();
    check('回落到阈值下：恢复 auto', con.style.height, 'auto');

    // rAF 补量：标签内容是 React 异步填的，同步那一次量不到，靠下一帧补
    fake = 50;
    inst.syncHeight();
    fake = 300; // 模拟「React 把标签填完之后高度才涨上来」
    inst.scheduleHeightSync();
    check('scheduleHeightSync 同步那次先按当前值判', con.style.height, '100px');
    fake = 50;
    inst.scheduleHeightSync();
    check('同一帧内重复调用只排一次 rAF', typeof inst.heightRaf, 'number');
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    check('下一帧补量后按新值判', con.style.height, 'auto');
    check('rAF 句柄已清空', inst.heightRaf, null);

    inst.scheduleHeightSync();
    unmount();
    check('unmount 取消未触发的 rAF（不留悬空回调）', inst.heightRaf, null);
  }

  console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
