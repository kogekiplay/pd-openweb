/**
 * 给 noImplicitOverride（TS4114「覆盖了基类成员，必须写 override」）补 override 修饰符。
 * 输入是 tsc 的命中清单，每行 "path:line:col"（tsc 的行列都从 1 开始，报在成员名上）。
 *
 * 2026-09-23 那一轮 2900 条全部是 React Component / PureComponent 的子类：render、生命周期、state 这些。
 * override 是纯类型修饰符，babel 原样擦掉 —— 验证方式是改前改后分别用仓库 .babelrc 转译、要求产物逐字节相同。
 *
 * 插入位置按 TS 的修饰符顺序：[public|private|protected] [static] override [readonly] [async] [get|set] 名字。
 * 也就是跳过开头的访问修饰符和 static，插在它们后面。
 *
 * 用法：node tools/codemod-override.ts < 命中清单
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;

interface Hit {
  file: string;
  line: number;
  col: number;
}

const hits: Hit[] = fs
  .readFileSync(0, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean)
  .map(l => {
    const m = l.match(/^(.+?):(\d+):(\d+)$/);
    if (!m) throw new Error(`无法解析命中行：${l}`);
    return { file: m[1], line: +m[2], col: +m[3] };
  });

const byFile = new Map<string, Hit[]>();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}

const LEADING_MODIFIER = /^(?:public|private|protected|static)\s+/;
const stats = { files: 0, inserted: 0, skipped: [] as string[] };

for (const [file, list] of byFile) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = babel.parseSync(code, { filename: path.resolve(file), babelrc: true, sourceType: 'module' });
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);

  // 成员名的起点 -> 成员节点
  const members = new Map();
  traverse(ast, {
    'ClassMethod|ClassProperty|ClassAccessorProperty'(p) {
      members.set(p.node.key.start, p.node);
    },
  });

  const inserts: number[] = [];
  for (const h of list) {
    const pos = lineStarts[h.line - 1] + (h.col - 1);
    const member = members.get(pos);
    if (!member) {
      stats.skipped.push(`${file}:${h.line}:${h.col} 定位不到类成员`);
      continue;
    }
    if (member.override) continue;
    if (member.declare) {
      stats.skipped.push(`${file}:${h.line}:${h.col} declare 字段（override 不能与 declare 同用），人工看`);
      continue;
    }
    // 从成员起点往后跳过访问修饰符和 static
    let at = member.start;
    for (;;) {
      const m = code.slice(at, member.key.start).match(LEADING_MODIFIER);
      if (!m) break;
      at += m[0].length;
    }
    if (at > member.key.start) {
      stats.skipped.push(`${file}:${h.line}:${h.col} 修饰符解析越过了成员名`);
      continue;
    }
    inserts.push(at);
    stats.inserted++;
  }

  let out = code;
  for (const at of [...new Set(inserts)].sort((a, b) => b - a)) out = out.slice(0, at) + 'override ' + out.slice(at);
  if (out !== code) {
    fs.writeFileSync(file, out);
    stats.files++;
  }
}

console.log(`改了 ${stats.files} 个文件：补 override ${stats.inserted} 处`);
if (stats.skipped.length) console.log(`跳过 ${stats.skipped.length} 处（需人工）：\n  ` + stats.skipped.join('\n  '));
