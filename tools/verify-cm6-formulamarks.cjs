/**
 * 公式编辑器标记规则的【差分验证】：真实 CM5 编辑器上跑原始逻辑 ↔ 新的纯函数模块，逐用例比区间。
 *
 * 这是 CM5 → CM6 第 2 步（FunctionEditor）的核心保障。那个类里 5 条标记/校验规则
 * （字段引用、中文标点、括号未闭合、错误结尾、缺分隔符）是公式编辑器的全部校验逻辑，
 * 生产在用（字段公式、动态默认值、自定义事件条件、工作流公式共 5 个入口）。
 * 它们原来的实现依赖 CM5 的 editor.getTokenAt() 来判断「是否在字符串里」，
 * 也就是依赖那份 vendored 的 JS 分词器；新实现改成自己扫字符串区间。
 * 所以光测新代码没意义——必须证明【两者给出同样的区间】。
 *
 * 做法：起一个真实的 CM5 编辑器（连同 Func/lib 下那份 vendored javascript mode，
 * 分词行为与生产完全一致），把原始的 mark 逻辑逐字搬进本文件、但把 markText 换成记录区间；
 * 再跑新模块，比对。差一个字符都会红。
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-cm6-formulamarks.cjs
 *
 * 注意：等 CM5 被彻底删掉之后，这个脚本的「参照物」也就没了。届时应把当时的比对结果
 * 冻结成期望值（或直接删掉本脚本，只留 tools/verify-cm6-functioneditor.cjs 那份行为测试）。
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
  'getComputedStyle',
  'DOMParser',
  'Range',
  'Selection',
  'MutationObserver',
  'DOMRect',
  'Event',
  'KeyboardEvent',
  'Window',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom 不做布局：CM5 的 hasBadBidiRects / cursorCoords 会直接调 Range 与元素的
// getBoundingClientRect / getClientRects，缺了就抛。这里给零尺寸的空实现。
// 我们只用 CM5 的【分词器与文档模型】（getTokenAt / getLine / indexFromPos），
// 不依赖任何测量结果，所以零尺寸不影响本脚本的判据。
const zeroRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
const emptyRects = Object.assign([], { item: () => null, length: 0 });
dom.window.Range.prototype.getBoundingClientRect = () => zeroRect;
dom.window.Range.prototype.getClientRects = () => emptyRects;
dom.window.Element.prototype.getBoundingClientRect = () => zeroRect;
dom.window.Element.prototype.getClientRects = () => emptyRects;
global._l = (s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), s);
global.md = { global: { Config: {}, SysSettings: {} } };

const babel = require(RW + 'node_modules/@babel/core');
const Module = require('module');

// —— webdev 别名解析。enum.ts 会 import 'src/utils/function-library'，
//    而 webpack 的 resolve.modules 是 [root, src]，别名另有 worksheet / mobile / statistics。
//    这里照同样的规则解析，否则整条 import 图都断在第一个别名上。
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

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (!request.startsWith('.') && !path.isAbsolute(request)) {
    const head = request.split('/')[0];
    const mapped = ALIASES[head] ? request.replace(head, ALIASES[head]) : request;

    for (const base of [RW + mapped, RW + 'src/' + mapped]) {
      const hit = resolveFile(base);

      if (hit) return hit;
    }
  }

  return origResolve.call(this, request, parent, ...rest);
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
// enum.ts 只要 functions 这份纯数据，但它的 import 图会拖进 .less；给个空实现挡住。
Module._extensions['.less'] = m => m._compile('module.exports = {};', 'noop.less');
Module._extensions['.css'] = Module._extensions['.less'];

const FUNC = RW + 'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/';
const { functions } = require(FUNC + 'enum.ts');
const marksMod = require(FUNC + 'common/formulaMarks.ts');

// —— 真实 CM5 编辑器（含 vendored 的 javascript mode / closebrackets / matchbrackets），
//    与生产的构造参数一致。原始逻辑的 getTokenAt 就靠这份分词器。
// CM5 那份 vendored addon 已随本次迁移删除（见提交说明）。所以这里的 CM5 参照物
// 只在【生成 fixture】时需要：从 git 里把它们取到 CM5_LIB 指的目录，再带 --write-fixture 跑一次。
//   FUNC0=src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func
//   mkdir -p /tmp/cm5-lib && for x in javascript closebrackets matchbrackets; do \
//     git show <删除前的提交>:$FUNC0/lib/$x.js > /tmp/cm5-lib/$x.js; done
//   CM5_LIB=/tmp/cm5-lib node tools/verify-cm6-formulamarks.cjs --write-fixture
// 平时（CI / 本地）不带这两样，直接拿冻结好的 fixture 比——这样 CM5 删了之后
// 这份「与 CM5 逐字一致」的保障依然有效。
const WRITE_FIXTURE = process.argv.includes('--write-fixture');
const FIXTURE = RW + 'tools/fixtures/formula-marks-cm5.json';
let CodeMirror = null;

if (WRITE_FIXTURE) {
  const libDir = process.env.CM5_LIB;

  if (!libDir) {
    console.error('--write-fixture 需要 CM5_LIB 指向取回的 CM5 addon 目录，见文件头说明。');
    process.exit(2);
  }

  CodeMirror = require(RW + 'node_modules/codemirror/lib/codemirror.js');
  require(libDir + '/javascript.js').default(CodeMirror);
  require(libDir + '/closebrackets.js').default(CodeMirror);
  require(libDir + '/matchbrackets.js').default(CodeMirror);
}

let editor = null;

if (WRITE_FIXTURE) {
  const keywords = Object.keys(functions).reduce(
    (a, k) => Object.assign(a, { [k]: { type: 'fn', style: 'customFn' } }),
    {},
  );
  editor = CodeMirror(dom.window.document.getElementById('root'), {
    lineWrapping: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    mode: 'text/javascript',
    keywords,
  });
}

// —— 原始 CM5 逻辑，从 FunctionEditor.tsx 逐字搬来，只把 markText 换成记录区间。
function groupMatch(text, matchText) {
  const result = [];
  const regexp = typeof matchText === 'string' ? new RegExp(matchText, 'g') : matchText;
  const lines = text.split('\n');
  lines.forEach((line, lineNum) => {
    let match = regexp.exec(line);

    while (match) {
      result.push({ str: match, start: match.index, end: match.index + match[0].length, line: lineNum });
      match = regexp.exec(line);
    }
  });

  return result;
}
const toOffset = (line, ch) => editor.indexFromPos({ line, ch });

function cm5Marks(value, { type = 'mdfunction', readOnly = false } = {}) {
  editor.setValue(value);
  const out = [];
  const errors = [];

  // markControls
  groupMatch(value, /\$(.+?)\$/g).forEach(m => {
    out.push({ kind: 'control', from: toOffset(m.line, m.start), to: toOffset(m.line, m.end), id: m.str[1] });
  });

  if (type === 'mdfunction' && !readOnly) {
    // markChineseSymbol
    let anyChinese = false;
    groupMatch(value, /[，（）“”]/g).forEach(m => {
      const token = editor.getTokenAt(CodeMirror.Pos(m.line, m.start));

      if (token.type && token.type.includes('string')) return;

      out.push({ kind: 'chinese', from: toOffset(m.line, m.start), to: toOffset(m.line, m.end), text: m.str[0] });
      anyChinese = true;
    });

    // markUnclosedBrackets
    const stack = [];
    const findFunctionName = (line, bracketPos) => {
      let startCh = bracketPos;

      while (startCh > 0) {
        startCh--;

        if (!/[A-Z_]/.test(line[startCh])) {
          startCh++;
          break;
        }
      }

      return startCh < bracketPos ? startCh : null;
    };

    for (let lineNum = 0; lineNum < editor.lineCount(); lineNum++) {
      const line = editor.getLine(lineNum);

      for (let ch = 0; ch < line.length; ch++) {
        const char = line[ch];
        const token = editor.getTokenAt({ line: lineNum, ch: ch + 1 });

        if (token.type && token.type.includes('string')) continue;

        if (char === '(') {
          stack.push({ char: '(', pos: { line: lineNum, ch }, functionStartCh: findFunctionName(line, ch) });
        } else if (char === ')') {
          if (stack.length > 0 && stack[stack.length - 1].char === '(') stack.pop();
        }
      }
    }

    const unclosed = [];

    while (stack.length > 0) unclosed.push(stack.pop());

    unclosed.forEach(u => {
      const startPos = u.functionStartCh !== null ? { line: u.pos.line, ch: u.functionStartCh } : u.pos;
      const from = toOffset(startPos.line, startPos.ch);
      const to = toOffset(u.pos.line, u.pos.ch + 1);
      out.push({ kind: 'unclosed', from, to, text: editor.getRange(startPos, { line: u.pos.line, ch: u.pos.ch + 1 }) });
    });

    // markErrorFunctionEnd
    const badEnd = groupMatch(value, /(,|\+|-|\*|\/)\)/g);
    badEnd.forEach(m => {
      out.push({ kind: 'badEnd', from: toOffset(m.line, m.start), to: toOffset(m.line, m.end) });
    });

    // checkCommaInControls
    const missing = groupMatch(value, /\$(.+?)\$\$(.+?)\$/g);

    if (anyChinese) errors.push('字符错误，请输入英文字符');

    if (unclosed.length) errors.push('函数括号未闭合');

    if (badEnd.length) errors.push('错误的公式结尾');

    if (missing.length) errors.push('缺少分隔符或运算符');
  }

  out.sort((a, b) => a.from - b.from || a.to - b.to);

  return { marks: out, errors };
}

let pass = 0,
  fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + label);

  if (!ok) {
    console.log('        CM5: ' + JSON.stringify(got));
    console.log('        新码: ' + JSON.stringify(want));
  }
}

const CASES = [
  ['空', ''],
  ['单字段', '$ctrl1$'],
  ['两字段带分隔', 'SUM($a$, $b$)'],
  ['两字段缺分隔', 'SUM($a$$b$)'],
  ['错误结尾-逗号', 'SUM(1,)'],
  ['错误结尾-加号', 'SUM(1+)'],
  ['中文括号', 'SUM（1）'],
  ['中文逗号', 'SUM(1，2)'],
  ['中文引号', 'CONCAT(“a”)'],
  ['中文标点在字符串内（不应标记）', 'CONCAT("a，b")'],
  ['中文括号在字符串内（不应标记）', 'CONCAT("（）")'],
  ['未闭合-单层', 'SUM(1'],
  ['未闭合-嵌套', 'IF(AND($a$, 1), "x"'],
  ['未闭合-多个', 'SUM(AVG(1'],
  ['未闭合-无函数名', '(1'],
  ['括号内字符串含右括号', 'CONCAT(")")'],
  ['转义引号', 'CONCAT("a\\"b，c")'],
  ['多行', 'SUM(\n  $a$,\n  $b$\n)'],
  ['多行未闭合', 'SUM(\n  $a$'],
  ['运算符混排', '$a$ + $b$ * 2 - 1'],
  ['小写函数名', 'sum(1)'],
  ['嵌套多层齐全', 'IF(AND(GT($a$,1), LT($b$,2)), "y", "n")'],
  ['只有右括号', '1)'],
  ['字段名含空格', '$a b$'],
  ['单引号字符串里的中文逗号', "CONCAT('a，b')"],
];

// 参照值来源：--write-fixture 时现跑真实 CM5，平时读冻结好的 fixture。
const fixture = WRITE_FIXTURE ? { cases: {} } : JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const fixtureKey = (name, opts) => name + '|' + opts.type + '|' + (opts.readOnly ? 'ro' : 'rw');

function reference(name, text, opts) {
  const key = fixtureKey(name, opts);

  if (WRITE_FIXTURE) {
    const r = cm5Marks(text, opts);
    fixture.cases[key] = r;

    return r;
  }

  const hit = fixture.cases[key];

  if (!hit) {
    console.error('fixture 里缺用例：' + key + '（新增用例需重新生成 fixture，见文件头）');
    process.exit(3);
  }

  return hit;
}

console.log(
  WRITE_FIXTURE ? 'A. 现跑真实 CM5 生成 fixture' : 'A. 冻结的 CM5 结果（fixture）↔ 新纯函数模块（mdfunction，非只读）',
);
for (const [name, text] of CASES) {
  const opts = { type: 'mdfunction', readOnly: false };
  const a = reference(name, text, opts);
  const b = marksMod.computeFormulaMarks(text, opts);
  // 新模块多了 fnName 一类（替代 CM5 靠 mode keywords 染色的部分），比对时剔掉
  const bMarks = b.marks.filter(m => m.kind !== 'fnName');
  check(name + ' — 区间', a.marks, bMarks);
  check(name + ' — 错误', a.errors, b.errors);
}

console.log('\nB. 只读与 javascript 模式下应只保留字段标记');
for (const [name, text] of [
  ['只读', 'SUM（1，'],
  ['javascript', 'SUM（1，'],
]) {
  const opts = name === '只读' ? { type: 'mdfunction', readOnly: true } : { type: 'javascript', readOnly: false };
  const a = reference(name, text, opts);
  const b = marksMod.computeFormulaMarks(text, opts);
  check(
    name + ' — 区间',
    a.marks,
    b.marks.filter(m => m.kind !== 'fnName'),
  );
  check(name + ' — 错误', a.errors, b.errors);
}

console.log('\nC. 新增的函数名高亮（替代 CM5 的 mode keywords 染色，无 CM5 参照物）');
{
  const r = marksMod.computeFormulaMarks('SUM(1) + NOPE(2)', { type: 'mdfunction' });
  const fn = r.marks.filter(m => m.kind === 'fnName');
  check('识别出两个函数名', fn.length, 2);
  check('SUM 是已知函数', fn[0] && fn[0].known, true);
  check('NOPE 是未知函数', fn[1] && fn[1].known, false);
  const inStr = marksMod.computeFormulaMarks('CONCAT("SUM(")', { type: 'mdfunction' });
  check(
    '字符串里的函数名不高亮',
    inStr.marks.filter(m => m.kind === 'fnName').map(m => m.from),
    [0],
  );
}

if (WRITE_FIXTURE) {
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(
    FIXTURE,
    JSON.stringify(
      {
        _note:
          '由真实 CM5（含已删除的 Func/lib vendored 分词器）跑出的参照值，用于在 CM5 删掉之后' +
          '继续守住「新实现与 CM5 逐字一致」。重新生成方式见 tools/verify-cm6-formulamarks.cjs 文件头。',
        generatedFrom: 'codemirror ' + require(RW + 'node_modules/codemirror/package.json').version,
        cases: fixture.cases,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    '\n  已写入 fixture：' + FIXTURE.replace(RW, '') + '（' + Object.keys(fixture.cases).length + ' 个用例）',
  );
}

console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
