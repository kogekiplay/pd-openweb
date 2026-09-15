#!/usr/bin/env node
/**
 * 给 React class 组件的 extends 子句补上 <any, any> 泛型参数。
 *
 * 为什么做：不写泛型时 TS 把 this.props 推成 Readonly<{}>、this.state 推成 {}，
 * 于是每一次属性访问都报 TS2339。这不是「类型安全」，是噪声——组件当然有 props，
 * 只是 TS 不知道。补 <any, any> 等于如实说「暂时未知」，把噪声换成待办，
 * 让剩下的诊断真正有意义。真实 props 类型是后续工作，无法 codemod。
 *
 * 用 AST 而不是正则：只改 ClassDeclaration/ClassExpression 的 superClass 位置，
 * 不会误伤注释、字符串、或已带泛型的声明。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '../..');
const DRY = process.argv.includes('--dry');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? +process.argv[i + 1] : Infinity; })();

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || p.includes('src/library')) continue; walk(p, out); }
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const isTarget = sc => {
  if (!sc) return false;
  if (sc.type === 'Identifier') return sc.name === 'Component' || sc.name === 'PureComponent';
  if (sc.type === 'MemberExpression' && sc.object.type === 'Identifier' && sc.object.name === 'React'
      && sc.property.type === 'Identifier') return sc.property.name === 'Component' || sc.property.name === 'PureComponent';
  return false;
};

const files = walk(path.join(ROOT, 'src'));
let changedFiles = 0, changedSites = 0, skippedHasGenerics = 0, parseFail = [];
const samples = [];

for (const f of files) {
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (!/extends\s+(React\.)?(Pure)?Component/.test(src)) continue;

  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'unambiguous', errorRecovery: false,
      plugins: ['typescript', 'jsx', 'classProperties', 'classPrivateProperties', 'decorators-legacy', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (e) { parseFail.push([f, e.message.split('\n')[0]]); continue; }

  const edits = [];
  const visit = n => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if ((n.type === 'ClassDeclaration' || n.type === 'ClassExpression') && isTarget(n.superClass)) {
      // superTypeParameters / superTypeArguments：不同 babel 版本字段名不同，两个都查
      if (n.superTypeParameters || n.superTypeArguments) { skippedHasGenerics++; }
      else edits.push(n.superClass.end);
    }
    for (const k of Object.keys(n)) { if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue; visit(n[k]); }
  };
  visit(ast.program.body);

  if (!edits.length) continue;
  let out = src;
  for (const pos of edits.sort((a, b) => b - a)) out = out.slice(0, pos) + '<any, any>' + out.slice(pos);
  changedFiles++; changedSites += edits.length;
  if (samples.length < 5) samples.push([path.relative(ROOT, f), edits.length, src.slice(Math.max(0, edits[0] - 60), edits[0] + 2).split('\n').pop()]);
  if (!DRY && changedFiles <= LIMIT) fs.writeFileSync(f, out);
}

console.log(`${DRY ? '[干跑] ' : '[已写入] '}文件 ${changedFiles} / 改动点 ${changedSites}`);
console.log(`已带泛型跳过: ${skippedHasGenerics}`);
console.log(`解析失败: ${parseFail.length}`);
parseFail.slice(0, 5).forEach(([f, m]) => console.log('  ' + path.relative(ROOT, f) + '  ' + m));
console.log('样本:');
samples.forEach(([f, n, l]) => console.log(`  ${f} (${n} 处)  …${l}`));
