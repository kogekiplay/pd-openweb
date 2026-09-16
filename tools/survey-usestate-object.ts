/**
 * 调研：`useState({...})` / `useSetState({...})` 这类【对象状态】各形态各占多少诊断。
 *
 * 背景：tools/analyze-any-origins.ts 排完 jQuery 之后，爆炸半径的头部换成了一批
 * 解构绑定 —— groupInfo(61) / info(37) / portalSetModel(28)。实地看过之后发现
 * 它们【不是普通解构】，而是 React hooks 的数组解构：
 *     const [portalSetModel, setPortalSetModel] = useState({});   // 空对象起手
 *     const [info, setInfo] = useState({ loading: true, ... });   // 部分字段起手
 *     const [groupInfo, setState] = useSetState({ ... });          // 自定义 hook
 * 之后读初值里没有的键，就是 TS2339。
 *
 * 【为什么要先分形态】这三种的可做性完全不同：
 *   · 空对象起手：跟 tools/codemod-empty-object-shape.ts 治的是同一件事，
 *     Record<string, any> 是如实的（"这是个字典"），不假装知道里面有什么。
 *   · 部分字段起手：初值里的键是【已知且有真实类型】的，直接压成
 *     Record<string, any> 反而是【降级】—— 把已经推出来的类型丢掉。
 *     要做得保留已知键、再把实测缺的键补成可选，成本高一档。
 *   · 自定义 hook（useSetState）：还要先看它自己的签名是怎么写的。
 *
 * 所以先量，再决定这一批只做哪一档。只统计，不改文件。
 *
 * 用法：node tools/survey-usestate-object.ts
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject } = require('./ts7.ts');

const project = openProject('tsconfig.strictprobe.json');
const SRC = path.join(ROOT, 'src') + path.sep;

/** 这一批关心的 hook */
const HOOKS = new Set(['useState', 'useSetState']);

type Site = {
  fileName: string;
  line: number;
  hook: string;
  stateName: string;
  /** 'empty' = useState({})，'partial' = useState({有字段})，'typed' = 已经写了类型参数 */
  shape: 'empty' | 'partial' | 'typed';
  keys: string[];
  /** 这个状态变量喂出了多少条诊断 */
  diagCount: number;
  /** 诊断里点名缺失的键（= 被读到但初值里没有的） */
  missing: Set<string>;
};

/**
 * 【下一步要加的一维：setter 写进去的键】
 * 要给 useState({}) 之类补【精确】类型（而不是一刀切 Record<string, any>），
 * 键集必须是「读到的 ∪ 写进去的」：只按诊断里读到的键生成，那些【只写不读】的键
 * 会在 setX({ 那个键: … }) 处立刻报 TS2353。
 * 这一维还没做，所以本工具目前只用来【分形态定范围】，不产出类型。
 */

const sites: Site[] = [];

project.eachSrcFile(({ fileName, text, node }: any) => {
  (function walk(n: any) {
    // const [x, setX] = useState({...})
    if (
      is.isVariableDeclaration(n) &&
      n.name &&
      is.isArrayBindingPattern(n.name) &&
      n.initializer &&
      is.isCallExpression(n.initializer) &&
      n.initializer.expression &&
      is.isIdentifier(n.initializer.expression) &&
      HOOKS.has(n.initializer.expression.text)
    ) {
      const args = n.initializer.arguments || [];
      const hasTypeArgs = !!(n.initializer.typeArguments && n.initializer.typeArguments.length);
      const arg0 = args[0];
      if (arg0 && is.isObjectLiteralExpression(arg0)) {
        const els = n.name.elements || [];
        const first = els[0];
        const stateName = first && first.name && is.isIdentifier(first.name) ? first.name.text : '?';
        const props = arg0.properties || [];
        const keys: string[] = [];
        for (const p of props) {
          if (p.name && is.isIdentifier(p.name)) keys.push(p.name.text);
          else if (p.name) keys.push(text.slice(p.name.pos, p.name.end).trim());
          else keys.push('…');
        }
        sites.push({
          fileName,
          line: text.slice(0, n.pos).split('\n').length,
          hook: n.initializer.expression.text,
          stateName,
          shape: hasTypeArgs ? 'typed' : keys.length === 0 ? 'empty' : 'partial',
          keys,
          diagCount: 0,
          missing: new Set<string>(),
        });
      }
    }
    n.forEachChild(walk);
  })(node);
});

// ── 把诊断挂到对应的状态变量上 ────────────────────────────────────────────
// TS2339 的文本形如 Property 'foo' does not exist on type '{ loading: boolean; ... }'.
const byName = new Map<string, Site[]>();
for (const s of sites) {
  const k = `${s.fileName}|${s.stateName}`;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k)!.push(s);
}

const diags = project.program
  .getSemanticDiagnostics()
  .filter((d: any) => d.code === 2339 && d.fileName && d.fileName.startsWith(SRC));

for (const d of diags) {
  const sf = project.program.getSourceFile(d.fileName);
  if (!sf) continue;
  const text: string = sf.text;
  // 诊断落在属性名上，往前找属主标识符
  const m = /Property '([^']+)' does not exist on type/.exec(d.text || '');
  if (!m) continue;
  // 属主：诊断位置往左，形如 `xxx.foo`
  const before = text.slice(Math.max(0, d.pos - 120), d.pos);
  const owner = /([A-Za-z_$][\w$]*)\s*\.\s*$/.exec(before);
  if (!owner) continue;
  const bucket = byName.get(`${d.fileName}|${owner[1]}`);
  if (!bucket) continue;
  for (const s of bucket) {
    s.diagCount += 1;
    s.missing.add(m[1]);
  }
}

// ── 报告 ──────────────────────────────────────────────────────────────────
const byShape: Record<string, { sites: number; diags: number }> = {
  empty: { sites: 0, diags: 0 },
  partial: { sites: 0, diags: 0 },
  typed: { sites: 0, diags: 0 },
};
for (const s of sites) {
  byShape[s.shape].sites += 1;
  byShape[s.shape].diags += s.diagCount;
}

const label: Record<string, string> = {
  empty: 'useState({})        空对象起手',
  partial: 'useState({有字段})   部分字段起手',
  typed: 'useState<T>({...})  已写类型参数',
};
console.log(`对象状态的 hook 调用共 ${sites.length} 处：\n`);
console.log(`  ${'形态'.padEnd(30)} ${'处数'.padStart(6)} ${'喂出诊断'.padStart(10)}`);
for (const k of ['empty', 'partial', 'typed']) {
  console.log(`  ${label[k].padEnd(30)} ${String(byShape[k].sites).padStart(6)} ${String(byShape[k].diags).padStart(10)}`);
}

const byHook = new Map<string, number>();
for (const s of sites) byHook.set(s.hook, (byHook.get(s.hook) || 0) + 1);
console.log(`\n按 hook：${[...byHook].map(([h, n]) => `${h} ${n} 处`).join('，')}`);

for (const shape of ['empty', 'partial'] as const) {
  const top = sites.filter(s => s.shape === shape && s.diagCount > 0).sort((a, b) => b.diagCount - a.diagCount);
  console.log(`\n── ${label[shape]} —— 喂出诊断最多的 8 处（共 ${top.length} 处有诊断）──`);
  for (const s of top.slice(0, 8)) {
    console.log(
      `  ${String(s.diagCount).padStart(4)} 条  ${s.stateName.padEnd(18)} ${path.relative(ROOT, s.fileName)}:${s.line}`,
    );
    if (s.keys.length) console.log(`          初值键(${s.keys.length}): ${s.keys.slice(0, 8).join(', ')}${s.keys.length > 8 ? ' …' : ''}`);
    console.log(`          实测缺的键(${s.missing.size}): ${[...s.missing].slice(0, 10).join(', ')}${s.missing.size > 10 ? ' …' : ''}`);
  }
}

project.close();
