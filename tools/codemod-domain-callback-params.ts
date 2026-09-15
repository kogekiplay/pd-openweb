/**
 * 按【接收者名字】给回调参数标领域类型（可重复跑，幂等）
 *
 * 为什么按接收者名字而不是按参数名：
 * 参数名（c / item / r / o）什么都说明不了，这次会话已经因为"照参数名猜类型"
 * 被差分闸门挡下六次。而【被遍历的集合】叫什么是有意义的 ——
 * `controls.map(...)` 里流过的一定是控件，`rows.filter(...)` 里流过的一定是记录行。
 * 这是本仓稳定的命名事实，不是猜测。
 *
 * 只处理形如 `<receiver>.<method>(<param> => ...)` 且 param 是无类型标注的单个标识符。
 * 已标注的、解构的、多参的一律跳过。
 *
 * 名字表是保守的：只收那些在本仓语义单一、不会串味的接收者名。
 * 拿不准的（data / list / items / options）【不收】—— 它们在不同页面指代不同东西。
 *
 * 用法：
 *   node tools/codemod-domain-callback-params.ts --list <dir>   # 只统计
 *   node tools/codemod-domain-callback-params.ts <dir>          # 改写
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');

// 接收者名 -> 元素类型。只列语义单一的。
const CONTROL_RECEIVERS = new Set([
  'controls',
  'allControls',
  'originControls',
  'relationControls',
  'templateControls',
  // 注意：showControls 【不能】收 —— 它是 string[]（控件 id 列表）不是控件数组。
  // 误收过一次：worksheet 的日志子表 showControls.map((key) => ...) 被标成 FormControl，
  // 下游 record.oldValue[key] 立刻报 "FormControl cannot be used as an index type"。
  'formData',
  'newControls',
  'visibleControls',
  'subControls',
  'childTableControls',
  'availableControls',
  'currentControls',
  'sourceControls',
  'worksheetControls',
]);

const ROW_RECEIVERS = new Set([
  'rows',
  'originRows',
  'newRows',
  'records',
  'selectedRows',
  'filterRows',
  'realRows',
  'rootRows',
  'existingRows',
  'staticRows',
]);

const METHODS = new Set(['map', 'filter', 'forEach', 'find', 'findIndex', 'some', 'every', 'flatMap', 'sort']);

const TYPES = { control: 'FormControl', row: 'RecordRow' };

const PARSE_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.spec\.[jt]sx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function receiverName(node) {
  // a.b.controls.map(...)  → controls ；controls.map(...) → controls
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  return null;
}

function processFile(file, apply) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/\.(map|filter|forEach|find|findIndex|some|every|flatMap|sort)\(/.test(src)) return 0;

  let ast;
  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch {
    return 0;
  }

  const edits = [];
  const needed = new Set();

  traverse(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type !== 'MemberExpression' || callee.computed) return;
      if (callee.property.type !== 'Identifier' || !METHODS.has(callee.property.name)) return;

      const recv = receiverName(callee.object);
      if (!recv) return;

      let kind = null;
      if (CONTROL_RECEIVERS.has(recv)) kind = 'control';
      else if (ROW_RECEIVERS.has(recv)) kind = 'row';
      if (!kind) return;

      const fn = p.node.arguments[0];
      if (!fn || (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')) return;
      if (fn.params.length !== 1) return;
      const param = fn.params[0];
      if (param.type !== 'Identifier' || param.typeAnnotation) return;

      // 无括号单参箭头要补括号
      const head = src.slice(fn.start, param.start + 1);
      const needsParens = fn.type === 'ArrowFunctionExpression' && !/\(/.test(head);

      edits.push({ start: param.start, end: param.end, type: TYPES[kind], needsParens });
      needed.add(TYPES[kind]);
    },
  });

  if (!edits.length) return 0;
  if (!apply) return edits.length;

  let out = src;
  edits
    .sort((a, b) => b.start - a.start)
    .forEach(e => {
      const ann = `: ${e.type}`;
      if (e.needsParens) {
        out = out.slice(0, e.start) + '(' + out.slice(e.start, e.end) + ann + ')' + out.slice(e.end);
      } else {
        out = out.slice(0, e.end) + ann + out.slice(e.end);
      }
    });

  // 补 import type（已有就合并，没有就新插一行）
  const want = [...needed].sort();
  const importRe = /^import type \{([^}]*)\} from 'src\/utils\/controlTypes';$/m;
  const m = out.match(importRe);
  if (m) {
    const have = m[1].split(',').map(x => x.trim()).filter(Boolean);
    const merged = [...new Set([...have, ...want])].sort();
    out = out.replace(importRe, `import type { ${merged.join(', ')} } from 'src/utils/controlTypes';`);
  } else {
    const lines = out.split('\n');
    let idx = 0;
    let depth = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('import ')) {
        depth = (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
        idx = i + 1;
      } else if (depth > 0) {
        depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
        idx = i + 1;
      }
    }
    lines.splice(idx, 0, `import type { ${want.join(', ')} } from 'src/utils/controlTypes';`);
    out = lines.join('\n');
  }

  fs.writeFileSync(file, out);
  return edits.length;
}

const args = process.argv.slice(2);
const list = args[0] === '--list';
const dirs = (list ? args.slice(1) : args).map(d => (path.isAbsolute(d) ? d : path.join(ROOT, d)));
if (!dirs.length) dirs.push(path.join(ROOT, 'src'));

let total = 0;
let files = 0;
for (const d of dirs) {
  for (const f of walk(d)) {
    const n = processFile(f, !list);
    if (n) {
      total += n;
      files += 1;
      if (!list) console.log(`${path.relative(ROOT, f)}: ${n} 处`);
    }
  }
}
console.log(`\n${list ? '可标注' : '已标注'} ${total} 处，涉及 ${files} 个文件。`);
