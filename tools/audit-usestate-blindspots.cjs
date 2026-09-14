// 审计：codemod 靠 tsc 诊断采类型，实参是 any 时不报错也就采不到。
// 这里找出「带参调用次数 > 诊断条数」的 setter —— 那些多出来的调用就是盲区。
const fs = require('fs'), path = require('path');
const parser = require('@babel/parser'), traverse = require('@babel/traverse').default;
const ROOT = path.resolve('.');
const diagText = fs.readFileSync('/tmp/tsc4.txt', 'utf8');
const OPTS = { sourceType: 'module', allowReturnOutsideFunction: true,
  plugins: ['jsx','typescript','decorators-legacy','classProperties','optionalChaining','nullishCoalescingOperator'] };
const changed = require('child_process').execSync('git diff --name-only', { encoding: 'utf8' })
  .split('\n').filter(f => /\.(tsx|ts)$/.test(f));
const risky = [];
for (const rel of changed) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (!/useState</.test(src)) continue;
  let ast; try { ast = parser.parse(src, OPTS); } catch { continue; }
  const setters = new Map();
  traverse(ast, { VariableDeclarator(p) {
    const { id, init } = p.node;
    if (id.type !== 'ArrayPattern' || id.elements.length !== 2) return;
    if (!init || init.type !== 'CallExpression' || init.callee.name !== 'useState') return;
    if (init.arguments.length || !(init.typeArguments || init.typeParameters)) return;
    const st = id.elements[1];
    if (st && st.type === 'Identifier') setters.set(st.name, src.slice((init.typeArguments || init.typeParameters).start, (init.typeArguments || init.typeParameters).end));
  }});
  if (!setters.size) continue;
  const calls = new Map();
  traverse(ast, { CallExpression(p) {
    const c = p.node.callee;
    if (c.type === 'Identifier' && setters.has(c.name) && p.node.arguments.length) {
      calls.set(c.name, (calls.get(c.name) || 0) + 1);
    }
  }});
  for (const [name, declared] of setters) {
    const nCalls = calls.get(name) || 0;
    const nDiags = (diagText.match(new RegExp(`^${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(.*`, 'gm')) || [])
      .filter(l => l.includes("(prevState: undefined) => undefined")).length;
    if (nCalls > nDiags) risky.push(`${rel}  ${name}${declared}  带参调用 ${nCalls} 次，但只有 ${nDiags} 条诊断 → 有 ${nCalls - nDiags} 次实参是 any`);
  }
}
console.log(risky.length ? risky.join('\n') : '无盲区');
console.log(`\n共 ${risky.length} 处需人工确认`);
