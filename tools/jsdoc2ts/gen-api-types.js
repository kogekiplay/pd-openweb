#!/usr/bin/env node
/**
 * jsdoc2ts — 把 src/api/*.ts 的 JSDoc(swagger codegen 产物) 无损转成真 TS 参数类型，就地重写。
 *
 * 用法:
 *   node tools/jsdoc2ts/gen-api-types.js homeApp
 *   node tools/jsdoc2ts/gen-api-types.js --all
 *   node tools/jsdoc2ts/gen-api-types.js --dry homeApp      # 只出报告，不写文件
 *   node tools/jsdoc2ts/gen-api-types.js --report=/tmp/r.json homeApp
 *
 * 相对 ts-pilot-types/probe/gen-types.js 的四处修正：
 *   (1) [R15 修正] args 永远可选（args?:）。JSDoc 的 @param 没有 required 信息，
 *       swagger 把所有字段都列成必填，所以「JSDoc 里有」≠「后端必填」。
 *       旧版对「有声明参数的方法」把 args 设成必填，凭空造出 10 条 TS2554。
 *   (2) 空类型 `@param {}` → `unknown`（旧版 `any`）。不编造类型，但保留 key 名，
 *       key 名才是 TS2561(拼写近似建议) 的触发条件。
 *   (3) 嵌套 `args.a.b` 递归建成真嵌套对象类型（旧版把顶层键降级成 any，是有损的）。
 *   (4) 幂等：已带类型注解的方法会被重写而不是叠加，可反复跑。
 *
 * 刻意不做的事：
 *   - 不给 args 类型加索引签名。加了就关掉 excess-property check，TS2561 全灭。
 *   - 不碰返回值。mdyAPI 声明为 any(types/global.d.ts:17)，JSDoc 的 @returns 只有
 *     `Promise<Boolean, ErrorModel>` 这种非法/无信息形式，响应侧类型需要 swagger。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '../..');
const API_DIR = path.join(ROOT, 'src/api');

// JSDoc 原始类型 → TS。故意保守：拿不准就用 unknown，不用 any。
// unknown 作为「入参属性」类型是安全的（任何值都能赋给 unknown），
// 且不像 any 那样会把后续推断污染掉。
const TYPE_MAP = {
  string: 'string',
  String: 'string',
  integer: 'number',
  int: 'number',
  long: 'number',
  number: 'number',
  Number: 'number',
  double: 'number',
  float: 'number',
  boolean: 'boolean',
  Boolean: 'boolean',
  bool: 'boolean',
  array: 'any[]',
  Array: 'any[]',
  object: 'Record<string, any>',
  Object: 'Record<string, any>',
};

function mapType(raw) {
  const t = String(raw || '').trim();
  if (!t) return { ts: 'unknown', reason: 'jsdoc-empty' };
  if (TYPE_MAP[t]) return { ts: TYPE_MAP[t], reason: 'mapped' };
  // `array|string`、`Array<x>` 等复合写法：不猜，记为未识别
  return { ts: 'unknown', reason: 'unrecognized:' + t };
}

const PARAM_RE = /^\s*\*?\s*@param\s+\{([^}]*)\}\s+args\.([A-Za-z0-9_$][A-Za-z0-9_$.]*)/;

/** 把扁平的 dotted 路径集合建成嵌套类型树 */
function buildTree(entries) {
  const root = { children: new Map(), leaf: null };
  for (const { pathParts, ts } of entries) {
    let node = root;
    for (let i = 0; i < pathParts.length; i++) {
      const seg = pathParts[i];
      if (!node.children.has(seg)) node.children.set(seg, { children: new Map(), leaf: null });
      node = node.children.get(seg);
      if (i === pathParts.length - 1) node.leaf = ts;
    }
  }
  return root;
}

function renderTree(node, indent) {
  const pad = ' '.repeat(indent);
  const lines = [];
  for (const [key, child] of node.children) {
    const safe = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    if (child.children.size === 0) {
      lines.push(`${pad}${safe}?: ${child.leaf};`);
    } else {
      // 既是叶子又有子键（swagger 里出现过 `args.a` 和 `args.a.b` 同时声明）：
      // 以嵌套对象为准，父级声明的标量类型丢弃并记账。
      lines.push(`${pad}${safe}?: {`);
      lines.push(renderTree(child, indent + 2));
      lines.push(`${pad}};`);
    }
  }
  return lines.join('\n');
}

function convertFile(mod, stats) {
  const file = path.join(API_DIR, mod + '.ts');
  if (!fs.existsSync(file)) throw new Error('no such api module: ' + file);
  const code = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['typescript'] });

  const dflt = ast.program.body.find(n => n.type === 'ExportDefaultDeclaration');
  if (!dflt) throw new Error('no default export in ' + mod);
  const obj = dflt.declaration;
  if (obj.type !== 'ObjectExpression') throw new Error('default export is not an object literal in ' + mod);

  const edits = [];
  const methods = [];

  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') throw new Error(`unexpected property kind ${prop.type} in ${mod}`);
    const name = prop.key.name || prop.key.value;
    const fn = prop.value;
    if (fn.type !== 'FunctionExpression' && fn.type !== 'ArrowFunctionExpression') {
      throw new Error(`unexpected value kind ${fn.type} for ${mod}.${name}`);
    }
    stats.methods++;

    const doc = (prop.leadingComments || [])
      .filter(c => c.type === 'CommentBlock')
      .map(c => c.value)
      .join('\n');

    const seen = new Map(); // dotted key -> {ts, raw, reason}
    for (const line of doc.split('\n')) {
      const m = PARAM_RE.exec(line);
      if (!m) continue;
      const raw = m[1];
      const key = m[2].replace(/\.$/, '');
      if (seen.has(key)) {
        stats.dupKeys++;
        continue; // 首次声明优先
      }
      const t = mapType(raw);
      seen.set(key, { ts: t.ts, raw, reason: t.reason });
      stats.paramsTotal++;
      if (t.reason === 'mapped') stats.paramsTyped++;
      else if (t.reason === 'jsdoc-empty') stats.paramsJsdocEmpty++;
      else stats.paramsUnrecognized++;
      if (key.includes('.')) stats.paramsNested++;
    }

    const keys = [...seen.keys()];
    let argsType;
    if (keys.length === 0) {
      // JSDoc 完全没声明参数（GET 方法的 query 参数 codegen 不解析）。
      // 用 Record<string, any>：类型信息为 0，就不该产生 excess-property 诊断。
      // 写 `{}` 会让任何实参都变成假阳性。
      argsType = 'Record<string, any>';
      stats.methodsZeroParams++;
    } else {
      const tree = buildTree(keys.map(k => ({ pathParts: k.split('.'), ts: seen.get(k).ts })));
      argsType = '{\n' + renderTree(tree, 6) + '\n    }';
      stats.methodsWithParams++;
    }

    // (1) R15 修正：args 永远可选
    const newParams = `args?: ${argsType}, options: ApiOptions = {}`;
    const ps = fn.params;
    edits.push({ start: ps[0].start, end: ps[ps.length - 1].end, text: newParams });

    methods.push({
      method: name,
      paramCount: keys.length,
      params: Object.fromEntries([...seen].map(([k, v]) => [k, { ts: v.ts, jsdoc: v.raw, reason: v.reason }])),
    });
  }

  edits.sort((a, b) => b.start - a.start);
  let out = code;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  stats.files++;
  return { file, out, methods };
}

// ---- main ----
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const reportArg = argv.find(a => a.startsWith('--report='));
let mods = argv.filter(a => !a.startsWith('--'));
if (argv.includes('--all')) {
  mods = fs
    .readdirSync(API_DIR)
    .filter(f => f.endsWith('.ts') && !f.startsWith('__'))
    .map(f => f.replace(/\.ts$/, ''));
}
if (!mods.length) {
  console.error('usage: node tools/jsdoc2ts/gen-api-types.js <module...> | --all  [--dry] [--report=path]');
  process.exit(2);
}

const stats = {
  files: 0,
  methods: 0,
  methodsWithParams: 0,
  methodsZeroParams: 0,
  paramsTotal: 0,
  paramsTyped: 0,
  paramsJsdocEmpty: 0,
  paramsUnrecognized: 0,
  paramsNested: 0,
  dupKeys: 0,
};
const report = {};
const failures = [];

for (const mod of mods) {
  try {
    const r = convertFile(mod, stats);
    if (!dry) fs.writeFileSync(r.file, r.out);
    report[mod] = r.methods;
    console.log(
      `${mod}: methods=${r.methods.length} withParams=${r.methods.filter(m => m.paramCount).length} zeroParam=${r.methods.filter(m => !m.paramCount).length}`,
    );
  } catch (e) {
    failures.push({ mod, error: e.message });
    console.error(`SKIP ${mod}: ${e.message}`);
  }
}

const autoRate = stats.paramsTotal ? ((stats.paramsTyped / stats.paramsTotal) * 100).toFixed(1) : '0';
console.log('\n=== stats ===');
console.log(JSON.stringify(stats, null, 1));
console.log(`concrete-type rate: ${stats.paramsTyped}/${stats.paramsTotal} = ${autoRate}%`);
if (failures.length) console.log(`\nfailed modules (${failures.length}):`, JSON.stringify(failures, null, 1));
if (reportArg) {
  fs.writeFileSync(reportArg.slice('--report='.length), JSON.stringify({ stats, failures, report }, null, 1));
}
