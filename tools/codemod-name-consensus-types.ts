/**
 * 按「仓库自己的命名共识」给隐式 any 形参补类型（TS7006）
 *
 * TS7006 占 strict 全量诊断的一半（32174/63828）。前几批已经把「能从调用点测出
 * 类型」和「属于领域名表」的那部分做完了，剩下的大多是回调形参 —— 没有调用点，
 * 也没有上下文类型，checker 给不出任何信息。
 *
 * 【类型从哪来 —— 仍然不猜，只是换了一个测量对象】
 * 不去推断单个形参，而是问整个仓库：叫这个名字的东西，在【已经写了标注】的地方
 * 都被标成了什么？比如 `projectId`，仓里已有的显式标注里如果 100% 是 string，
 * 那就是这个代码库对这个名字的既成约定，照抄即可。这不是推测，是抄答案。
 *
 * 门槛（两个都要过）：
 *   · 证据条数 >= MIN_EVIDENCE —— 少数几处标注不足以代表约定
 *   · 最高票类型占比 >= CONSENSUS —— 有分歧就说明这个名字被用作了不同的东西
 * 不满足就整个名字跳过，绝不取"多数票"凑数。
 *
 * 【只写原始类型】证据里的类型文本是从【别的文件】抄来的，本地类型名直接写进去
 * 就是未定义标识符。所以只接受白名单里的原始类型及其数组形式。
 *
 * 【两个会毁文件的位置陷阱，都是前几批踩出来的】
 *   · 插入点必须在 questionToken 【之后】。写成 `foo: boolean?` 是 TS17019，
 *     会把整个签名毁掉，然后在所有调用点吐出莫名其妙的 "Expected N arguments"。
 *   · 无括号单参箭头 `x => ...` 加标注就是语法错。本版【直接跳过】不处理 ——
 *     补括号需要精确定位箭头自身的起点（往回找 `(` 会找到外层的 `useCallback(`），
 *     那是另一件事，不值得混在这一批里冒险。
 *
 * 用法：
 *   node tools/codemod-name-consensus-types.ts --list   # 只看共识表和覆盖量
 *   node tools/codemod-name-consensus-types.ts          # 应用
 *   加 --only=a,b,c 可限定只处理某几个名字
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject, writeSource } = require('./ts7.ts');

const APPLY = !process.argv.includes('--list');
const onlyArg = process.argv.find((a: string) => a.startsWith('--only='));
const ONLY: Set<string> | null = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;

const MIN_EVIDENCE = 10;
const CONSENSUS = 0.9;

/** 只有这些类型可以跨文件照抄——不依赖任何 import */
const PORTABLE = new Set(['string', 'number', 'boolean', 'string[]', 'number[]', 'boolean[]']);

const project = openProject('tsconfig.strictprobe.json');

// ── 第一遍：收集全仓【已有显式标注】的名字 -> 类型文本 ────────────────────
const evidence = new Map<string, Map<string, number>>();

function note(name: string, typeText: string): void {
  const t = typeText.trim();
  if (!t) return;
  if (!evidence.has(name)) evidence.set(name, new Map());
  const m = evidence.get(name)!;
  m.set(t, (m.get(t) || 0) + 1);
}

project.eachSrcFile(({ text, node }: any) => {
  (function walk(n: any) {
    if (
      n.type &&
      n.name &&
      is.isIdentifier(n.name) &&
      // 注意 TS 7 的命名：接口成员的守卫叫 isPropertySignatureDeclaration，
      // 不是 5.9 的 isPropertySignature（后者在新 API 里根本不存在）
      (is.isParameterDeclaration(n) ||
        is.isPropertySignatureDeclaration(n) ||
        is.isPropertyDeclaration(n) ||
        is.isVariableDeclaration(n))
    ) {
      note(n.name.text, text.slice(n.type.pos, n.type.end));
    }
    n.forEachChild(walk);
  })(node);
});

// ── 求共识 ────────────────────────────────────────────────────────────────
const consensus = new Map<string, { type: string; share: number; total: number }>();
for (const [name, counts] of evidence) {
  let total = 0;
  for (const c of counts.values()) total += c;
  if (total < MIN_EVIDENCE) continue;
  let best = '';
  let bestN = 0;
  for (const [t, c] of counts) {
    if (c > bestN) {
      best = t;
      bestN = c;
    }
  }
  const share = bestN / total;
  if (share < CONSENSUS) continue;
  if (!PORTABLE.has(best)) continue;
  consensus.set(name, { type: best, share, total });
}

// ── 第二遍：按 TS7006 诊断定位待标注的形参 ────────────────────────────────
type Target = { fileName: string; text: string; pos: number; name: string; type: string };
const targets: Target[] = [];
const skip = { noConsensus: 0, parenlessArrow: 0, rest: 0, notFound: 0 };

const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => d.code === 7006 && d.fileName && d.fileName.startsWith(path.join(ROOT, 'src') + path.sep));

// 按文件分组，省得对每个诊断都重新取一次 SourceFile
const byFile = new Map<string, any[]>();
for (const d of diags) {
  if (!byFile.has(d.fileName)) byFile.set(d.fileName, []);
  byFile.get(d.fileName)!.push(d);
}

for (const [fileName, ds] of byFile) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;
  const text: string = sf.text;

  // 建 索引 -> ParameterDeclaration。
  // 【用 name.end 而不是 name.pos】诊断的 pos..end 圈的是标识符本身，
  // 而 node.pos 含前导 trivia（空白/注释），两者对不上 —— 一开始拿 name.pos
  // 当键，11734 条诊断全部"定位不到"。end 两边口径一致。
  const paramAt = new Map<number, any>();
  (function walk(n: any) {
    if (is.isParameterDeclaration(n) && n.name && is.isIdentifier(n.name)) paramAt.set(n.name.end, n);
    n.forEachChild(walk);
  })(sf);

  for (const d of ds) {
    const p = paramAt.get(d.end);
    if (!p) {
      skip.notFound += 1;
      continue;
    }
    const name: string = p.name.text;
    if (ONLY && !ONLY.has(name)) continue;
    const c = consensus.get(name);
    if (!c) {
      skip.noConsensus += 1;
      continue;
    }
    if (p.dotDotDotToken) {
      skip.rest += 1;
      continue;
    }
    // 无括号单参箭头：只在【箭头自身的起点到形参之间】找左括号，
    // 往回多找一个字符都会撞上外层的 useCallback( 之类
    const parent = p.parent;
    if (parent && is.isArrowFunction(parent) && parent.parameters && parent.parameters.length === 1) {
      const between = text.slice(parent.pos, p.name.pos);
      if (!between.includes('(')) {
        skip.parenlessArrow += 1;
        continue;
      }
    }
    // 插入点：questionToken 之后（写在它之前就是 TS17019）
    const pos = p.questionToken ? p.questionToken.end : p.name.end;
    targets.push({ fileName, text, pos, name, type: c.type });
  }
}

// ── 报告 ──────────────────────────────────────────────────────────────────
const used = new Map<string, number>();
for (const t of targets) used.set(t.name, (used.get(t.name) || 0) + 1);

console.log(`共识表（证据 >= ${MIN_EVIDENCE} 条且最高票占比 >= ${CONSENSUS * 100}%，且是可移植原始类型）：`);
for (const [name, n] of [...used].sort((a, b) => b[1] - a[1])) {
  const c = consensus.get(name)!;
  console.log(
    `  ${name.padEnd(18)} -> ${c.type.padEnd(10)} 证据 ${String(c.total).padStart(4)} 条 / 共识 ${(c.share * 100).toFixed(0)}%  本次可标 ${n}`,
  );
}

const fileCount = new Set(targets.map(t => t.fileName)).size;
console.log(
  `\n${APPLY ? '已标' : '可标'} ${targets.length} 处，涉及 ${fileCount} 个文件；` +
    `跳过：名字无共识 ${skip.noConsensus} / 无括号单参箭头 ${skip.parenlessArrow} / rest 形参 ${skip.rest} / 定位不到 ${skip.notFound}`,
);

if (APPLY && targets.length) {
  const edits = new Map<string, { text: string; list: { pos: number; text: string }[] }>();
  for (const t of targets) {
    if (!edits.has(t.fileName)) edits.set(t.fileName, { text: t.text, list: [] });
    edits.get(t.fileName)!.list.push({ pos: t.pos, text: `: ${t.type}` });
  }
  for (const [fileName, bucket] of edits) writeSource(fileName, bucket.text, bucket.list);
  console.log(`已写入 ${edits.size} 个文件。`);
}

project.close();
