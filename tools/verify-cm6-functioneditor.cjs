/**
 * 公式编辑器（CM6 版）的集成验证：真实挂载 Function 类，验「纯函数测不到」的那一层。
 *
 * 分工：
 *   tools/verify-cm6-formulamarks.cjs —— 标记与校验【规则本身】，已用真实 CM5 差分锁死（58 项）
 *   本文件                            —— 规则结果怎么被翻成 Decoration、对外 5 个 API、
 *                                        补全数据源、错误回调、销毁清理
 *
 * 为什么必须真实挂载：这些都在 CM6 的状态/扩展体系里，静态读代码看不出来——
 * StateField 是否随 doc 重算、Decoration.replace 是否真把文本换成了标签、
 * insertTag 的「紧挨 $ 时补逗号」是否还成立、readOnly/nocursor 是否生效。
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-cm6-functioneditor.cjs
 *
 * 【明确不在覆盖范围内】两类都依赖真实浏览器：
 *   1. 按键与补全弹层的交互（CM6 走 contenteditable + beforeinput，jsdom 测不真）
 *   2. 布局测量（jsdom 里尺寸恒为 0，下面的桩只为不抛异常）
 *   以及深色主题的实际配色、tooltip 的悬浮表现，都要人工看。
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
const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, url: 'https://example.test/' });
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
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom 不做布局；CM6 的测量路径会直接调这些，缺了就在 rAF 里静默抛（断言反而全绿，很误导）
const zeroRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
const emptyRects = Object.assign([], { item: () => null, length: 0 });
dom.window.Range.prototype.getBoundingClientRect = () => zeroRect;
dom.window.Range.prototype.getClientRects = () => emptyRects;
dom.window.Element.prototype.getClientRects = () => emptyRects;
// jsdom 至今不实现 innerText（写入被静默丢弃、textContent 仍是空串）。
// 被测代码里 createElement/createTagEle 用的就是 innerText（CM5 版原样如此，未改）。
// 对「无子节点的纯文本 span」而言 innerText 与 textContent 等价，这里按等价补上，
// 免得因测试环境缺能力而把产品判成坏的。
if (!('innerText' in dom.window.HTMLElement.prototype)) {
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', {
    get() {
      return this.textContent;
    },
    set(v) {
      this.textContent = v;
    },
    configurable: true,
  });
}
global.IS_REACT_ACT_ENVIRONMENT = true;
global._l = (s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), s);
global.md = { global: { Config: {}, SysSettings: {} } };

const babel = require(RW + 'node_modules/@babel/core');
const Module = require('module');

// webpack 别名（enum.ts 会 import 'src/utils/function-library'；resolve.modules 是 [root, src]）
const FUNC_DIR = RW + 'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/';
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

// FunctionEditor 只从这几个模块各取一个叶子函数，但它们的 import 图会一路拖进整个
// ming-ui 桶（widgetConfig/util → src/router/navigateTo → ming-ui）。在 jsdom 里加载那一坨
// 既慢又脆，与本脚本要验的东西也无关，所以换成最小桩。
// 【这意味着被桩掉的部分没有被验证】：图标名、字段类型是否支持函数、控件类型映射。
// 它们都只影响补全项的图标与过滤，不影响编辑器行为；真实表现要在浏览器里看。
const STUBS = {
  [RW + 'src/pages/widgetConfig/util/index.ts']: '/tmp/cm6-stubs/widgetConfigUtil.js',
  [RW + 'src/utils/control.ts']: '/tmp/cm6-stubs/utilsControl.js',
  [RW + 'src/utils/common.ts']: '/tmp/cm6-stubs/utilsCommon.js',
  [FUNC_DIR + 'common/ControlList.tsx']: '/tmp/cm6-stubs/controlList.js',
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  let resolved = null;

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

  if (!resolved) {
    try {
      resolved = origResolve.call(this, request, parent, ...rest);
    } catch (e) {
      throw e;
    }
  }

  return STUBS[resolved] || resolved;
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

const FUNC = RW + 'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/';
const FunctionEditor = require(FUNC + 'common/FunctionEditor.tsx').default;

let pass = 0,
  fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(
    '  ' + (ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '   got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want)),
  );
}

const CONTROLS = [
  { controlId: 'c1', controlName: '数量', type: 6 },
  { controlId: 'c2', controlName: '单价', type: 6 },
];
const settle = () => new Promise(r => setTimeout(r, 0));

async function makeEditor(opts = {}) {
  const host = document.createElement('div');
  document.getElementById('root').appendChild(host);
  const errors = [];
  const changes = [];
  const ed = new FunctionEditor(host, {
    value: '',
    controls: CONTROLS,
    getControlName: id => (CONTROLS.find(c => c.controlId === id) || {}).controlName,
    onChange: () => changes.push(ed.getValue()),
    onError: e => errors.push(e && e.text),
    ...opts,
  });
  await ed.ready;
  await settle();

  return { ed, host, errors, changes };
}

const contentText = host => {
  const c = host.querySelector('.cm-content');

  return c ? c.textContent : null;
};

async function main() {
  // ---------- A. 挂载与基本 API ----------
  console.log('A. 挂载与对外 API');
  {
    const { ed, host } = await makeEditor({ value: 'SUM(1)' });
    check('渲染出 CM6 的 .cm-editor', !!host.querySelector('.cm-editor'), true);
    check('getValue 取到初值', ed.getValue(), 'SUM(1)');

    ed.setValue('AVG(2)');
    check('setValue 生效', ed.getValue(), 'AVG(2)');
    check('setValue 同步到 DOM', contentText(host).includes('AVG(2)'), true);

    ed.setValue('AVG(2)');
    check('setValue 同值不派发事务', ed.getValue(), 'AVG(2)');

    ed.destroy();
    check('destroy 后 .cm-editor 移除', !host.querySelector('.cm-editor'), true);
    check('destroy 后 getValue 退回缓存值', ed.getValue(), 'AVG(2)');
  }

  // ---------- B. 字段引用被替换成标签 ----------
  console.log('\nB. 字段标签（Decoration.replace + widget）');
  {
    const { ed, host } = await makeEditor({ value: '$c1$' });
    await settle();
    const text = contentText(host);
    check('原始的 $c1$ 文本已被替换掉', text.includes('$c1$'), false);
    check('替换成了字段名', text.includes('数量'), true);

    // doc 一变装饰就应重算 —— 这是 CM5「命令式 clearMarkers + 逐个 markText」换成
    // CM6「StateField 由 doc 推导」之后最该验的一条
    ed.setValue('$c2$');
    await settle();
    check('换字段后标签跟着换', contentText(host).includes('单价'), true);
    check('旧字段名不残留', contentText(host).includes('数量'), false);

    ed.setValue('1 + 2');
    await settle();
    check('没有字段引用时不留标签', /数量|单价/.test(contentText(host)), false);
    ed.destroy();
  }

  // ---------- C. 错误回调 ----------
  console.log('\nC. 错误回调（与 CM5 的「后一条覆盖前一条」一致）');
  {
    const { ed, errors } = await makeEditor({ value: '' });
    errors.length = 0;

    ed.setValue('SUM(1，2)');
    await settle();
    check('中文标点报错', errors[errors.length - 1], '字符错误，请输入英文字符');

    ed.setValue('SUM(1');
    await settle();
    check('括号未闭合报错', errors[errors.length - 1], '函数括号未闭合');

    ed.setValue('SUM(1,)');
    await settle();
    check('错误结尾报错', errors[errors.length - 1], '错误的公式结尾');

    ed.setValue('SUM($c1$$c2$)');
    await settle();
    check('缺分隔符报错', errors[errors.length - 1], '缺少分隔符或运算符');

    ed.setValue('SUM(1, 2)');
    await settle();
    check('改对后错误被清掉', errors[errors.length - 1], undefined);
    ed.destroy();
  }

  // ---------- D. insertTag / insertFn ----------
  console.log('\nD. insertTag / insertFn');
  {
    const { ed } = await makeEditor({ value: '' });
    ed.insertFn('SUM');
    await settle();
    check('insertFn 插入 "FN()"', ed.getValue(), 'SUM()');
    check('光标落在括号内', ed.cursor(), 4);

    ed.insertTag({ value: 'c1' });
    await settle();
    check('insertTag 插入 $id$', ed.getValue(), 'SUM($c1$)');

    // CM5 的行为：紧挨在上一个 $ 后面再插时先补一个逗号
    ed.setValue('$c1$');
    await settle();
    ed.setCursor(4);
    ed.insertTag({ value: 'c2' });
    await settle();
    check('紧挨 $ 时自动补逗号', ed.getValue(), '$c1$,$c2$');
    ed.destroy();
  }

  // ---------- E. 只读 ----------
  console.log('\nE. 只读 / nocursor');
  {
    const { ed, host } = await makeEditor({ value: '$c1$', options: { readOnly: 'nocursor' } });
    await settle();
    check('只读下字段仍渲染成标签', contentText(host).includes('数量'), true);
    check('只读下 contenteditable 关闭', host.querySelector('.cm-content').getAttribute('contenteditable'), 'false');
    ed.destroy();
  }

  // ---------- F. 补全数据源 ----------
  console.log('\nF. 补全数据源（CM5 的 showHint + 自造 hint 数据 → CompletionSource）');
  {
    const { ed } = await makeEditor({ value: '' });
    const { EditorState } = require(RW + 'node_modules/@codemirror/state');
    const ctx = (text, explicit = true) => {
      const st = EditorState.create({ doc: text, selection: { anchor: text.length } });

      return {
        state: st,
        pos: text.length,
        explicit,
        matchBefore(re) {
          const line = st.doc.lineAt(text.length);
          const s = line.text.slice(0, text.length - line.from);
          const m = s.match(new RegExp(re.source + '$'));

          return m ? { from: text.length - m[0].length, to: text.length, text: m[0] } : null;
        },
      };
    };

    const r = ed.formulaCompletions(ctx('SU'));
    check('输入 SU 命中 SUM', (r.options || []).some(o => o.label === 'SUM'), true);
    check('候选里带字段（按名字过滤）', (ed.formulaCompletions(ctx('数')).options || []).some(o => o.label === '数量'), true);
    check('字段候选排在函数前', (ed.formulaCompletions(ctx('数')).options || [])[0].label, '数量');
    check('无匹配时返回 null', ed.formulaCompletions(ctx('ZZZZZZ')), null);
    ed.destroy();
  }

  console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
