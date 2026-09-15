/**
 * TypeScript 7 的 codemod 适配层。
 *
 * 为什么需要这一层：7.0 是 Go 原生移植版，`require('typescript')` 只剩
 * `{ version, versionMajorMinor }`，`ts.createProgram` / `ts.SyntaxKind` /
 * `ts.sys` 全部不存在。tools/ 下 8 个 codemod 当初都是按 5.9 的 API 写的，
 * 升级后一个都跑不了（`TypeError: Cannot read properties of undefined (reading 'readFile')`）。
 * 与其在每个文件里重复迁移，不如把差异收在这里改一次。
 *
 * ── 新 API 的形状（实测，2026-09-15）────────────────────────────────────
 * 入口是类式的，而且 JS 侧只是个【客户端】，真正的编译器在另一个进程里：
 *   new API({cwd}) -> updateSnapshot({openProjects:[cfg]}) -> getProject(cfg)
 *   -> project.program / project.checker
 * 由此带来三条必须知道的差异：
 *
 * 1. 【没有 getSourceFiles()】只有 `getSourceFileNames()` + `getSourceFile(name)`。
 *
 * 2. 【跨进程的参数必须可序列化】`getSemanticDiagnostics(sourceFileNode)` 会抛
 *    `Converting circular structure to JSON`（RemoteSourceFile 自引用）。
 *    要传【文件名字符串】。不传参则返回全仓诊断。
 *    诊断是纯数据 `{fileName,pos,end,code,category,text,relatedInformation?}` ——
 *    没有 `d.file`，也没有 getLineAndCharacterOfPosition，行列号要自己按 pos 算。
 *
 * 3. 【BOM 的方向反了，这条最容易静默毁文件】
 *    5.9 的 `sourceFile.getFullText()` 【包含】BOM，所以当年的结论是
 *    "用 getFullText，别用 fs.readFileSync"。
 *    7.0 的 `sf.text` 【剥掉】BOM，比磁盘内容短 1 个字符，而节点的 pos/end 是
 *    按剥掉之后算的。本仓有 138 个以 BOM 开头的源文件，如果拿磁盘内容当改写
 *    基准，这 138 个文件的每一处插入都会错位一格 —— 不报错，直接写坏。
 *    所以：改写基准一律用 `sf.text`，落盘时由 writeSource() 把 BOM 补回去。
 *
 * checker 比 5.9 那套还全，getTypeAtLocation / getSymbolAtLocation /
 * typeToString / getContextualType / getReferencesToSymbolInFile 都在。
 */

const fs = require('fs');
const path = require('path');
const { API } = require('typescript/unstable/sync');
const is = require('typescript/unstable/ast/is');
const { SyntaxKind: SK } = require('typescript/unstable/ast');

const ROOT: string = path.resolve(__dirname, '..');
const SRC: string = path.join(ROOT, 'src') + path.sep;

const BOM = '﻿';

type Edit = { pos: number; text: string };

interface OpenedProject {
  program: any;
  checker: any;
  /** 遍历 src/ 下的实现文件（排除 .d.ts 与 src/library 预打包产物） */
  eachSrcFile(cb: (info: { fileName: string; rel: string; text: string; node: any }) => void): void;
  close(): void;
}

/** 打开一个 tsconfig，拿到 program + checker。configName 相对仓库根。 */
function openProject(configName: string): OpenedProject {
  const configPath = path.join(ROOT, configName);
  const api = new API({ cwd: ROOT });
  const snapshot = api.updateSnapshot({ openProjects: [configPath] });
  const project = snapshot.getProject(configPath);
  if (!project) throw new Error(`tsconfig 加载不出 project: ${configPath}`);

  const program = project.program;

  return {
    program,
    checker: project.checker,
    eachSrcFile(cb) {
      for (const fileName of program.getSourceFileNames()) {
        if (!fileName.startsWith(SRC)) continue;
        if (!/\.tsx?$/.test(fileName) || /\.d\.ts$/.test(fileName)) continue;
        // src/library 是预打包压缩产物，跟门禁的噪声剔除口径保持一致
        const rel = path.relative(ROOT, fileName).split(path.sep).join('/');
        if (rel.startsWith('src/library/')) continue;
        const node = program.getSourceFile(fileName);
        if (!node) continue;
        cb({ fileName, rel, text: node.text, node });
      }
    },
    close: () => api.close(),
  };
}

/**
 * 按 pos 插入若干片段并落盘。edits 的 pos 必须是【相对 sf.text】的偏移。
 * 从后往前应用，避免前面的插入推移后面的位置。
 * 磁盘原本有 BOM 的，写回时补回去（见文件头第 3 条）。
 */
function writeSource(fileName: string, text: string, edits: Edit[]): void {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.pos - a.pos)) {
    out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
  }
  const head = fs.readFileSync(fileName).subarray(0, 3);
  const hadBom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  fs.writeFileSync(fileName, hadBom ? BOM + out : out);
}

/** pos（字符偏移，相对 sf.text）-> (line, col)，都是 1 起。 */
function posToLineCol(text: string, pos: number): { line: number; col: number } {
  let line = 1;
  let last = 0;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') {
      line += 1;
      last = i + 1;
    }
  }
  return { line, col: pos - last + 1 };
}

/**
 * ── 逐点用法校验（两个 codemod 共用）──────────────────────────────────────
 * 名字共识也好、调用点推断也好，得出的都是「这个形参【通常】是什么」，
 * 说明不了「这一处是什么」。这里在【这一处】直接验三件事：
 *   1. 成员访问：原始类型的形参不可能被访问不属于它的成员（p.fileName）
 *   2. 展开：`...p` 只有对象/数组能展开
 *   3. 比较与赋值：`p === '字面量'` 时字面量的原始类型要对得上
 *   4. typeof 分支：函数体里写了 `typeof p === '别的类型'`，说明它不止一种形态
 * 任何一条不符就跳过这一处 —— 是【按点】挡，不会因为一处用错丢掉这个名字其余几百处。
 */
const MEMBERS: Record<string, Set<string>> = {
  string: new Set([
    'length','charAt','charCodeAt','codePointAt','concat','endsWith','includes','indexOf','lastIndexOf',
    'localeCompare','match','matchAll','normalize','padEnd','padStart','repeat','replace','replaceAll',
    'search','slice','split','startsWith','substr','substring','at','toLowerCase','toUpperCase',
    'toLocaleLowerCase','toLocaleUpperCase','trim','trimEnd','trimStart','toString','valueOf',
  ]),
  number: new Set(['toFixed','toPrecision','toExponential','toString','valueOf','toLocaleString']),
  boolean: new Set(['toString','valueOf']),
};

/** 字面量节点的原始类型；不是字面量返回 null */
function literalPrimitive(node: any): string | null {
  if (!node) return null;
  if (is.isStringLiteral(node) || is.isNoSubstitutionTemplateLiteral(node)) return 'string';
  if (is.isNumericLiteral(node)) return 'number';
  if (node.kind === SK.TrueKeyword || node.kind === SK.FalseKeyword) return 'boolean';
  return null;
}

function usageFits(fnNode: any, paramName: string, type: string): boolean {
  const allowed = MEMBERS[type];
  if (!allowed || !fnNode) return true; // 数组类型不做这个检查
  let ok = true;
  (function walk(n: any) {
    if (!ok) return;
    if ((is.isSpreadAssignment(n) || is.isSpreadElement(n)) && n.expression && is.isIdentifier(n.expression)) {
      if (n.expression.text === paramName) ok = false;
    }
    if (is.isPropertyAccessExpression(n) && n.expression && is.isIdentifier(n.expression) && n.name) {
      if (n.expression.text === paramName && !allowed.has(n.name.text)) ok = false;
    }
    if (is.isBinaryExpression(n) && n.left && n.right && n.operatorToken) {
      const op = n.operatorToken.kind;
      const isCmpOrAssign =
        op === SK.EqualsEqualsToken || op === SK.EqualsEqualsEqualsToken ||
        op === SK.ExclamationEqualsToken || op === SK.ExclamationEqualsEqualsToken || op === SK.EqualsToken;
      if (isCmpOrAssign) {
        for (const [a, b] of [[n.left, n.right], [n.right, n.left]]) {
          // typeof p === '别的类型' —— 说明这个形参不止一种形态，别钉死
          if (is.isTypeOfExpression(a) && a.expression && is.isIdentifier(a.expression) && a.expression.text === paramName) {
            const lit = is.isStringLiteral(b) ? b.text : null;
            if (lit && lit !== type) ok = false;
            continue;
          }
          if (!is.isIdentifier(a) || a.text !== paramName) continue;
          const lit = literalPrimitive(b);
          if (lit && lit !== type) ok = false;
        }
      }
    }
    n.forEachChild(walk);
  })(fnNode);
  return ok;
}

/**
 * ── 调用点证据（两个 codemod 共用）────────────────────────────────────────
 * 扫全程序的调用点，按形参身份收集「实参实际是什么类型」。
 *
 * 【形参身份用 `path|index`】TS 7 里 getResolvedSignature().getParameters() 拿到的
 * 形参声明是个【惰性句柄】，自有键只有 { canonicalProject, kind, path, index }，
 * name / pos / end / forEachChild 全是 undefined。但 path 是文件路径、index 是节点
 * 在该文件里的下标，而【物化后的节点带同一个 index】—— 所以两边都不用物化。
 * （先后试过「声明 pos + 形参下标」和「形参标识符的 end」，都匹配不上，见
 *   codemod-callsite-types.ts 的文件头。）
 *
 * 解构形参另外按属性名收一份：`path|index|propName`。调用点传的是对象字面量时，
 * 把每个属性的值类型记到对应的绑定名下 —— 这是 title / width 那类误判唯一的信号源
 *（DeleteConfirm({ title: <span/> })、renderDropdownOverlay({ width: '100%' })，
 *  函数体里看不出任何问题）。
 */
interface CallSiteEvidence {
  /** `path|index` 或 `path|index|propName` -> 实参类型集合 */
  types: Map<string, Set<string>>;
  /** 出现过 any 实参的键：这个位置本来就什么都可能进来，别下结论 */
  dirty: Set<string>;
  counts: Map<string, number>;
}

function callSiteKey(filePath: string, nodeIndex: number, prop?: string): string {
  const base = `${String(filePath).toLowerCase()}|${nodeIndex}`;
  return prop === undefined ? base : `${base}|${prop}`;
}

function collectCallSiteEvidence(project: OpenedProject): CallSiteEvidence {
  const checker = project.checker;
  const types = new Map<string, Set<string>>();
  const dirty = new Set<string>();
  const counts = new Map<string, number>();

  const add = (k: string, node: any) => {
    counts.set(k, (counts.get(k) || 0) + 1);
    let t = '';
    try {
      t = checker.typeToString(checker.getTypeAtLocation(node));
    } catch {
      t = 'any';
    }
    if (!t || t === 'any' || /\bany\b/.test(t)) {
      dirty.add(k);
      return;
    }
    if (!types.has(k)) types.set(k, new Set());
    types.get(k)!.add(t);
  };

  project.eachSrcFile(({ node }: any) => {
    (function walk(n: any) {
      if (is.isCallExpression(n) && n.arguments && n.arguments.length) {
        let params: any[] | null = null;
        try {
          const sig = checker.getResolvedSignature(n);
          params = sig ? sig.getParameters() : null;
        } catch {
          params = null;
        }
        if (params && params.length) {
          n.arguments.forEach((arg: any, i: number) => {
            const pdecl = params![i] && params![i].valueDeclaration;
            if (!pdecl || !pdecl.path || pdecl.index === undefined) return;
            if (!String(pdecl.path).toLowerCase().startsWith(SRC.toLowerCase())) return;
            add(callSiteKey(pdecl.path, pdecl.index), arg);
            // 实参是对象字面量：按属性名再收一份，给解构形参用
            if (is.isObjectLiteralExpression(arg) && arg.properties) {
              for (const prop of arg.properties) {
                if (!is.isPropertyAssignment(prop) || !prop.name || !is.isIdentifier(prop.name)) continue;
                add(callSiteKey(pdecl.path, pdecl.index, prop.name.text), prop.initializer);
              }
            }
          });
        }
      }
      n.forEachChild(walk);
    })(node);
  });

  return { types, dirty, counts };
}

/**
 * 调用点传进来的东西，和我们打算写的类型相容吗？
 * 【有 any 就放行】不是"没证据就拦"，而是"有反证才拦" —— 这一层是【否决权】，
 * 不是准入条件；准入由名字共识或调用点推断负责。
 */
function callSiteFits(ev: CallSiteEvidence, key: string, type: string): boolean {
  if (ev.dirty.has(key)) return true;
  const set = ev.types.get(key);
  if (!set || !set.size) return true;
  for (const t of set) {
    // 字面量类型（'foo' / 42 / true）折回它的原始类型再比
    const norm = /^(['"`]).*\1$/.test(t) ? 'string' : /^-?\d+(\.\d+)?$/.test(t) ? 'number' : t === 'true' || t === 'false' ? 'boolean' : t;
    if (norm !== type) return false;
  }
  return true;
}

module.exports = {
  ROOT,
  SRC,
  openProject,
  writeSource,
  posToLineCol,
  usageFits,
  literalPrimitive,
  MEMBERS,
  collectCallSiteEvidence,
  callSiteKey,
  callSiteFits,
};
