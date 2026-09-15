#!/usr/bin/env node
/**
 * 第 0 层门禁：语法零容忍。无基线、无漂移。
 *
 * 为什么这一层必须独立存在，且是本批次性价比最高的门禁：
 * 本批的头号风险是「机械 .js -> .ts 改名」把含 JSX 的文件改成了 .ts
 * （全仓 453 个 .js 含 JSX，抽样 11.5%），后果是文件【解析失败】。
 * 而 babel-loader 是纯类型擦除，webpack 照样能绿 —— 只有 tsc 看得见。
 *
 * 为什么不能用 code 号段判语法错误（这是本仓最大的判读陷阱）：
 *   实测 program.getSyntacticDiagnostics() = 0 条（4294 个文件），
 *   而 code 落在 1xxx 号段的诊断有 1078 条，TypeScript 自己把这 1078 条
 *   【全部】归类为 semantic —— 它们是 checkJs 解析 JSDoc 里的类型语法产生的。
 *   所以 "TS1xxx == 语法错误" 在本仓是 1078/1078 全假。
 *   反向也验过：syntactic 里 code 不在 1xxx 号段的 = 0 条。
 * 结论：只信 getSyntacticDiagnostics()，不要 grep 号段。
 *
 * 另一个副作用收益：语法诊断非 0 的文件，tsc 会跳过该文件的语义诊断，
 * 于是语义门禁在那个文件上是【瞎的】。这一层保证不会出现这种盲区。
 *
 * ── TypeScript 7 的 API 迁移（2026-09-15）────────────────────────────
 * 7.0 是 Go 原生移植版：`require('typescript')` 只剩 { version }，
 * 编译器 API 全部搬到 `typescript/unstable/sync`，而且是类式的：
 *   new API({cwd}) -> updateSnapshot({openProjects}) -> getProject() -> .program
 * JS 侧只是个客户端，真正的编译器在另一个进程里，所以诊断对象是【纯数据】
 * （fileName/pos/end/code/category/text），没有 d.file，也没有
 * getLineAndCharacterOfPosition —— 行列号要自己按 pos 算。
 */
const fs = require('fs');
const path = require('path');
const { API } = require('typescript/unstable/sync');

const ROOT = path.resolve(__dirname, '../..');
const configPath = path.join(ROOT, 'tsconfig.gate.json');
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

// 与语义门禁一致的噪声剔除：src/library 是预打包压缩产物，__ 前缀是探针
const isNoise = r => r.startsWith('src/library/') || path.basename(r).startsWith('__');

/** pos（字符偏移）-> (line, col)，都是 1 起。按文件缓存行首表。 */
const lineStartsCache = new Map();
function posToLineCol(absFile, pos) {
  let starts = lineStartsCache.get(absFile);
  if (starts === undefined) {
    try {
      const text = fs.readFileSync(absFile, 'utf8');
      starts = [0];
      for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    } catch {
      starts = null;
    }
    lineStartsCache.set(absFile, starts);
  }
  if (!starts) return { line: 0, col: 0 };
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: pos - starts[lo] + 1 };
}

const t0 = Date.now();
const api = new API({ cwd: ROOT });

const cfg = api.parseConfigFile(configPath);
if (!cfg || !cfg.fileNames) {
  console.error('tsconfig 无法解析:', configPath);
  process.exit(2);
}

const snapshot = api.updateSnapshot({ openProjects: [configPath] });
const project = snapshot.getProject(configPath);
if (!project) {
  console.error('tsconfig 加载不出 project:', configPath);
  process.exit(2);
}

const diags = project.program.getSyntacticDiagnostics().filter(d => !d.fileName || !isNoise(rel(d.fileName)));
const secs = ((Date.now() - t0) / 1000).toFixed(1);

if (diags.length === 0) {
  console.log(`语法门禁通过：${cfg.fileNames.length} 个文件，0 条语法诊断（${secs}s）`);
  api.close();
  process.exit(0);
}

console.error(`\n语法门禁失败：${diags.length} 条语法诊断（${secs}s）`);
console.error('提示：含 JSX 的文件必须是 .tsx，不能是 .ts —— 这是最常见的原因。\n');
const byFile = new Map();
for (const d of diags) {
  const f = d.fileName ? rel(d.fileName) : '(no file)';
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(d);
}
for (const [f, ds] of byFile) {
  console.error(`  ${f}  (${ds.length} 条)`);
  for (const d of ds.slice(0, 3)) {
    const { line, col } = posToLineCol(path.join(ROOT, f), d.pos);
    console.error(`     (${line},${col}) TS${d.code}: ${d.text}`);
  }
}
api.close();
process.exit(1);
