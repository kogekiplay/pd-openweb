/**
 * 扫描：antd 6 已删除的 Drawer/Modal 属性还在被使用的地方（只统计，不改文件）
 *
 * 为什么需要 AST 而不是 grep：`visible` 这个词在本仓极常见 —— ming-ui 的 Dialog/Modal
 * 【仍然】用 visible，各处 state 也叫 visible。裸 grep 出来 90% 是误报。
 * 必须先确认这个 JSX 标签真的解析到 antd 的 Drawer / Modal，才算数。
 *
 * 解析链：
 *   import { Drawer } from 'antd'                 → Drawer
 *   const SettingDrawer = styled(Drawer)`...`     → SettingDrawer 也算
 *   const X = styled(SettingDrawer)               → 继续传递
 *
 * antd 6 删掉的属性（用 `antd info Drawer --version 6.6.3` 核对过）：
 *   visible            → open
 *   afterVisibleChange → afterOpenChange
 * 传了被忽略，抽屉/弹层【静默不显示】，没有任何报错 —— 所以必须靠扫描找出来。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const REMOVED = { visible: 'open', afterVisibleChange: 'afterOpenChange' };

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

const findings = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/from ['"]antd['"]/.test(src)) continue;

  let ast;
  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch {
    continue;
  }

  // 1) 收集从 antd 导入的 Drawer / Modal 的本地名
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

  // 2) 顺着 styled(X) 传递，直到不再新增
  let grew = true;
  while (grew) {
    grew = false;
    traverse(ast, {
      VariableDeclarator(p) {
        const { id, init } = p.node;
        if (id.type !== 'Identifier' || antdNames.has(id.name)) return;
        // styled(X)`...`  /  styled(X)(...)
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

  // 3) 找带了已删属性的 JSX
  traverse(ast, {
    JSXOpeningElement(p) {
      const nameNode = p.node.name;
      const tag = nameNode.type === 'JSXIdentifier' ? nameNode.name : null;
      if (!tag || !antdNames.has(tag)) return;

      for (const attr of p.node.attributes) {
        if (attr.type !== 'JSXAttribute') continue;
        const prop = attr.name.name;
        if (REMOVED[prop]) {
          findings.push({
            file: path.relative(ROOT, file),
            line: attr.loc.start.line,
            tag,
            prop,
            replacement: REMOVED[prop],
          });
        }
      }
    },
  });
}

if (!findings.length) {
  console.log('未发现 antd 6 已删除的 Drawer/Modal 属性。');
} else {
  console.log(`发现 ${findings.length} 处（antd 6 传了会被忽略，弹层静默不显示）：\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  <${f.tag} ${f.prop}>  →  ${f.replacement}`);
  }
}
