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
 *   · 无括号单参箭头 `x => ...` 加标注就是语法错，要连括号一起补成 `(x: T) => ...`。
 *     前几批是靠「从形参往回扫找 `(`」判断的，结果撞上外层的 `useCallback(`。
 *     【其实根本不用扫】：诊断的 d.pos 就是标识符自身的起点，在那里插 `(`、
 *     在 name.end 插 `: T)` 就完了。判定有没有括号用 arrow.pos 到形参名之间的
 *     文本——arrow.pos 是上一个 token 的结尾，对 `useCallback(x => …)` 来说
 *     正好在 `(` 之后，这一段只会是空白，不会把外层括号算进来。
 *
 * ── 解构形参（TS7031）────────────────────────────────────────────────────
 * TS7031 是 `function f({ a, b })` 这种解构形参里的绑定元素隐式 any，全仓 4840 条，
 * 绑定名与上面的共识表高度重叠（appId / worksheetId / projectId / controlId …）。
 *
 * 【全部标成可选，而且必须带索引签名】给解构形参加标注最大的坑是
 * 「属性会变必填」—— 所有不传它的调用点齐刷刷 TS2741
 *（tools/codemod-domain-destructure-types.ts 的头注释里记过，那次就是为此整个跳过了
 *  解构形参）。这里生成的形状是：
 *     { projectId?: string; appId?: string; [key: string]: any }
 * 可选 => 调用点一个都不会破；索引签名 => 没共识的其余绑定名照旧是 any，不新增诊断。
 *
 * 用法：
 *   node tools/codemod-name-consensus-types.ts --list   # 只看共识表和覆盖量
 *   node tools/codemod-name-consensus-types.ts          # 应用
 *   加 --only=a,b,c 可限定只处理某几个名字
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { SyntaxKind: SK } = require('typescript/unstable/ast');
const {
  ROOT,
  callSiteFits,
  callSiteKey,
  collectCallSiteEvidence,
  openProject,
  usageFits,
  writeSource,
} = require('./ts7.ts');

const APPLY = !process.argv.includes('--list');
const onlyArg = process.argv.find((a: string) => a.startsWith('--only='));
const ONLY: Set<string> | null = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;

const MIN_EVIDENCE = 10;
/** 解构形参最多几个绑定元素才处理，理由见第三遍那里的注释 */
const MAX_BINDINGS = 6;
const CONSENSUS = 0.9;

/** 只有这些类型可以跨文件照抄——不依赖任何 import */
const PORTABLE = new Set(['string', 'number', 'boolean', 'string[]', 'number[]', 'boolean[]']);

/**
 * 【方法本身的局限，以及由此排除的名字】
 * 共识是在「已经写了标注的地方」统计出来的，它不保证能推广到没写标注的地方。
 * 2026-09-15 实测抓到的反例就是 `field`：已标注的 13 处 100% 都是 string，
 * 但未标注处大量是 `data.map(field => field.isPk / field.name / field.alias)`
 * 这种【对象】。标上 string 当场引入 3 条新诊断。
 * 提高证据门槛救不了它（13 条已经过线，而且共识是满分），所以只能按名字排除。
 * 这也说明差分门禁是这个工具【必须】的配套，不是走过场。
 *
 * 另外四个同样排除（都实测过，一起跑时它们贡献了 51 条新诊断里的大部分）：
 *   text 13 条 / url 13 条 —— 对应 179 和 36 处改写，证据与影响面严重不成比例
 *   id   44 条 91% —— 分歧里有 3 条是 FormControl，是真冲突不是可空化
 *   key  477 条 99% —— 分歧里有 4 条 number，实测会引入比较类诊断
 * 要重新评估某一个，用 --only=<名字> 单独跑一遍门禁看代价，别直接从这里删。
 */
const EXCLUDE = new Set([
  'field',
  'id',
  'text',
  'url',
  'key',
  // 下面三个是接入 PropTypes 证据之后才冒出来的，同样是「已标注处的共识推广不到
  // 未标注处」，实测各自的反例：
  //   dataSource 有 13 条 PropTypes.string（控件的数据源 id），但 ChildTable 那边
  //              是数组：addWidthToColumns(columns, dataSource) 里 dataSource.map
  //   visible    28 条 PropTypes.bool，但 folderSelectDialog 里
  //              settings.visibleType.forEach(visible => visible.rootFolder) 是对象
  //   hint       23 条 PropTypes.string，但 AppBuilder 里 hints.map(hint => hint.label)
  //   direction  11 条 91% string，但 segmentUtils 里是 ±1 的数字：
  //              `const j = groupSegmentIndex + direction`
  'dataSource',
  'visible',
  'hint',
  //   unit       共识 string，但 Schedule 里是和 TIME_TYPE.MINUTE 这类【数字常量】
  //              比较。逐点用法校验只看成员访问和展开，看不到比较操作，挡不住它。
  'direction',
  'unit',
  // 【title 和 width 已经从这里【撤掉】】它们当初进名单是因为"信号在调用点不在函数体"
  // （DeleteConfirm({ title: <span/> })、renderDropdownOverlay({ width: '100%' })）。
  // 现在 callSiteFits 能看调用点了，这两个交给它【按点】否决，
  // 而不是把整个名字丢掉 —— 那会连同其余几十处正确的一起丢。
]);

/**
 * 【逐点用法校验】名字共识只能说明「这个名字通常是什么」，说明不了「这一处是什么」。
 * 前两批靠差分门禁事后归因、再手工把名字塞进 EXCLUDE，已经攒了 5 个反例，
 * 而且每加一个新证据来源就会冒出新的一批。换个做法：在【这一处】上直接验一遍。
 *
 * 判据很简单也很硬：原始类型的形参不可能被访问不属于它的成员。
 * 只要函数体里出现 `p.fileName`、`p.advancedSetting`、`...p` 这类用法，
 * 就说明这一处的 p 是个对象，共识给的 string/number/boolean 在这里是错的，跳过。
 *
 * 这条规则把之前手工排除的 field / dataSource / visible / hint / icon / rowId
 * 全部自动挡住了，而且是【按点】挡，不会因为一处用错就丢掉这个名字的其余几百处。
 */
// MEMBERS / literalPrimitive / usageFits 已收进 tools/ts7.ts，两个 codemod 共用。

const project = openProject('tsconfig.strictprobe.json');

// 调用点证据：用来【否决】那些「名字共识对、但这一处调用方传的根本不是那个类型」的标注。
// 这是 title / width 那类误判唯一的信号源 —— 函数体里看不出任何问题。
const callSites = collectCallSiteEvidence(project);

// ── 第一遍：收集全仓已有的「名字 -> 类型」证据 ──────────────────────────
// 两个来源，等权计数：
//   A. TS 显式类型标注
//   B. PropTypes 声明 —— 全仓 3842 条，比 A 大一个数量级。它是同一批作者写的
//      意图声明、dev 下还有运行时校验，作为证据不比 TS 标注弱。
// 两个来源【打架】时共识自然掉到阈值以下、名字被整个排除，这正是想要的：
// 说明这个名字在本仓被用作了不止一种东西。
const evidence = new Map<string, Map<string, number>>();
const fromPropTypes = new Map<string, number>();

function note(name: string, typeText: string): void {
  const t = typeText.trim();
  if (!t) return;
  if (!evidence.has(name)) evidence.set(name, new Map());
  const m = evidence.get(name)!;
  m.set(t, (m.get(t) || 0) + 1);
}

/** PropTypes.string / PropTypes.bool.isRequired -> 'string' / 'boolean'；其余返回 null */
const PROPTYPE_MAP: Record<string, string> = { string: 'string', number: 'number', bool: 'boolean' };
function propTypeOf(init: any): string | null {
  // 把 a.b.c 摊平成 ['a','b','c']
  const chain: string[] = [];
  let cur = init;
  while (cur && is.isPropertyAccessExpression(cur)) {
    if (!cur.name || !is.isIdentifier(cur.name)) return null;
    chain.unshift(cur.name.text);
    cur = cur.expression;
  }
  if (!cur || !is.isIdentifier(cur) || cur.text !== 'PropTypes') return null;
  // array/func/object/oneOf(...) 一律不收：不是可移植原始类型，写 any[] 没意义
  return chain.length ? PROPTYPE_MAP[chain[0]] || null : null;
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
    } else if (is.isPropertyAssignment(n) && n.name && is.isIdentifier(n.name) && n.initializer) {
      const t = propTypeOf(n.initializer);
      if (t) {
        note(n.name.text, t);
        fromPropTypes.set(n.name.text, (fromPropTypes.get(n.name.text) || 0) + 1);
      }
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
  // --only 是显式点名，视为「我知道它在排除名单里，就是要单独评估它」
  if (EXCLUDE.has(name) && !(ONLY && ONLY.has(name))) continue;
  consensus.set(name, { type: best, share, total });
}

// ── 第二遍：按 TS7006 诊断定位待标注的形参 ────────────────────────────────
type Target = { fileName: string; text: string; pos: number; name: string; type: string; openParenAt?: number };
const targets: Target[] = [];
const skip = { noConsensus: 0, usageMismatch: 0, callSiteMismatch: 0, rest: 0, notFound: 0 };

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
    // 这一处的用法和共识类型对不上就跳过（见 usageFits 的说明）
    if (p.parent && !usageFits(p.parent, name, c.type)) {
      skip.usageMismatch += 1;
      continue;
    }
    // 调用点传进来的和共识类型对不上也跳过（函数体看不到的那一类）
    if (p.index !== undefined && !callSiteFits(callSites, callSiteKey(fileName, p.index), c.type)) {
      skip.callSiteMismatch += 1;
      continue;
    }

    // 插入点：questionToken 之后（写在它之前就是 TS17019）
    const pos = p.questionToken ? p.questionToken.end : p.name.end;

    // 无括号单参箭头 `x => ...`：直接标注就是语法错，得连括号一起补成 `(x: T) => ...`。
    //
    // 【别再往回扫找左括号了】前几批栽在这上面：从形参往前找 `(` 会撞上外层的
    // `useCallback(`。其实根本不需要扫 —— 诊断的 d.pos 【就是】标识符自身的起点
    //（pos..end 正好圈住 `x`），在那里插 `(`、在 name.end 插 `: T)` 即可。
    // 判定「有没有括号」用 arrow.pos 到形参名之间的文本：arrow.pos 是上一个 token
    // 的结尾，对 `useCallback(x => …)` 来说就是 `(` 之后，这一段只会是空白，
    // 不会把外层的括号算进来。
    const parent = p.parent;
    const isParenless =
      parent &&
      is.isArrowFunction(parent) &&
      parent.parameters &&
      parent.parameters.length === 1 &&
      !text.slice(parent.pos, p.name.pos).includes('(');

    if (isParenless) {
      targets.push({ fileName, text, pos, name, type: c.type, openParenAt: d.pos });
    } else {
      targets.push({ fileName, text, pos, name, type: c.type });
    }
  }
}

// ── 第三遍：解构形参（TS7031）──────────────────────────────────────────────
type DestructureTarget = { fileName: string; text: string; pos: number; names: string[]; type: string };
const destructures: DestructureTarget[] = [];
const dskip = { annotated: 0, noConsensus: 0, usageMismatch: 0, callSiteMismatch: 0, tooManyBindings: 0 };

const d7031 = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => d.code === 7031 && d.fileName && d.fileName.startsWith(path.join(ROOT, 'src') + path.sep));

const byFile7031 = new Map<string, Set<number>>();
for (const d of d7031) {
  if (!byFile7031.has(d.fileName)) byFile7031.set(d.fileName, new Set());
  byFile7031.get(d.fileName)!.add(d.end);
}

for (const [fileName, ends] of byFile7031) {
  const sf = project.program.getSourceFile(fileName);
  if (!sf) continue;
  const text: string = sf.text;

  (function walk(n: any) {
    if (
      is.isParameterDeclaration(n) &&
      n.name &&
      is.isObjectBindingPattern(n.name) &&
      !n.type // 已经有标注的不碰
    ) {
      // 【只处理小解构】绑定元素超过 MAX_BINDINGS 的基本都是 React 组件的 props 大包。
      // 给它们加「可选 + 索引签名」的形状，会和下游的泛型推断互相影响 ——
      // 实测 ButtonDisplay（12+ 个绑定）里 `_.chunk(buttonList, …)` 的结果从 any[][]
      // 退化成 {}[][]，下游解构当场 TS2339，而 buttonList 自己明明还是 any。
      // 小解构（配置对象、事件参数那种）没有这个问题，收益也集中在那里。
      const elements = (n.name.elements || []).filter((be: any) => is.isBindingElement(be));
      if (elements.length > MAX_BINDINGS) {
        dskip.tooManyBindings += 1;
        n.forEachChild(walk);
        return;
      }

      const props: string[] = [];
      const picked: string[] = [];
      let touched = false;
      for (const be of n.name.elements || []) {
        if (!is.isBindingElement(be) || !be.name || !is.isIdentifier(be.name)) continue;
        if (!ends.has(be.name.end)) continue; // 不是报了 TS7031 的那个绑定元素
        touched = true;
        const bname: string = be.name.text;
        const c = consensus.get(bname);
        if (!c) {
          dskip.noConsensus += 1;
          continue;
        }
        // 逐点用法校验同样适用：函数体里把它当对象用就别标
        if (n.parent && !usageFits(n.parent, bname, c.type)) {
          dskip.usageMismatch += 1;
          continue;
        }
        // 调用点按属性名否决：DeleteConfirm({ title: <span/> }) 这种，
        // 函数体里 title 只是被渲染，看不出任何问题，唯一的信号在调用点。
        if (n.index !== undefined && !callSiteFits(callSites, callSiteKey(fileName, n.index, bname), c.type)) {
          dskip.callSiteMismatch += 1;
          continue;
        }
        props.push(`${bname}?: ${c.type}`);
        picked.push(bname);
      }
      if (touched && props.length) {
        destructures.push({
          fileName,
          text,
          pos: n.name.end,
          names: picked,
          // 【可选 + 索引签名】理由见文件头：必填会打爆所有不传的调用点，
          // 索引签名让没共识的绑定名保持 any，不新增诊断。
          type: `: { ${props.join('; ')}; [key: string]: any }`,
        });
      }
    }
    n.forEachChild(walk);
  })(sf);
}

// ── 报告 ──────────────────────────────────────────────────────────────────
const used = new Map<string, number>();
for (const t of targets) used.set(t.name, (used.get(t.name) || 0) + 1);

console.log(`共识表（证据 >= ${MIN_EVIDENCE} 条且最高票占比 >= ${CONSENSUS * 100}%，且是可移植原始类型）：`);
for (const [name, n] of [...used].sort((a, b) => b[1] - a[1])) {
  const c = consensus.get(name)!;
  const pt = fromPropTypes.get(name) || 0;
  console.log(
    `  ${name.padEnd(18)} -> ${c.type.padEnd(10)} 证据 ${String(c.total).padStart(4)} 条` +
      `（其中 PropTypes ${String(pt).padStart(3)}）/ 共识 ${(c.share * 100).toFixed(0)}%  本次可标 ${n}`,
  );
}

const dNames = new Map<string, number>();
for (const t of destructures) for (const n of t.names) dNames.set(n, (dNames.get(n) || 0) + 1);
if (destructures.length) {
  console.log('\n解构形参（TS7031）：');
  for (const [name, n] of [...dNames].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${name.padEnd(18)} -> ${consensus.get(name)!.type.padEnd(10)} 本次可标 ${n}`);
  }
}

const fileCount = new Set(targets.map(t => t.fileName)).size;
console.log(
  `\n${APPLY ? '已标' : '可标'} ${targets.length} 处，涉及 ${fileCount} 个文件；` +
    `其中补括号的单参箭头 ${targets.filter(t => t.openParenAt !== undefined).length} 处；\n` +
    `另标解构形参 ${destructures.length} 处（覆盖 ${[...dNames.values()].reduce((a, b) => a + b, 0)} 个绑定名）；` +
    `跳过：名字无共识 ${skip.noConsensus} / 本处用法与类型不符 ${skip.usageMismatch} / 调用点与类型不符 ${skip.callSiteMismatch + dskip.callSiteMismatch} / rest 形参 ${skip.rest} / 定位不到 ${skip.notFound}`,
);

if (APPLY && (targets.length || destructures.length)) {
  const edits = new Map<string, { text: string; list: { pos: number; text: string }[] }>();
  for (const d of destructures) {
    if (!edits.has(d.fileName)) edits.set(d.fileName, { text: d.text, list: [] });
    edits.get(d.fileName)!.list.push({ pos: d.pos, text: d.type });
  }
  for (const t of targets) {
    if (!edits.has(t.fileName)) edits.set(t.fileName, { text: t.text, list: [] });
    const list = edits.get(t.fileName)!.list;
    if (t.openParenAt !== undefined) {
      // `x => …` 补成 `(x: T) => …`：左括号在标识符起点，右括号紧跟类型
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
