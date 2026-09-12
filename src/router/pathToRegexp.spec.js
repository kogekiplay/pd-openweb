/**
 * path-to-regexp 8 的调用约定。
 *
 * 为什么需要这条 spec：这两类错【构建和类型门禁都抓不到】，它们是纯运行时的，
 * 而且 5 个调用点里有 4 个把 match() 写在【模块顶层】—— 一旦构造抛错，不是某个
 * 功能坏掉，是整个模块 import 失败、页面白屏。
 *
 * 守两件事：
 *
 * 1) 可选段必须用 v8 语法。v6 的 `:x?` 在 v8 会【构造时直接抛】
 *    `Unexpected ? at index N`，要写成 `{/:x}`（斜杠写进花括号里）。
 *    6→8 升级时 /orderpay/:orderId/:paymentModule? 和
 *    /integrationConnect/:id?/:tab? 两处就是这么中的。
 *
 * 2) 必须传 { decode: false }。v8 默认用 decodeURIComponent 解参数，v6 不解。
 *    差别不只是「解不解码」：遇到畸形百分号（/invoice/100%off、/invoice/%）
 *    decodeURIComponent 会抛 URIError，把调用方一起带走，而 v6 原样返回字符串。
 *    customNotice 和 systemMessage 匹配的是【消息内容里的 href】，内容用户可控，
 *    一条带 % 的链接就能打断整条通知处理。本仓这些参数全是 ID，本来也不该解码。
 *
 * 扫的是 src/ 全量而不是固定文件清单 —— 新增第 6 个调用点时能自动覆盖到，
 * 不然这条 spec 会随着代码长出去而悄悄失效。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { match } = require('path-to-regexp');
const { parser, ROOT } = require('../../scripts/spec-harness');

const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name) && !/\.spec\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(n => visit(n, fn));
    return;
  }
  if (node.type) fn(node);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue;
    visit(node[k], fn);
  }
}

const callSites = [];

for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, 'utf8');
  // 便宜的预筛：绝大多数文件跟 path-to-regexp 无关，不值得全部过一遍 parser。
  if (!source.includes('path-to-regexp')) continue;

  // spec-harness 的 parser 强制开了 typescript + decorators-legacy，但没开 jsx。
  // 这几个调用点全是 .tsx，不补 jsx 会在第一个标签上抛 UnexpectedToken。
  // 只对 .jsx/.tsx 开：.ts 文件里 jsx 插件会跟泛型/类型断言的 `<T>` 打架。
  const plugins = /\.(jsx|tsx)$/.test(file) ? ['jsx'] : [];
  const ast = parser.parse(source, { sourceType: 'module', errorRecovery: true, plugins });

  // 找出这个文件里 path-to-regexp 的 match 被绑成了什么名字（可能 as 重命名）。
  const localNames = new Set();
  visit(ast.program, node => {
    if (node.type !== 'ImportDeclaration' || node.source.value !== 'path-to-regexp') return;
    for (const s of node.specifiers) {
      if (s.type === 'ImportSpecifier' && s.imported.name === 'match') localNames.add(s.local.name);
    }
  });
  if (!localNames.size) continue;

  visit(ast.program, node => {
    if (node.type !== 'CallExpression') return;
    if (node.callee.type !== 'Identifier' || !localNames.has(node.callee.name)) return;
    callSites.push({ file: path.relative(ROOT, file), node });
  });
}

assert.ok(
  callSites.length > 0,
  'src/ 下一个 path-to-regexp 的 match() 调用都没扫到。要么这条 spec 的扫描逻辑坏了，' +
    '要么 path-to-regexp 已经不再使用 —— 后者的话请连同本 spec 一起删除。',
);

for (const { file, node } of callSites) {
  const [patternArg, optsArg] = node.arguments;

  assert.ok(
    patternArg && patternArg.type === 'StringLiteral',
    `${file}: match() 的 pattern 必须是字面量，否则本 spec 没法在构建前替你验证它。`,
  );
  const pattern = patternArg.value;

  // ── 1) pattern 必须在 v8 下构造得出来 ──────────────────────────────
  assert.doesNotThrow(
    () => match(pattern, { decode: false }),
    `${file}: pattern ${JSON.stringify(pattern)} 在 path-to-regexp 8 下构造失败。` +
      '常见原因是还在用 v6 的可选段语法 `:x?` —— v8 要写成 `{/:x}`（斜杠写进花括号）。' +
      '注意这些 match() 多在模块顶层，构造抛错 = 整个模块 import 失败、页面白屏。',
  );

  // ── 2) 必须显式关掉 decode ────────────────────────────────────────
  const hasDecodeFalse =
    optsArg &&
    optsArg.type === 'ObjectExpression' &&
    optsArg.properties.some(
      p =>
        p.type === 'ObjectProperty' &&
        ((p.key.type === 'Identifier' && p.key.name === 'decode') ||
          (p.key.type === 'StringLiteral' && p.key.value === 'decode')) &&
        p.value.type === 'BooleanLiteral' &&
        p.value.value === false,
    );

  assert.ok(
    hasDecodeFalse,
    `${file}: match(${JSON.stringify(pattern)}) 必须显式传 { decode: false }。` +
      'v8 默认拿 decodeURIComponent 解参数，遇到畸形百分号（如 /x/100%off）会抛 URIError ' +
      '把调用方带崩；v6 是原样返回。本仓这些参数都是 ID，不需要解码。',
  );
}

/* ------------------------------------------------------------------ *
 * 行为断言：把 6→8 升级时实测过的语义钉死。
 * 这些用例覆盖的正是两个版本之间【会变】的地方：可选段、尾斜杠、百分号。
 * ------------------------------------------------------------------ */
const BEHAVIOUR = [
  // 可选段：v6 `:paymentModule?` → v8 `{/:paymentModule}`
  ['/orderpay/:orderId{/:paymentModule}', '/orderpay/123', { orderId: '123' }],
  ['/orderpay/:orderId{/:paymentModule}', '/orderpay/123/wx', { orderId: '123', paymentModule: 'wx' }],
  // 尾斜杠：v6 能匹配且不产出该参数，v8 关掉 decode 后行为一致
  ['/orderpay/:orderId{/:paymentModule}', '/orderpay/123/', { orderId: '123' }],
  ['/orderpay/:orderId{/:paymentModule}', '/orderpay/', false],
  ['/orderpay/:orderId{/:paymentModule}', '/orderpay/123/wx/extra', false],
  // 连续两个可选段
  ['/integrationConnect{/:id}{/:tab}', '/integrationConnect', {}],
  ['/integrationConnect{/:id}{/:tab}', '/integrationConnect/abc', { id: 'abc' }],
  ['/integrationConnect{/:id}{/:tab}', '/integrationConnect/abc/tab1', { id: 'abc', tab: 'tab1' }],
  ['/integrationConnect{/:id}{/:tab}', '/integrationConnect/abc/tab1/x', false],
  // 百分号：decode: false 下原样返回，【不抛】。去掉 decode:false 这三条会变成 URIError。
  ['/invoice/:orderId', '/invoice/100%discount', { orderId: '100%discount' }],
  ['/invoice/:orderId', '/invoice/%', { orderId: '%' }],
  ['/invoice/:orderId', '/invoice/%E4%B8%AD%E6%96%87', { orderId: '%E4%B8%AD%E6%96%87' }],
  // 全 URL 不该匹配（消息里的 href 可能是绝对地址，调用方靠 false 提前返回）
  ['/invoice/:orderId', 'https://oa.example.com/invoice/o1', false],
];

for (const [pattern, input, expected] of BEHAVIOUR) {
  const result = match(pattern, { decode: false })(input);
  if (expected === false) {
    assert.strictEqual(result, false, `match(${JSON.stringify(pattern)})(${JSON.stringify(input)}) 应当不匹配`);
  } else {
    assert.ok(result, `match(${JSON.stringify(pattern)})(${JSON.stringify(input)}) 应当匹配，实际没匹配上`);
    // 展开成普通对象再比：params 是 Object.create(null)，deepStrictEqual 会把
    // 原型差异也算成不相等。v6 和 v8 的 dist 里都是 Object.create(null)，
    // 这一点【没有】跨版本变化，纯粹是断言写法问题。
    assert.deepStrictEqual(
      { ...result.params },
      expected,
      `match(${JSON.stringify(pattern)})(${JSON.stringify(input)}) 的 params 不对`,
    );
  }
}

console.log(
  `path-to-regexp tests passed（${callSites.length} 个调用点，${BEHAVIOUR.length} 条行为断言）`,
);
