/**
 * 给函数组件的解构参数补 `= undefined`（React 19 的 @types/react 迁移，一次性工具）。
 *
 * 根因：@types/react 18 的 JSX.LibraryManagedAttributes 会读组件的 propTypes
 * （MergePropTypes<P, InferProps<typeof propTypes>>），凡是 propTypes 里没标
 * .isRequired 的 prop 都被推成【可选】。@types/react 19 把 propTypes 从类型系统里
 * 整个删掉了（与运行时移除对齐），于是 props 类型只能从解构模式推断 ——
 * 解构时没写默认值的 prop 一律变成【必填】，所有没传它的调用点报
 * TS2741 / TS2739。
 *
 * 补 `= undefined` 只影响类型，不改运行时：不传时本来就是 undefined。
 * 这里只处理【实际报错】的那几个组件+prop，不做全仓扫荡 —— 大部分组件的调用点
 * 恰好都传齐了，没有报错就不该去动。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');

// [文件, 组件名, 需要补默认值的 prop]
const TARGETS = [
  ['src/pages/worksheet/common/FreeFieldRunner/FreeFieldRunner.tsx', 'FreeFieldRunner', ['runFlag', 'className']],
  ['src/ming-ui/components/PhoneNumberInput/index.tsx', 'PhoneNumberInput', ['inputClassName']],
  ['src/pages/widgetConfig/widgetSetting/components/VerifyModifyDialog.tsx', 'VerifyModifyDialog', ['desc', 'cancelText']],
  ['src/pages/Statistics/ChartDialog/DisplaySetup.tsx', 'DisplaySetup', ['reportData', 'changeCurrentReport', 'currentReport']],
  ['src/pages/widgetConfig/widgetSetting/components/DevelopWithAI/ControlPreview.tsx', 'ControlPreview', ['compReRenderFlag', 'className']],
  ['src/pages/Chatbot/PublicShare/Content.tsx', 'Content', ['isSmallMode']],
  ['src/pages/Chatbot/PublicShare/Header.tsx', 'Header', ['title', 'iconUrl', 'appId', 'projectId']],
  ['src/pages/mingo/common/Header.tsx', 'Header', ['error', 'isShare', 'isSmallMode', 'onCopyLink', 'onContinueChat']],
  ['src/pages/workflow/WorkflowSettings/EditFlow/components/WhiteNode.tsx', 'WhiteNode', ['nodeId', 'isCopy', 'hasError']],
];

function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(n => visit(n, fn));
  if (node.type) fn(node);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue;
    visit(node[k], fn);
  }
}

let total = 0;
const problems = [];

for (const [rel, comp, props] of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    problems.push(`${rel} — 文件不存在`);
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, { sourceType: 'module', errorRecovery: true, plugins: ['jsx', 'typescript', 'decorators-legacy'] });
  } catch (e) {
    problems.push(`${rel} — 解析失败: ${e.message.slice(0, 60)}`);
    continue;
  }

  // 找到该组件的第一个参数（ObjectPattern）
  let pattern = null;
  visit(ast.program, node => {
    if (pattern) return;
    const isTarget =
      (node.type === 'FunctionDeclaration' && node.id && node.id.name === comp) ||
      (node.type === 'VariableDeclarator' && node.id && node.id.name === comp && node.init &&
        (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression'));
    if (!isTarget) return;
    const fn = node.type === 'FunctionDeclaration' ? node : node.init;
    const p0 = fn.params && fn.params[0];
    if (p0 && p0.type === 'ObjectPattern') pattern = p0;
  });

  if (!pattern) {
    problems.push(`${rel} — 找不到 ${comp} 的 ObjectPattern 参数`);
    continue;
  }

  const edits = [];
  for (const want of props) {
    const prop = pattern.properties.find(
      p => p.type === 'ObjectProperty' && p.key && p.key.name === want,
    );
    if (!prop) {
      problems.push(`${rel} — ${comp} 的解构里没有 ${want}`);
      continue;
    }
    if (prop.value.type === 'AssignmentPattern') continue; // 已有默认值
    if (prop.value.type !== 'Identifier') {
      problems.push(`${rel} — ${comp}.${want} 是嵌套解构/重命名，跳过人工处理`);
      continue;
    }
    edits.push(prop.value.end);
  }

  if (!edits.length) continue;
  edits.sort((a, b) => b - a);
  let out = src;
  for (const at of edits) {
    out = out.slice(0, at) + ' = undefined' + out.slice(at);
    total++;
  }
  fs.writeFileSync(file, out);
  console.log(`✅ ${rel} — ${comp}: 补了 ${edits.length} 个`);
}

console.log(`\n共补 ${total} 处默认值`);
if (problems.length) {
  console.log(`\n⚠ 需人工处理 ${problems.length} 条:`);
  problems.forEach(p => console.log('  ' + p));
}
