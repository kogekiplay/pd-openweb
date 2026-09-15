/**
 * ⚠ 【本脚本在 TypeScript 7 下已失效，跑不起来】
 * 7.0 是 Go 原生移植版，`require('typescript')` 只剩 { version, versionMajorMinor }，
 * ts.createProgram / ts.SyntaxKind / ts.sys 全部不存在，一执行就是
 * `TypeError: Cannot read properties of undefined`。
 * 保留它是作为当初那次迁移的【记录】（判据、踩过的坑、度量口径都在注释里）。
 * 要重新启用，按 tools/ts7.ts 的适配层改写 —— 那里写清了新 API 的形状和三个坑。
 */
/**
 * 给「名字已经说明了内容」的变量标领域类型
 *
 * 剩下的 TS7006 有 8800 多条是 `xxx.map(o => ...)` / `.filter` / `.forEach` / `.find`
 * 的回调参数 —— 根因不在回调，在【接收者是 any】。给接收者标一次类型，它身上所有
 * 回调的参数 TS 自己就推出来了，比一个个标回调划算得多，也更真：类型写在数据源上，
 * 而不是写在每个使用点上。
 *
 * 证据和 codemod-domain-callback-params.ts 同一条：本仓 controls / rows 这类名字
 * 语义单一。那张表已经过差分闸门验证。这里只多一条约束 ——
 * 【只动 TS 推成 any 的变量】。TS 已经知道它是 string[] 的，说明名字骗了人，不碰。
 *
 * 【不动】：
 *   - 有类型标注的
 *   - 解构出来的（单个绑定元素标不了类型）
 *   - 不在 src/*.ts(x) 下的（allowJs 把 .js 也拉进 program 了）
 *   - 推断结果不是 any / any[] 的
 *
 * 【只管变量声明，不要扩到形参】——扩过一次，闸门一次拦下 159 条，原因有两条：
 *   1) 形参上的名字证据比变量弱得多。变量是本地刚算出来的，名字由写的人定；
 *      形参的内容由调用方决定。实测 chat/messageContent.tsx 和
 *      kc/attachmentInfo.tsx 里叫 records 的形参收到的是一个【数字】（条数），
 *      标成 RecordRow[] 当场 TS2345。
 *   2) 无括号单参箭头（`records => ...`）标类型要补括号，而 '(' 和 ')' 跟类型
 *      标注插在同一个偏移上，顺序稍有不慎就写成 `(records): RecordRow[] => ...`
 *      —— 那是给箭头标【返回类型】，语法合法、语义全错，只会在下游冒出
 *      "Type 'void' is not assignable to 'RecordRow[]'" 这种看不懂的报错。
 *
 * 解构目标归 codemod-domain-destructure-types.ts。
 *
 * 用法：
 *   node tools/codemod-domain-variable-types.ts --list
 *   node tools/codemod-domain-variable-types.ts
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { DOMAIN, EXCLUDE } = require('./domain-names.ts');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

const byFile = new Map();
let skippedTyped = 0;

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;
  const rel = path.relative(ROOT, sf.fileName);
  if (EXCLUDE.some(e => rel.startsWith(e))) continue;
  (function visit(n) {
    if (ts.isVariableDeclaration(n) && !n.type && ts.isIdentifier(n.name) && DOMAIN.has(n.name.text)) {
      const t = checker.typeToString(checker.getTypeAtLocation(n.name));
      if (t === 'any' || t === 'any[]') {
        const file = sf.fileName;
        if (!byFile.has(file)) byFile.set(file, { text: sf.getFullText(), ins: [] });
        byFile
          .get(file)
          .ins.push({ pos: n.name.end, text: `: ${DOMAIN.get(n.name.text)}`, type: DOMAIN.get(n.name.text), name: n.name.text });
      } else {
        skippedTyped += 1;
      }
    }
    n.forEachChild(visit);
  })(sf);
}

function addImport(src, names) {
  const re = /^import type \{([^}]*)\} from 'src\/utils\/controlTypes';$/m;
  const m = src.match(re);
  if (m) {
    const merged = [
      ...new Set([...m[1].split(',').map(x => x.trim()).filter(Boolean), ...names]),
    ].sort();
    return src.replace(re, `import type { ${merged.join(', ')} } from 'src/utils/controlTypes';`);
  }
  const lines = src.split('\n');
  let idx = 0;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      depth = (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
      idx = i + 1;
    } else if (depth > 0) {
      depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
      idx = i + 1;
    }
  }
  lines.splice(idx, 0, `import type { ${[...names].sort().join(', ')} } from 'src/utils/controlTypes';`);
  return lines.join('\n');
}

let total = 0;
for (const [file, bucket] of [...byFile].sort()) {
  bucket.ins.sort((a, b) => b.pos - a.pos);
  total += bucket.ins.length;
  console.log(`${path.relative(ROOT, file)}: ${bucket.ins.map(i => i.name).join(', ')}`);
  if (!APPLY) continue;
  let src = bucket.text;
  for (const i of bucket.ins) src = src.slice(0, i.pos) + i.text + src.slice(i.pos);
  // 名字已经在文件里绑过就别再 import（有的文件自己有同名的本地类型）
  const need = [...new Set(bucket.ins.map(i => i.type.replace('[]', '')))].filter(
    n => !new RegExp(`\\b${n}\\b`).test(bucket.text),
  );
  if (need.length) src = addImport(src, need);
  fs.writeFileSync(file, src);
}

console.log(`\n${APPLY ? '已标' : '可标'} ${total} 个变量，涉及 ${byFile.size} 个文件（TS 已知道真类型、跳过的 ${skippedTyped} 个）`);
