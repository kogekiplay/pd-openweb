#!/usr/bin/env node
/**
 * 第 0 层门禁：语法零容忍。约 7s，无基线、无漂移。
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
 */
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');
const configPath = path.join(ROOT, 'tsconfig.gate.json');
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

// 与语义门禁一致的噪声剔除：src/library 是预打包压缩产物，__ 前缀是探针
const isNoise = r => r.startsWith('src/library/') || path.basename(r).startsWith('__');

const host = {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: d => {
    console.error('tsconfig 无法解析:', ts.flattenDiagnosticMessageText(d.messageText, ' '));
    process.exit(2);
  },
};

const t0 = Date.now();
const parsed = ts.getParsedCommandLineOfConfigFile(configPath, { incremental: false }, host);
if (parsed.errors.length) {
  for (const e of parsed.errors) console.error('tsconfig 错误:', ts.flattenDiagnosticMessageText(e.messageText, ' '));
  process.exit(2);
}

const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const diags = program.getSyntacticDiagnostics().filter(d => !d.file || !isNoise(rel(d.file.fileName)));
const secs = ((Date.now() - t0) / 1000).toFixed(1);

if (diags.length === 0) {
  console.log(`语法门禁通过：${parsed.fileNames.length} 个文件，0 条语法诊断（${secs}s）`);
  process.exit(0);
}

console.error(`\n语法门禁失败：${diags.length} 条语法诊断（${secs}s）`);
console.error('提示：含 JSX 的文件必须是 .tsx，不能是 .ts —— 这是最常见的原因。\n');
const byFile = new Map();
for (const d of diags) {
  const f = d.file ? rel(d.file.fileName) : '(no file)';
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(d);
}
for (const [f, ds] of byFile) {
  console.error(`  ${f}  (${ds.length} 条)`);
  for (const d of ds.slice(0, 3)) {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    console.error(`     (${line + 1},${character + 1}) TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  }
}
process.exit(1);
