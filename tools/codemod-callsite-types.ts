/**
 * 用【调用点】把没标注的形参类型推出来（TS7006）
 *
 * TS 对泛型函数会从实参推类型，对普通函数不会 —— 形参没标注就是隐式 any，
 * 哪怕全仓每个调用点传进去的都是 string。这个工具把 TS 本来就有能力算、
 * 只是不会去算的那一步补上：扫全程序的调用点，取第 i 个实参的类型求并集。
 *
 * 这是【真推断】，不是按名字猜：证据就是代码里实际传了什么。
 * 与 codemod-name-consensus-types.ts 互补 —— 那个靠命名约定，覆盖的是回调形参
 *（没有调用点）；这个靠调用点，覆盖的是普通函数。两边的适用面几乎不重叠。
 *
 * 【这是 tools/codemod-callsite-param-types.ts 的 TS 7 重写版】
 * 老版本按 5.9 的 ts.createProgram 写，升级后跑不起来了。判据沿用，实现按
 * tools/ts7.ts 的适配层重做。老文件保留作为记录，不要直接改它。
 *
 * ── 判据（每一条都是老版本踩出来的）────────────────────────────────────────
 * · 【至少 2 个调用点】只有 1 个的话，那个实参本身可能也是隐式 any，
 *   等于拿一个未知去定义另一个未知。
 * · 【只写得出可移植的类型】checker 打印的类型名可能是别的文件里的本地类型，
 *   直接写进源码就是未定义标识符。只接受白名单里的原始类型及其数组。
 * · 【任何一个调用点传 any 就整个跳过】说明这个位置本来就什么都可能进来。
 * · 【不碰】已有标注 / 解构形参 / rest 形参 / 有默认值的 / 声明不在 src 下的。
 * · 【插入点在 questionToken 之后】写成 `foo: string?` 是 TS17019，
 *   会把整个签名毁掉，然后在所有调用点吐出莫名其妙的 "Expected N arguments"。
 * · 【无括号单参箭头要连括号一起补】`x => …` 直接标注就是语法错。
 *   左括号的位置用诊断给的 pos（那就是标识符自身的起点），不要往回扫 ——
 *   往回找 `(` 会撞上外层的 useCallback(。
 *
 * 用法：
 *   node tools/codemod-callsite-types.ts --list
 *   node tools/codemod-callsite-types.ts
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject, usageFits, writeSource } = require('./ts7.ts');

const APPLY = !process.argv.includes('--list');
const MIN_CALLSITES = 2;

/** 只有这些能跨文件照抄 —— 不依赖任何 import */
const PORTABLE = new Set(['string', 'number', 'boolean', 'string[]', 'number[]', 'boolean[]']);

const project = openProject('tsconfig.strictprobe.json');
const checker = project.checker;
const SRC = path.join(ROOT, 'src') + path.sep;

// ── 第一遍：扫全程序的调用点，按「被调函数的声明 + 形参下标」收集实参类型 ──
/**
 * key 用【文件路径 + 节点 index】。这一条踩了两次才对：
 *
 * 1. 先用「被调函数声明的 pos + 形参下标」—— 对不上。`const f = (a) => {}` 的
 *    valueDeclaration 是【变量声明】不是箭头函数，pos 差一大截，全仓一条都没匹配上。
 * 2. 改走 getResolvedSignature().getParameters() 拿形参符号，再读它的声明 ——
 *    仍然 0。因为 TS 7 里这个声明是个【惰性句柄】：自有键只有
 *    `{ canonicalProject, kind, path, index }`，name / pos / end / forEachChild
 *    全是 undefined，它并没有被物化。
 * 3. 但 path 就是文件路径、index 就是节点在该文件里的下标，而【物化后的节点也带
 *    同一个 index】—— 实测句柄的 index 能在本文件里解析回正确的形参名。
 *    所以直接拿 `path|index` 当身份，两边都不需要物化。
 */
const argTypes = new Map<string, Set<string>>();
const callCount = new Map<string, number>();
const dirty = new Set<string>();

function keyOf(filePath: string, nodeIndex: number): string {
  return `${String(filePath).toLowerCase()}|${nodeIndex}`;
}

project.eachSrcFile(({ node }: any) => {
  (function walk(n: any) {
    if (is.isCallExpression(n) && n.expression && n.arguments) {
      let params: any[] | null = null;
      try {
        const sig = checker.getResolvedSignature(n);
        params = sig ? sig.getParameters() : null;
      } catch {
        params = null;
      }
      if (params && params.length) {
        n.arguments.forEach((arg: any, i: number) => {
          const psym = params![i];
          const pdecl = psym && psym.valueDeclaration;
          // 句柄没物化，只有 path/index 可用，见上面的说明
          if (!pdecl || !pdecl.path || pdecl.index === undefined) return;
          if (!String(pdecl.path).toLowerCase().startsWith(SRC.toLowerCase())) return;
          const k = keyOf(pdecl.path, pdecl.index);
          callCount.set(k, (callCount.get(k) || 0) + 1);
          let s = '';
          try {
            s = checker.typeToString(checker.getTypeAtLocation(arg));
          } catch {
            s = 'any';
          }
          // 实参本身是 any / 空串 / 联合里带 any 的，一律判脏：这个位置什么都可能进来
          if (!s || s === 'any' || /\bany\b/.test(s)) {
            dirty.add(k);
            return;
          }
          if (!argTypes.has(k)) argTypes.set(k, new Set());
          argTypes.get(k)!.add(s);
        });
      }
    }
    n.forEachChild(walk);
  })(node);
});

// ── 第二遍：按 TS7006 定位待标注的形参，查它有没有可用的调用点证据 ──────────
type Target = { fileName: string; text: string; pos: number; name: string; type: string; openParenAt?: number };
const targets: Target[] = [];
const skip = { noEvidence: 0, dirty: 0, tooFew: 0, notPortable: 0, mixed: 0, hasDefault: 0, notFound: 0, usageMismatch: 0 };

const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => d.code === 7006 && d.fileName && d.fileName.startsWith(SRC));

const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;
  const text: string = sf.text;

  // 诊断的 pos..end 圈的是标识符本身，用 name.end 当键（node.pos 含前导 trivia）
  const paramAt = new Map<number, { p: any; fn: any; index: number }>();
  (function walk(n: any) {
    const params = n.parameters;
    if (params && params.length) {
      params.forEach((p: any, i: number) => {
        if (is.isParameterDeclaration(p) && p.name && is.isIdentifier(p.name)) {
          paramAt.set(p.name.end, { p, fn: n, index: i });
        }
      });
    }
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    const hit = paramAt.get(d.end);
    if (!hit) {
      skip.notFound += 1;
      continue;
    }
    const { p, fn, index } = hit;
    if (p.dotDotDotToken || p.initializer) {
      skip.hasDefault += 1;
      continue;
    }

    const k = keyOf(fileName, p.index);
    if (dirty.has(k)) {
      skip.dirty += 1;
      continue;
    }
    const set = argTypes.get(k);
    if (!set || !set.size) {
      skip.noEvidence += 1;
      continue;
    }
    if ((callCount.get(k) || 0) < MIN_CALLSITES) {
      skip.tooFew += 1;
      continue;
    }
    // 【不并集】并起来写进去只会让下游读取更难受（老版本踩过：string | ApiResult
    // 这种并集，下游 .abort() 当场报错）。只接受所有调用点一致的情况。
    if (set.size > 1) {
      skip.mixed += 1;
      continue;
    }
    const type = [...set][0];
    if (!PORTABLE.has(type)) {
      skip.notPortable += 1;
      continue;
    }

    // 【这一处的用法也要过一遍】调用点一致只说明「传进来的是什么」，
    // 说明不了函数体怎么用它。实测漏网两例：
    //   resolveType(type, props) 体里有 `typeof type === 'function'`，它不止是 string
    //   dataSortFun(columnName, source) 里 source 被当对象读属性
    if (fn && !usageFits(fn, p.name.text, type)) {
      skip.usageMismatch += 1;
      continue;
    }

    const pos = p.questionToken ? p.questionToken.end : p.name.end;
    // 无括号单参箭头：左括号插在标识符起点（= 诊断的 pos），别往回扫
    const parent = p.parent;
    const isParenless =
      parent &&
      is.isArrowFunction(parent) &&
      parent.parameters &&
      parent.parameters.length === 1 &&
      !text.slice(parent.pos, p.name.pos).includes('(');

    targets.push(
      isParenless
        ? { fileName, text, pos, name: p.name.text, type, openParenAt: d.pos }
        : { fileName, text, pos, name: p.name.text, type },
    );
  }
}

// ── 报告与应用 ────────────────────────────────────────────────────────────
const byType = new Map<string, number>();
for (const t of targets) byType.set(t.type, (byType.get(t.type) || 0) + 1);
console.log('按推出来的类型分布：');
for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(12)} ${n} 处`);

const fileCount = new Set(targets.map(t => t.fileName)).size;
console.log(
  `\n${APPLY ? '已标' : '可标'} ${targets.length} 处，涉及 ${fileCount} 个文件；` +
    `其中补括号的单参箭头 ${targets.filter(t => t.openParenAt !== undefined).length} 处\n` +
    `跳过：没有调用点证据 ${skip.noEvidence} / 有调用点传 any ${skip.dirty} / ` +
    `调用点少于 ${MIN_CALLSITES} 个 ${skip.tooFew} / 各调用点类型不一致 ${skip.mixed} / ` +
    `类型不可移植 ${skip.notPortable} / 本处用法与类型不符 ${skip.usageMismatch} / 有默认值或 rest ${skip.hasDefault} / 定位不到 ${skip.notFound}`,
);

if (APPLY && targets.length) {
  const edits = new Map<string, { text: string; list: { pos: number; text: string }[] }>();
  for (const t of targets) {
    if (!edits.has(t.fileName)) edits.set(t.fileName, { text: t.text, list: [] });
    const list = edits.get(t.fileName)!.list;
    if (t.openParenAt !== undefined) {
      list.push({ pos: t.openParenAt, text: '(' });
      list.push({ pos: t.pos, text: `: ${t.type})` });
    } else {
      list.push({ pos: t.pos, text: `: ${t.type}` });
    }
  }
  for (const [fileName, bucket] of edits) writeSource(fileName, bucket.text, bucket.list);
  console.log(`已写入 ${edits.size} 个文件。`);
}

project.close();
