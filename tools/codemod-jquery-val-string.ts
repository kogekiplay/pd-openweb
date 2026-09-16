/**
 * 给 `$(x).val()` 的结果补一次显式的字符串化（jQuery 类型收窄后的连带修）
 *
 * 【起因】types/global.d.ts 把 `$` 从 any 收窄到 JQueryStatic 之后，`.val()` 的
 * 真实返回类型露出来了：`string | number | string[] | undefined`（JQuery.d.ts:12850，
 * 【不】随元素类型泛型化，所以给选择器标 HTMLInputElement 也没用）。
 * 本仓 75 处都是直接当字符串使的 —— `.val().trim()`、`.val().length`、
 * 或者原样传给形参是 string 的函数。
 *
 * 【改成什么】`String(<原表达式> ?? '')`
 *   · 值是字符串时 String(s) === s，运行期【逐字节不变】；
 *   · 选择器没匹配到元素时 .val() 给 undefined，原来 `.trim()` 当场抛 TypeError，
 *     现在得到 ''。这是行为变化，但方向是"崩溃 -> 空串"。
 *
 * 【一个必须说清的边界】`<select multiple>` 的 .val() 返回 string[]。
 * 对这种元素，原代码 `.val().trim()` 本来就会抛（数组没有 trim），
 * 而包上 String() 之后会变成 "a,b" 这样的逗号串 —— 从"崩溃"变成"拼起来"。
 * 两种都不是对的语义，但本工具【只改被 TS 指出来的、代码本身已经当字符串用的点】，
 * 也就是原作者的意图就是单值。真有多选的地方应该显式写 `.val() as string[]`，
 * 那属于逐个看的活，不在本工具范围。
 *
 * 【为什么不用 as string 断言】断言是"我知道它一定是 string"，可它真可能是 undefined；
 * 那是假的确定性，而且断言不改运行期，undefined 照样抛。String(?? '') 是如实转换。
 *
 * 用法：
 *   node tools/codemod-jquery-val-string.ts --list
 *   node tools/codemod-jquery-val-string.ts
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject, writeSource } = require('./ts7.ts');

const APPLY = !process.argv.includes('--list');
const SRC = path.join(ROOT, 'src') + path.sep;
/** .val() 的联合返回类型在诊断文本里的样子 */
const UNION = /string \| number \| string\[\]/;

const project = openProject('tsconfig.gate.json');

const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => d.fileName && d.fileName.startsWith(SRC) && UNION.test(d.text || ''));

const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

/** 这个节点是不是 `<something>.val()`（无参调用 —— 有参的是 setter，返回 this，不受影响） */
function isValGetter(n: any): boolean {
  return (
    n &&
    is.isCallExpression(n) &&
    (!n.arguments || n.arguments.length === 0) &&
    n.expression &&
    is.isPropertyAccessExpression(n.expression) &&
    n.expression.name &&
    is.isIdentifier(n.expression.name) &&
    n.expression.name.text === 'val'
  );
}

type Edit = { fileName: string; text: string; start: number; end: number };
const edits: Edit[] = [];
const seen = new Set<string>();
const skip = { notVal: 0, alreadyWrapped: 0 };

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;
  const text: string = sf.text;

  // 索引：属性访问的 name 位置 -> 属主；以及所有实参节点的范围
  const ownerByPropEnd = new Map<number, any>();
  const nodesByRange = new Map<string, any>();
  (function walk(n: any) {
    if (is.isPropertyAccessExpression(n) && n.name) ownerByPropEnd.set(n.name.end, n.expression);
    if (n.pos !== undefined && n.end !== undefined) nodesByRange.set(`${n.pos}|${n.end}`, n);
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    // 形态一：`X.val().trim()` —— 诊断落在 trim 上，属主就是那个 .val() 调用
    let target = ownerByPropEnd.get(d.end);

    // 形态二：`foo(X.val())` —— 诊断圈的就是实参本身
    if (!isValGetter(target)) {
      let cand: any = null;
      for (const [k, n] of nodesByRange) {
        const [p, e] = k.split('|').map(Number);
        // 诊断范围可能带前导 trivia，用「包含且最贴合」来找
        if (p <= d.pos && d.end <= e && isValGetter(n)) {
          if (!cand || e - p < cand.end - cand.pos) cand = n;
        }
      }
      target = cand;
    }

    if (!isValGetter(target)) {
      skip.notVal += 1;
      continue;
    }

    const start = target.getStart ? target.getStart(sf) : target.pos;
    const realStart = text.slice(target.pos, target.end).search(/\S/) + target.pos;
    const s = realStart;
    const e = target.end;
    const key = `${fileName}|${s}|${e}`;
    if (seen.has(key)) continue;
    // 已经被包过的不重复包
    if (/String\(\s*$/.test(text.slice(Math.max(0, s - 8), s))) {
      skip.alreadyWrapped += 1;
      continue;
    }
    seen.add(key);
    edits.push({ fileName, text, start: s, end: e });
  }
}

// ── 报告与应用 ────────────────────────────────────────────────────────────
const fileCount = new Set(edits.map(e => e.fileName)).size;
console.log(
  `${APPLY ? '已包' : '可包'} ${edits.length} 处 .val()，涉及 ${fileCount} 个文件；` +
    `跳过：定位不到 .val() ${skip.notVal} / 已经包过 ${skip.alreadyWrapped}`,
);
for (const e of edits.slice(0, 8)) {
  const line = e.text.slice(0, e.start).split('\n').length;
  console.log(`  ${path.relative(ROOT, e.fileName)}:${line}  ${e.text.slice(e.start, e.end)}`);
}

if (APPLY && edits.length) {
  const byF = new Map<string, { text: string; list: { pos: number; text: string }[] }>();
  for (const e of edits) {
    if (!byF.has(e.fileName)) byF.set(e.fileName, { text: e.text, list: [] });
    const l = byF.get(e.fileName)!.list;
    l.push({ pos: e.start, text: 'String(' });
    l.push({ pos: e.end, text: " ?? '')" });
  }
  for (const [fileName, bucket] of byF) writeSource(fileName, bucket.text, bucket.list);
  console.log(`已写入 ${byF.size} 个文件。`);
}

project.close();
