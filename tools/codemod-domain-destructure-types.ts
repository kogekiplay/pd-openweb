/**
 * ⚠ 【本脚本在 TypeScript 7 下已失效，跑不起来】
 * 7.0 是 Go 原生移植版，`require('typescript')` 只剩 { version, versionMajorMinor }，
 * ts.createProgram / ts.SyntaxKind / ts.sys 全部不存在，一执行就是
 * `TypeError: Cannot read properties of undefined`。
 * 保留它是作为当初那次迁移的【记录】（判据、踩过的坑、度量口径都在注释里）。
 * 要重新启用，按 tools/ts7.ts 的适配层改写 —— 那里写清了新 API 的形状和三个坑。
 */
/**
 * 给解构出来的领域变量标类型
 *
 * 实测：controls/rows 这类接收者在 `.map/.filter/...` 里出现 918 次且类型是 any，
 * 其中 **565 次来自解构**（`const { controls } = props`），成员访问只占 223、
 * 裸变量声明只占 20。所以大头在解构上。
 *
 * 单个绑定元素标不了类型，但整个解构目标可以：
 *   const { controls, foo } = props;
 *   → const { controls, foo }: { controls: FormControl[]; [key: string]: any } = props;
 * 索引签名让其余名字照旧拿 any，只把认识的那几个钉准。
 *
 * 【只在初值类型是 any 时改】。初值是具体类型时，加注解等于要求它可赋值给带索引
 * 签名的类型 —— interface 没有隐式索引签名，会当场报错。any 则永远可赋值。
 *
 * 【只管变量声明的解构，不要扩到解构形参】——扩过一次，闸门一次拦下 159 条。
 * 根子上的原因：`function f({ controls })` 标成 `{ controls: FormControl[]; ... }`
 * 会让 controls 变成【必填】，于是所有不传它的调用点齐刷刷 TS2741
 * （"Property 'newControls' is missing in type '{}'"）。想避开就得给每个属性加 `?`，
 * 可一加 `?`，strictNullChecks 下下游又全是"可能是 undefined"——换一类错而已。
 * 变量声明没有这个问题：它右边一定有初值，不存在"调用方没传"。
 *
 * 名字表和排除名单都在 tools/domain-names.ts，与 codemod-domain-variable-types.ts 共用。
 *
 * 用法：
 *   node tools/codemod-domain-destructure-types.ts --list
 *   node tools/codemod-domain-destructure-types.ts
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
let skipNotAny = 0;

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;
  const rel = path.relative(ROOT, sf.fileName);
  if (EXCLUDE.some(e => rel.startsWith(e))) continue;

  (function visit(n) {
    if (
      ts.isVariableDeclaration(n) &&
      !n.type &&
      n.initializer &&
      ts.isObjectBindingPattern(n.name)
    ) {
      const hits = [];
      for (const el of n.name.elements) {
        if (el.dotDotDotToken || !ts.isIdentifier(el.name)) continue;
        // 属性名以 propertyName 为准（`const { a: b } = x` 里键是 a）
        const key =
          el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
        if (!DOMAIN.has(key)) continue;
        if (checker.typeToString(checker.getTypeAtLocation(el.name)) !== 'any') continue;
        hits.push([key, DOMAIN.get(key)]);
      }
      if (hits.length) {
        if (checker.typeToString(checker.getTypeAtLocation(n.initializer)) !== 'any') {
          skipNotAny += 1;
        } else {
          const props = [...new Map(hits).entries()].map(([k, t]) => `${k}: ${t}`).join('; ');
          const file = sf.fileName;
          if (!byFile.has(file)) byFile.set(file, { text: sf.getFullText(), ins: [] });
          byFile.get(file).ins.push({
            pos: n.name.end,
            text: `: { ${props}; [key: string]: any }`,
            types: hits.map(h => h[1]),
          });
        }
      }
    }
    n.forEachChild(visit);
  })(sf);
}

function addImport(src, names) {
  const re = /^import type \{([^}]*)\} from 'src\/utils\/controlTypes';$/m;
  const m = src.match(re);
  if (m) {
    const merged = [...new Set([...m[1].split(',').map(x => x.trim()).filter(Boolean), ...names])].sort();
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
  console.log(`${path.relative(ROOT, file)}: ${bucket.ins.length} 处`);
  if (!APPLY) continue;
  let src = bucket.text;
  for (const i of bucket.ins) src = src.slice(0, i.pos) + i.text + src.slice(i.pos);
  const need = [...new Set(bucket.ins.flatMap(i => i.types).map(t => t.replace('[]', '')))].filter(
    nm => !new RegExp(`\\b${nm}\\b`).test(bucket.text),
  );
  if (need.length) src = addImport(src, need);
  fs.writeFileSync(file, src);
}

console.log(`\n${APPLY ? '已标' : '可标'} ${total} 处解构，涉及 ${byFile.size} 个文件（初值不是 any、跳过 ${skipNotAny} 处）`);
