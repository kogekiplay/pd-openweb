/**
 * antd 6 的 Drawer/Modal：visible → open、afterVisibleChange → afterOpenChange（一次性工具）
 *
 * 为什么这批漏了：antd 5 里这两个属性只是【废弃 + 控制台警告】，功能还在；
 * antd 6 直接删掉，传了被忽略 —— 抽屉从此静默不显示，
 * 没有报错、没有警告、网络也正常，只是点了没反应。
 * 本仓 17 处全部中招（见 tools/scan-antd6-drawer-modal-visible.cjs）。
 *
 * 为什么要 AST 而不是 grep/正则：`visible` 在本仓极常见 ——
 * ming-ui 的 Dialog/Modal 至今仍用 visible，各处 state 也叫 visible。
 * 必须先把标签解析到 antd 的 Drawer/Modal（含 styled() 包装链）才能改。
 *
 * 改之前核对过两件事：
 *   1. 这些 styled 模板【没有】在 CSS 插值里读 visible，改名不会带坏样式；
 *   2. 没有任何一处已经同时传了 open，不会产生重复属性。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const RENAME = { visible: 'open', afterVisibleChange: 'afterOpenChange' };

const PARSE_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

let changedFiles = 0;
let changedProps = 0;

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/from ['"]antd['"]/.test(src)) continue;

  let ast;
  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch {
    continue;
  }

  const antdNames = new Set();
  traverse(ast, {
    ImportDeclaration(p) {
      if (p.node.source.value !== 'antd') return;
      for (const s of p.node.specifiers) {
        if (s.type === 'ImportSpecifier' && ['Drawer', 'Modal'].includes(s.imported.name)) {
          antdNames.add(s.local.name);
        }
      }
    },
  });
  if (!antdNames.size) continue;

  let grew = true;
  while (grew) {
    grew = false;
    traverse(ast, {
      VariableDeclarator(p) {
        const { id, init } = p.node;
        if (id.type !== 'Identifier' || antdNames.has(id.name)) return;
        let callee = init;
        if (callee?.type === 'TaggedTemplateExpression') callee = callee.tag;
        if (callee?.type === 'CallExpression') {
          const fn = callee.callee;
          const isStyled =
            (fn?.type === 'Identifier' && fn.name === 'styled') ||
            (fn?.type === 'MemberExpression' && fn.object?.name === 'styled');
          const arg = callee.arguments?.[0];
          if (isStyled && arg?.type === 'Identifier' && antdNames.has(arg.name)) {
            antdNames.add(id.name);
            grew = true;
          }
        }
      },
    });
  }

  // 收集要改写的位置（属性名的 start/end），从后往前替换以免位移
  const edits = [];
  traverse(ast, {
    JSXOpeningElement(p) {
      const nameNode = p.node.name;
      const tag = nameNode.type === 'JSXIdentifier' ? nameNode.name : null;
      if (!tag || !antdNames.has(tag)) return;

      const present = new Set(
        p.node.attributes.filter(a => a.type === 'JSXAttribute').map(a => a.name.name),
      );

      for (const attr of p.node.attributes) {
        if (attr.type !== 'JSXAttribute') continue;
        const from = attr.name.name;
        const to = RENAME[from];
        if (!to) continue;
        // 已经有目标属性就跳过，避免产生重复属性（实际扫描下来本仓没有这种情况）
        if (present.has(to)) {
          console.warn(`跳过 ${path.relative(ROOT, file)}:${attr.loc.start.line} —— 已存在 ${to}`);
          continue;
        }
        edits.push({ start: attr.name.start, end: attr.name.end, to });
      }
    },
  });

  if (!edits.length) continue;

  let out = src;
  edits
    .sort((a, b) => b.start - a.start)
    .forEach(e => {
      out = out.slice(0, e.start) + e.to + out.slice(e.end);
    });

  fs.writeFileSync(file, out);
  changedFiles += 1;
  changedProps += edits.length;
  console.log(`${path.relative(ROOT, file)}  改写 ${edits.length} 处`);
}

console.log(`\n完成：${changedFiles} 个文件，${changedProps} 处属性。`);
