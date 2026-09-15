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

module.exports = { ROOT, SRC, openProject, writeSource, posToLineCol, usageFits, literalPrimitive, MEMBERS };
