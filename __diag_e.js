// 切片 E 诊断采集。冷跑，不用 incremental。
const ts = require('/Users/kogeki/dev/pd-openweb-judge-e/node_modules/typescript');
const path = require('path');
const fs = require('fs');

const ROOT = '/Users/kogeki/dev/pd-openweb-judge-e';
const cfgPath = path.join(ROOT, 'tsconfig.json');
const cfgFile = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfgFile.config, ts.sys, ROOT);

const program = ts.createProgram(parsed.fileNames, parsed.options);

const slice = new Set(
  fs
    .readFileSync('/tmp/sliceE.txt', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(p => path.join(ROOT, p)),
);

// 1) 全 program 语法诊断（铁律 5 修正版：只能靠 getSyntacticDiagnostics）
const syn = program.getSyntacticDiagnostics();
console.log('SYNTACTIC_TOTAL=' + syn.length);
syn.slice(0, 20).forEach(d => {
  console.log('SYN ' + (d.file && d.file.fileName) + ' TS' + d.code + ' ' + ts.flattenDiagnosticMessageText(d.messageText, ' '));
});

// 2) 全 program 语义诊断总数（用于确认没塌）
const allSem = program.getSemanticDiagnostics();
console.log('SEMANTIC_TOTAL_PROGRAM=' + allSem.length);

// 3) 探针确认
const probe = allSem.filter(d => d.file && /__sanity__/.test(d.file.fileName));
console.log('PROBE_HITS=' + probe.length + ' ' + probe.map(d => 'TS' + d.code).join(','));

// 4) 切片诊断
const mine = allSem.filter(d => d.file && slice.has(d.file.fileName));
console.log('SLICE_E_TOTAL=' + mine.length);
const out = [];
for (const d of mine) {
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  out.push({
    file: path.relative(ROOT, d.file.fileName),
    line: line + 1,
    col: character + 1,
    code: 'TS' + d.code,
    msg: ts.flattenDiagnosticMessageText(d.messageText, ' | '),
  });
}
out.sort((a, b) => (a.file + ':' + String(a.line).padStart(6, '0')).localeCompare(b.file + ':' + String(b.line).padStart(6, '0')));
fs.writeFileSync('/tmp/sliceE_diags.json', JSON.stringify(out, null, 1));

// 每个文件的诊断数
const per = {};
out.forEach(d => (per[d.file] = (per[d.file] || 0) + 1));
console.log('--- per file ---');
Object.keys(per)
  .sort()
  .forEach(f => console.log(per[f] + '\t' + f));
console.log('--- by code ---');
const byCode = {};
out.forEach(d => (byCode[d.code] = (byCode[d.code] || 0) + 1));
Object.entries(byCode)
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => console.log(n + '\t' + c));
