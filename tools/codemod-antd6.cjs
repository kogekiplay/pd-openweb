/**
 * antd 5 → 6 的 JSX 属性迁移，按【import 绑定】判定归属。
 *
 * 为什么必须自己写：
 * v5 那次有官方的 @ant-design/codemod-v5（jscodeshift，按 import 绑定追踪）。
 * v6 【没有】对应的 codemod —— `@ant-design/cli migrate --apply` 产出的是给 agent 看的
 * 提示清单（"Instructions for Code Agent"），不做 AST 改写，而且它的文件清单不按
 * import 绑定算：它列了 73 个 Button 文件，可全仓只有 33 个文件从 antd 导入 Button。
 *
 * 为什么不能用正则：本仓 ming-ui 有大量与 antd 同名的组件，实测导入文件数
 *   Tooltip  antd 1  / ming-ui 666      Checkbox antd 51 / ming-ui 287
 *   Dropdown antd 82 / ming-ui 264      Button   antd 33 / ming-ui 263
 *   Input    antd 127/ ming-ui 168
 * 另有 5 个文件两边同名都导入。按名字改 = 把 ming-ui 的组件一起改坏。
 *
 * 为什么是【文本手术】而不是 @babel/generator 重打印：
 * generator 会把整个文件按自己的风格重排，4000 个文件的 diff 会彻底淹掉真实改动，
 * 也没法 review。这里只用 AST 定位属性节点的 start/end，然后在原始字符串上替换那一段，
 * 其余字符一个不动。
 *
 * 用法：
 *   node tools/codemod-antd6.cjs              # dry-run，只报告
 *   node tools/codemod-antd6.cjs --apply      # 落盘
 *   node tools/codemod-antd6.cjs --rule visible-to-open   # 只跑某条规则
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseMod = require('@babel/traverse');

const traverse = traverseMod.default || traverseMod;
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const SKIP_DIR = /(^|\/)(node_modules|library)(\/|$)/;
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// ───────────────────────────── 规则 ─────────────────────────────
// kind:
//   rename  —— 只改属性名，值原样保留。最安全。
//   wrap    —— overlayClassName={x} → classNames={{ root: x }}。
//              目标属性已存在时【不改】，报出来人工处理（合并语义得看现场）。
//   const   —— arrowPointAtCenter → arrow={{ pointAtCenter: true }}，丢弃原值。
//              只在原值是 true / 裸属性时才改，其余报出来。
//
// 组件名是 antd 的【导出名】，不是文件里的局部名。
const RULES = [
  // ── 第一批：v6 真删掉的，现在就是坏的 ──
  {
    name: 'visible-to-open',
    kind: 'rename',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'visible',
    to: 'open',
  },
  {
    name: 'onVisibleChange-to-onOpenChange',
    kind: 'rename',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'onVisibleChange',
    to: 'onOpenChange',
  },
  {
    name: 'arrowPointAtCenter-to-arrow',
    kind: 'const',
    components: ['Tooltip', 'Popover', 'Popconfirm'],
    from: 'arrowPointAtCenter',
    to: 'arrow={{ pointAtCenter: true }}',
    conflictsWith: 'arrow',
  },

  {
    // antd 5 的 overlay 同时接受【元素】和【返回元素的函数】两种形态，v6 删掉了它。
    // 落点是 popupRender：实测 antd 6 的 renderOverlay() 里，不传 menu 时
    // overlayNode 为 undefined，随后 overlayNode = mergedPopupRender(overlayNode)，
    // 返回值直接当弹层内容，外面仍包同一个 OverrideProvider —— 与 overlay 1:1 等价。
    // 不改成 menu={{items}}：本仓 36 处里几乎都是 this.renderOverlay() 这类返回 JSX 的
    // 方法调用，改 menu 等于重写每个 render 方法，是语义改造不是迁移。
    //
    // 两种形态转换方式相反，所以只处理能【静态证明】的：
    //   元素 / 调用 / 三元 / 逻辑表达式  → popupRender={() => 原值}
    //   箭头函数 / function 表达式      → popupRender={原值}（只改名）
    //   裸标识符、成员表达式（moreMenu、this.renderShowColumns）→ 判不出来，报出来人工定
    name: 'overlay-to-popupRender',
    kind: 'overlay',
    components: ['Dropdown'],
    from: 'overlay',
  },

  // ── 第二批：v6 仍可用但已废弃，用户要求一并迁移 ──
  {
    name: 'destroyTooltipOnHide-to-destroyOnHidden',
    kind: 'rename',
    components: ['Tooltip', 'Popover', 'Popconfirm'],
    from: 'destroyTooltipOnHide',
    to: 'destroyOnHidden',
  },
  {
    name: 'destroyPopupOnHide-to-destroyOnHidden',
    kind: 'rename',
    components: ['Dropdown'],
    from: 'destroyPopupOnHide',
    to: 'destroyOnHidden',
  },
  {
    name: 'overlayClassName-to-classNames-root',
    kind: 'wrap',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'overlayClassName',
    to: 'classNames',
    key: 'root',
  },
  {
    name: 'overlayStyle-to-styles-root',
    kind: 'wrap',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'overlayStyle',
    to: 'styles',
    key: 'root',
  },
  {
    name: 'overlayInnerStyle-to-styles-container',
    kind: 'wrap',
    components: ['Tooltip', 'Popover', 'Popconfirm'],
    from: 'overlayInnerStyle',
    to: 'styles',
    key: 'container',
  },
];

// ───────────────────────── 收集文件 ─────────────────────────
function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);

    if (e.isDirectory()) {
      if (!SKIP_DIR.test(abs)) collect(abs, out);
    } else if (EXTS.has(path.extname(e.name)) && !e.name.endsWith('.spec.js')) {
      out.push(abs);
    }
  }

  return out;
}

// ──────────────────── antd 的 import 绑定 ────────────────────
// 只认这三种来源；`antd/es/tooltip` 这类深路径也算，取路径段推组件名。
function antdBindings(ast) {
  const map = new Map(); // 局部名 -> antd 导出名

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;

    const src = node.source.value;

    if (src !== 'antd' && !src.startsWith('antd/es/') && !src.startsWith('antd/lib/')) continue;

    for (const s of node.specifiers) {
      if (s.type === 'ImportSpecifier') {
        map.set(s.local.name, s.imported.name || s.imported.value);
      } else if (s.type === 'ImportDefaultSpecifier' && src !== 'antd') {
        // import Tooltip from 'antd/es/tooltip'
        const seg = src.split('/')[2];
        map.set(s.local.name, seg.charAt(0).toUpperCase() + seg.slice(1));
      }
    }
  }

  return map;
}

// JSX 元素名 → antd 组件名；解析不出来（或被局部变量遮蔽）返回 null
function resolveComponent(openingPath, bindings) {
  const nameNode = openingPath.node.name;
  let rootName;

  if (nameNode.type === 'JSXIdentifier') rootName = nameNode.name;
  else if (nameNode.type === 'JSXMemberExpression' && nameNode.object.type === 'JSXIdentifier')
    rootName = nameNode.object.name;
  else return null;

  if (!bindings.has(rootName)) return null;

  // 【防遮蔽】确认这个名字在此处确实绑定到那条 import，而不是同名的局部变量/参数。
  // 不查的话，`const Tooltip = ...` 之后的用法会被误判成 antd 的。
  const binding = openingPath.scope.getBinding(rootName);

  if (binding && binding.kind !== 'module') return null;

  const base = bindings.get(rootName);

  return nameNode.type === 'JSXMemberExpression' ? `${base}.${nameNode.property.name}` : base;
}

// ───────────────────────── 主流程 ─────────────────────────
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const onlyRule = argv.includes('--rule') ? argv[argv.indexOf('--rule') + 1] : null;
const rules = RULES.filter(r => !onlyRule || r.name === onlyRule);

if (!rules.length) {
  console.error(`没有匹配的规则。可用：\n  ${RULES.map(r => r.name).join('\n  ')}`);
  process.exit(2);
}

const stats = new Map(rules.map(r => [r.name, { changed: 0, skipped: [] }]));
let filesWithAntd = 0;
let filesChanged = 0;

for (const file of collect(SRC)) {
  const src = fs.readFileSync(file, 'utf8');

  if (!src.includes('antd')) continue;

  let ast;

  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
      errorRecovery: true,
    });
  } catch (e) {
    console.error(`解析失败（跳过）：${path.relative(ROOT, file)} — ${e.message}`);
    continue;
  }

  const bindings = antdBindings(ast);

  if (!bindings.size) continue;

  filesWithAntd++;

  const edits = []; // {start, end, text, rule}

  traverse(ast, {
    JSXOpeningElement(p) {
      const comp = resolveComponent(p, bindings);

      if (!comp) return;

      const attrNames = new Set(
        p.node.attributes.filter(a => a.type === 'JSXAttribute').map(a => a.name.name),
      );

      for (const rule of rules) {
        if (!rule.components.includes(comp)) continue;

        const attr = p.node.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === rule.from);

        if (!attr) continue;

        const where = `${path.relative(ROOT, file)}:${attr.loc.start.line}`;

        if (rule.kind === 'rename') {
          edits.push({ start: attr.name.start, end: attr.name.end, text: rule.to, rule: rule.name });
          continue;
        }

        if (rule.kind === 'const') {
          const v = attr.value;
          const isTrue =
            v === null || (v.type === 'JSXExpressionContainer' && v.expression.type === 'BooleanLiteral' && v.expression.value === true);

          if (!isTrue || attrNames.has(rule.conflictsWith)) {
            stats.get(rule.name).skipped.push(`${where}（${attrNames.has(rule.conflictsWith) ? `已有 ${rule.conflictsWith}` : '取值非 true'}）`);
            continue;
          }

          edits.push({ start: attr.start, end: attr.end, text: rule.to, rule: rule.name });
          continue;
        }

        if (rule.kind === 'overlay') {
          const v = attr.value;

          if (!v || v.type !== 'JSXExpressionContainer') {
            stats.get(rule.name).skipped.push(`${where}（取值不是表达式容器）`);
            continue;
          }

          const ex = v.expression;
          const text = src.slice(ex.start, ex.end);
          const WRAP = ['JSXElement', 'JSXFragment', 'CallExpression', 'ConditionalExpression', 'LogicalExpression'];
          const ASIS = ['ArrowFunctionExpression', 'FunctionExpression'];

          if (WRAP.includes(ex.type)) {
            edits.push({ start: attr.start, end: attr.end, text: `popupRender={() => ${text}}`, rule: rule.name });
          } else if (ASIS.includes(ex.type)) {
            edits.push({ start: attr.start, end: attr.end, text: `popupRender={${text}}`, rule: rule.name });
          } else {
            stats.get(rule.name).skipped.push(`${where}  overlay={${text}}（${ex.type}：元素还是函数判不出来）`);
          }

          continue;
        }

        if (rule.kind === 'wrap') {
          if (attrNames.has(rule.to)) {
            stats.get(rule.name).skipped.push(`${where}（已有 ${rule.to}=，合并语义需现场判断）`);
            continue;
          }

          const v = attr.value;

          if (!v) {
            stats.get(rule.name).skipped.push(`${where}（裸属性，无值）`);
            continue;
          }

          const inner =
            v.type === 'JSXExpressionContainer' ? src.slice(v.expression.start, v.expression.end) : src.slice(v.start, v.end);

          edits.push({
            start: attr.start,
            end: attr.end,
            text: `${rule.to}={{ ${rule.key}: ${inner} }}`,
            rule: rule.name,
          });
        }
      }
    },
  });

  if (!edits.length) continue;

  filesChanged++;

  // 从后往前替换，避免前面的改动移动后面的偏移
  edits.sort((a, b) => b.start - a.start);

  let out = src;

  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    stats.get(e.rule).changed++;
  }

  if (APPLY) fs.writeFileSync(file, out);
}

// 下限断言：一个引 antd 的文件都没认出来，说明绑定解析坏了
if (filesWithAntd < 100) {
  console.error(`只认出 ${filesWithAntd} 个从 antd 导入组件的文件，绑定解析大概率坏了`);
  process.exit(1);
}

console.log(`${APPLY ? '已改写' : 'dry-run'}：扫到 ${filesWithAntd} 个从 antd 导入组件的文件，命中 ${filesChanged} 个\n`);

for (const r of rules) {
  const s = stats.get(r.name);

  if (!s.changed && !s.skipped.length) continue;

  console.log(`  ${r.name}：改 ${s.changed} 处${s.skipped.length ? `，跳过 ${s.skipped.length} 处` : ''}`);
  s.skipped.slice(0, 8).forEach(x => console.log(`      跳过 ${x}`));
  if (s.skipped.length > 8) console.log(`      …还有 ${s.skipped.length - 8} 处`);
}

if (!APPLY) console.log('\n（dry-run，未写文件。确认后加 --apply）');
