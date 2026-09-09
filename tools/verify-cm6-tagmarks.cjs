/**
 * TagTextarea 标记位置的【差分验证】：真实 CM5 的 indexFromPos ↔ 新的纯函数模块。
 *
 * 这是 CM5 → CM6 第 3 步（TagTextarea）的核心保障。CM5 的 markText 收 {line, ch}，
 * CM6 的 Decoration 收全文绝对 offset；换坐标系错了不会报错，只会让 tag 画偏，
 * 而 TagTextarea 有 26 个消费方（工作流各节点、动态默认值、水印、外链、统计计算字段…），
 * 靠肉眼一个个看是不现实的。所以把坐标换算抽成 tagMarks.ts 并在这里逐字比对。
 *
 * 三段判据：
 *   A. 字段 tag 的区间必须与 CM5 逐字一致
 *   B. 操作符区间在【剔掉落进 tag 内部的那些】之后必须与 CM5 逐字一致
 *   C. 那批被剔掉的，必须恰好等于「落在 tag 内部的操作符」，且结果集无重叠
 *      —— 这是本次迁移唯一一处刻意的行为差异，理由见 tagMarks.ts：
 *      字段名允许含 `-` `/` `,` `.`（insertColumnTag 生成的就是 `$控件id-1$`），
 *      CM5 的 markText 容忍区间重叠，CM6 的 RangeSetBuilder 会直接抛异常。
 *   D. FORMULA / DATE 模式的输入字符白名单过滤与 CM5 beforeChange 逐字一致
 *
 * 运行方式（jsdom 不是本仓依赖，而本仓【不能用 npm install】——react-motion@0.5.2 的
 * peer 冲突会让 npm ERESOLVE 硬失败。所以把 jsdom 装到仓库外再用环境变量指过来）：
 *
 *   mkdir -p /tmp/jsdom-for-verify && cd /tmp/jsdom-for-verify \
 *     && echo '{"private":true}' > package.json && npm i jsdom
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-cm6-tagmarks.cjs
 *
 * CM5 删掉之后参照物就没了，所以带 --write-fixture 跑一次把结果冻结下来
 *（和 verify-cm6-formulamarks.cjs 同一套办法）：
 *   JSDOM_PATH=... node tools/verify-cm6-tagmarks.cjs --write-fixture
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
// jsdom 不做布局。CM5 的 hasBadBidiRects / cursorCoords 会直接调 Range 与元素的
// getBoundingClientRect / getClientRects，缺了就抛（而且是在 rAF 里抛，
// 表现为「断言全绿但其实什么都没跑」——这个坑在前两步踩过）。给零尺寸空实现。
// 本脚本只用 CM5 的【文档模型】（setValue / indexFromPos），不依赖任何测量结果。
const zeroRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
const emptyRects = Object.assign([], { item: () => null, length: 0 });
dom.window.Range.prototype.getBoundingClientRect = () => zeroRect;
dom.window.Range.prototype.getClientRects = () => emptyRects;
dom.window.Element.prototype.getBoundingClientRect = () => zeroRect;
dom.window.Element.prototype.getClientRects = () => emptyRects;

const babel = require(RW + 'node_modules/@babel/core');
const Module = require('module');

function compileTs(module, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [
      [RW + 'node_modules/@babel/preset-env', { targets: { node: 'current' } }],
      [RW + 'node_modules/@babel/preset-typescript', { onlyRemoveTypeImports: true }],
    ],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module._compile(code, filename);
}
Module._extensions['.ts'] = compileTs;

const marks = require(RW + 'src/ming-ui/components/TagTextarea/tagMarks.ts');

const WRITE_FIXTURE = process.argv.includes('--write-fixture');
const FIXTURE = RW + 'tools/fixtures/tag-marks-cm5.json';
let editor = null;

if (WRITE_FIXTURE) {
  const CodeMirror = require(RW + 'node_modules/codemirror/lib/codemirror.js');
  editor = CodeMirror(dom.window.document.getElementById('root'), { lineWrapping: true });
}

// —— 原始 CM5 逻辑，从 TagTextarea.tsx 的 markColumns / markOperators 逐字搬来，
//    只把 markText 换成记录区间（并用 CM5 自己的 indexFromPos 换算成 offset）。
function getRePosFromStrCm5(text = '', re = /\$[^ \r\n[\](){}!@%^&*+=]+?\$/g) {
  const lines = text.split('\n');
  const positions = [];
  let m;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    while ((m = re.exec(l)) !== null) {
      positions.push({ line: i, start: m.index, stop: m.index + m[0].length, tag: m[0].substring(1, m[0].length - 1) });
    }
  }

  return positions;
}

function cm5Marks(value, withOperators) {
  editor.setValue(value);
  const at = (line, ch) => editor.indexFromPos({ line, ch });
  const out = [];
  const tagPoss = getRePosFromStrCm5(value);
  tagPoss.forEach((pos, i) => {
    out.push({ from: at(pos.line, pos.start), to: at(pos.line, pos.stop), kind: 'tag', tag: pos.tag, isLast: i === tagPoss.length - 1 });
  });

  if (withOperators) {
    getRePosFromStrCm5(value, /\+|-|\*|\/|\(|\)|,/g).forEach(pos => {
      const from = at(pos.line, pos.start);
      const to = at(pos.line, pos.stop);
      out.push({ from, to, kind: 'operator', tag: value.slice(from, to), isLast: false });
    });
  }

  out.sort((a, b) => a.from - b.from || a.to - b.to);

  return out;
}

// —— 原始 CM5 beforeChange 里的字符过滤，逐字搬来
function cm5Sanitize(text, mode, isPaste) {
  if (mode === 'formula') {
    return text
      .toUpperCase()
      .split('')
      .filter(t => (isPaste ? /[0-9A-Z+\-*/(),.$]/ : /[0-9A-Z+\-*/(),.]/).test(t))
      .join('');
  }

  if (mode === 'date') {
    return text
      .split('')
      .filter(t => (isPaste ? /[0-9YMdhm+\-$]/ : /[0-9YMdhm+-]/).test(t))
      .join('');
  }

  return text;
}

let pass = 0;
let fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + label);

  if (!ok) {
    console.log('        参照: ' + JSON.stringify(got));
    console.log('        新码: ' + JSON.stringify(want));
  }
}

const CASES = [
  ['空', ''],
  ['纯文本', 'hello world'],
  ['单字段', '$ctrl1$'],
  ['字段前后有文字', 'a$ctrl1$b'],
  ['两个字段', '$a$ 和 $b$'],
  ['字段名含短横（insertColumnTag 的实际形状）', '$67f0a1b2c3-1$'],
  ['两个含短横的字段', '$node1-field1$ + $node2-field2$'],
  ['字段名含点', '$a.b$'],
  ['字段名含斜杠', '$a/b$'],
  ['字段名含逗号', '$a,b$'],
  ['公式带运算符', '$a$ + $b$ * 2 - 1'],
  ['括号与逗号', 'SUM($a$, $b$)'],
  ['多行', '第一行 $a$\n第二行 $b$'],
  ['多行含短横字段', '$x-1$\n$y-5$\n$z-9$'],
  ['空行开头', '\n$a$'],
  ['连续空行', '$a$\n\n\n$b$'],
  ['行尾字段', 'abc\n$a$'],
  ['未闭合的 $', '$abc'],
  ['孤立 $', 'a $ b'],
  ['相邻字段无分隔', '$a$$b$'],
  ['纯运算符', '+-*/(),'],
  ['日期偏移', '$a$+3d'],
  ['中文夹字段', '你好$字段名$世界'],
  ['emoji 夹字段（代理对，offset 按 UTF-16 计）', '🙂$a$🙂'],
];

const fixture = WRITE_FIXTURE ? { cases: {} } : JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const key = (name, withOperators) => name + '|' + (withOperators ? 'ops' : 'noops');

function reference(name, text, withOperators) {
  const k = key(name, withOperators);

  if (WRITE_FIXTURE) {
    const r = cm5Marks(text, withOperators);
    fixture.cases[k] = r;

    return r;
  }

  const hit = fixture.cases[k];

  if (!hit) {
    console.error('fixture 里缺用例：' + k + '（新增用例需重新生成 fixture，见文件头）');
    process.exit(3);
  }

  return hit;
}

const overlaps = (a, b) => a.from < b.to && a.to > b.from;

console.log(WRITE_FIXTURE ? 'A/B/C. 现跑真实 CM5 生成 fixture' : 'A. 字段 tag 区间（应与 CM5 逐字一致）');
for (const [name, text] of CASES) {
  for (const withOperators of [false, true]) {
    const cm5 = reference(name, text, withOperators);
    const now = marks.computeTagMarks(text, { withOperators });
    const suffix = name + (withOperators ? '（含操作符）' : '');

    // A：tag 区间必须完全一致
    check(
      'A ' + suffix,
      cm5.filter(m => m.kind === 'tag'),
      now.filter(m => m.kind === 'tag'),
    );

    if (!withOperators) continue;

    const cm5Tags = cm5.filter(m => m.kind === 'tag');
    const cm5Ops = cm5.filter(m => m.kind === 'operator');
    // B：操作符区间在剔掉落进 tag 内部的那些之后也必须完全一致
    check(
      'B ' + suffix,
      cm5Ops.filter(op => !cm5Tags.some(t => overlaps(op, t))),
      now.filter(m => m.kind === 'operator'),
    );
    // C：被剔掉的恰好是落在 tag 内部的操作符；且新结果集内部无重叠（CM6 的硬要求）
    const dropped = cm5Ops.filter(op => cm5Tags.some(t => overlaps(op, t)));
    check(
      'C ' + suffix + ' — 剔除数',
      dropped.length,
      cm5Ops.length - now.filter(m => m.kind === 'operator').length,
    );
    const bad = now.filter((m, i) => i > 0 && overlaps(now[i - 1], m));
    check('C ' + suffix + ' — 结果无重叠', bad, []);
  }
}

console.log('\nD. 输入字符白名单过滤（应与 CM5 beforeChange 逐字一致）');
for (const [mode, samples] of [
  ['formula', ['abc', 'ABC', '1+2', 'a-b', '你好', 'SUM(1,2)', '$a$', 'a.5', 'A/B', '  ', 'x*y']],
  ['date', ['3d', '3D', '1Y2M', 'abc', '你好', '+5', '-5', '$a$', 'h30m', 'YMdhm']],
]) {
  for (const s of samples) {
    for (const isPaste of [false, true]) {
      check(
        `D ${mode} ${JSON.stringify(s)}${isPaste ? ' 粘贴' : ''}`,
        cm5Sanitize(s, mode, isPaste),
        marks.sanitizeInput(s, { mode, isPaste }),
      );
    }
  }
}

console.log('\nE. 换行符的 offset 换算（CM6 的 doc 与 JS 字符串一样把 \\n 计一个字符）');
{
  check('行首偏移', marks.lineStartOffsets('ab\ncde\n\nf'), [0, 3, 7, 8]);
  check('单行无换行', marks.lineStartOffsets('abc'), [0]);
  check('空串', marks.lineStartOffsets(''), [0]);
}

if (WRITE_FIXTURE) {
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(
    FIXTURE,
    JSON.stringify(
      {
        _note:
          '由真实 CM5（indexFromPos）跑出的参照值，用于在 CM5 删掉之后继续守住' +
          '「新的 offset 换算与 CM5 的 line/ch 逐字等价」。重新生成方式见 tools/verify-cm6-tagmarks.cjs 文件头。',
        generatedFrom: 'codemirror ' + require(RW + 'node_modules/codemirror/package.json').version,
        cases: fixture.cases,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('\n  已写入 fixture：' + FIXTURE.replace(RW, '') + '（' + Object.keys(fixture.cases).length + ' 个用例）');
}

console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
