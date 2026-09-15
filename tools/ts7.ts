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

module.exports = { ROOT, SRC, openProject, writeSource, posToLineCol };
