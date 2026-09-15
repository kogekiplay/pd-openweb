/**
 * ⚠ 【本脚本在 TypeScript 7 下已失效，跑不起来】
 * 7.0 是 Go 原生移植版，`require('typescript')` 只剩 { version, versionMajorMinor }，
 * ts.createProgram / ts.SyntaxKind / ts.sys 全部不存在，一执行就是
 * `TypeError: Cannot read properties of undefined`。
 * 保留它是作为当初那次迁移的【记录】（判据、踩过的坑、度量口径都在注释里）。
 * 要重新启用，按 tools/ts7.ts 的适配层改写 —— 那里写清了新 API 的形状和三个坑。
 */
/**
 * 给 `foo = []` 这种形参标上真实的数组类型
 *
 * `function f(rows = [])` 里 rows 被推成 never[]，下游 rows.map(r => r.id) 全报
 * "Property 'id' does not exist on type 'never'"。never[] 是 TS 的兜底，不是事实 ——
 * 这个形参当然会装东西。
 *
 * 两条证据，按优先级：
 *   1) 【调用点】把所有调用点的第 i 个实参类型取出来求并集。这是 TS 自己会做的推断，
 *      只是形参有默认值时它不做。拿不到有用类型（全是 any / undefined）就走第 2 条。
 *   2) 【领域名字】controls/rows 这类名字在本仓语义单一，表和
 *      codemod-domain-callback-params.ts 里那张一致（那张已经过一轮差分闸门验证）。
 *
 * 两条都不成立就【不动】—— 不写 any[] 充数。
 *
 * 只处理 `= []`。`= {}` 不处理：调用点传的是各式对象字面量，求并集要么超长要么
 * 触发多余属性检查（TS2353），codemod-props-interface.ts 已经在这上面栽过一次。
 *
 * 用法：
 *   node tools/codemod-array-param-types.ts --list
 *   node tools/codemod-array-param-types.ts
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');
const MAX_LEN = 100;

// 显式写出键值类型：从元组字面量数组推不出 Map<string, string>，
// 下游 .get() 拿到 unknown，用 .replace() 就报错。
const DOMAIN = new Map<string, string>([
  ...[
    'controls',
    'allControls',
    'originControls',
    'relationControls',
    'templateControls',
    'formControls',
    'receiveControls',
    'controlList',
    'newControls',
    'visibleControls',
    'subControls',
    'childTableControls',
    'availableControls',
    'currentControls',
    'sourceControls',
    'worksheetControls',
  ].map((n): [string, string] => [n, 'FormControl[]']),
  ...['rows', 'originRows', 'newRows', 'records', 'selectedRows', 'realRows', 'rootRows', 'existingRows'].map((n): [string, string] => [
    n,
    'RecordRow[]',
  ]),
]);

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

// 1) 收集所有 `= []` 且没有类型标注的形参
const params = new Map(); // paramNode -> {decl, idx, name, file}
for (const sf of program.getSourceFiles()) {
  // 【必须卡扩展名】：allowJs 开着，.js/.spec.js 也在 program 里。往 .js 写类型标注
  // 会当场炸（TS8010），而且语法门禁只扫 .ts/.tsx，扫不出来。
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;
  (function visit(n) {
    if (
      ts.isParameter(n) &&
      !n.type &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isArrayLiteralExpression(n.initializer) &&
      n.initializer.elements.length === 0
    ) {
      const fn = n.parent;
      params.set(n, { fn, idx: fn.parameters.indexOf(n), name: n.name.text, sf, argTypes: new Set(), any: false });
    }
    n.forEachChild(visit);
  })(sf);
}

// 2) 全程序扫调用点，把实参类型灌回形参
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  (function visit(n) {
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const sig = checker.getResolvedSignature(n);
      const decl = sig && sig.getDeclaration();
      if (decl && decl.parameters) {
        const args = n.arguments || [];
        decl.parameters.forEach((p, i) => {
          const rec = params.get(p);
          if (!rec || i >= args.length) return;
          const t = checker.getTypeAtLocation(args[i]);
          const s = checker.typeToString(
            checker.getBaseTypeOfLiteralType(t),
            args[i],
            ts.TypeFormatFlags.NoTruncation,
          );
          if (/^(undefined|null|never\[\]|undefined\[\]|null\[\])$/.test(s)) return;
          if (/\bany\b/.test(s) || s.includes('import(') || s.includes('...') || s.length > MAX_LEN) {
            rec.any = true;
            return;
          }
          rec.argTypes.add(s);
        });
      }
    }
    n.forEachChild(visit);
  })(sf);
}

// 3) 定类型
const byFile = new Map();
const stat = { callsite: 0, domain: 0, skipped: 0 };
for (const [node, rec] of params) {
  let type = null;
  if (!rec.any && rec.argTypes.size) {
    const u = [...rec.argTypes].sort().join(' | ');
    // 只收数组类型：调用点传了非数组说明这个形参根本不是数组，别乱标
    if (u.length <= MAX_LEN && [...rec.argTypes].every(s => /(\[\]|^Array<)/.test(s))) {
      type = u;
      stat.callsite += 1;
    }
  }
  if (!type && DOMAIN.has(rec.name)) {
    type = DOMAIN.get(rec.name);
    stat.domain += 1;
  }
  if (!type) {
    stat.skipped += 1;
    continue;
  }
  const file = rec.sf.fileName;
  if (!byFile.has(file)) byFile.set(file, { text: rec.sf.getFullText(), ins: [] });
  byFile.get(file).ins.push({ pos: node.name.end, type, name: rec.name });
}

const DOMAIN_TYPES = new Set(['FormControl[]', 'RecordRow[]']);

let total = 0;
for (const [file, bucket] of [...byFile].sort()) {
  bucket.ins.sort((a, b) => b.pos - a.pos);
  total += bucket.ins.length;
  console.log(`${path.relative(ROOT, file)}: ${bucket.ins.map(i => `${i.name}: ${i.type}`).join(', ')}`);
  if (!APPLY) continue;
  let src = bucket.text;
  for (const i of bucket.ins) src = src.slice(0, i.pos) + `: ${i.type}` + src.slice(i.pos);
  // 用到领域类型就补 import
  // 名字已经在文件里绑过就别再 import（DataFormat.ts 自己有个 ./types 的 FormControl，
  // 盲目补 import 会 TS2300 Duplicate identifier）
  const need = [...new Set<string>(bucket.ins.map(i => i.type).filter(t => DOMAIN_TYPES.has(t)))]
    .map(t => t.replace('[]', ''))
    .filter(n => !new RegExp(`\\b${n}\\b`).test(bucket.text));
  if (need.length) src = addImport(src, need);
  fs.writeFileSync(file, src);
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

console.log(
  `\n${APPLY ? '已标' : '可标'} ${total} 个形参（调用点推出 ${stat.callsite} / 领域名字 ${stat.domain}），` +
    `证据不足跳过 ${stat.skipped}，候选总数 ${params.size}`,
);
