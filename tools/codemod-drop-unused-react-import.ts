/**
 * 切到 jsx: react-jsx（automatic runtime）之后，只为 JSX 才 import 的 React 变成「声明了但没读」（TS6133）。
 * 这个 codemod 把它们删掉：
 *   - import React from 'react';                → 整行删掉
 *   - import React, { useState } from 'react';  → import { useState } from 'react';
 *   - import * as React from 'react';           → 整行删掉
 *
 * 【命中清单来自 tsc 本身】用 --jsx react-jsx 跑一遍，只取
 * "'React' is declared but its value is never read" 的那些文件 —— 编译器确认值没被读的才动。
 * React.Component / React.useState 这类还在读的不会命中；类型位置的用法（React.ReactNode）
 * 编译器也算「用了」，同样不会被删。
 *
 * 【解析用 @babel/parser、改写基准用磁盘原文】TS7 没有 JS 侧的解析 API（见 tools/ts7.ts），
 * 这里只需要找到 import 语句的起止位置；babel 的偏移量就是按传进去的原文算的（含 BOM），
 * 所以直接在原文上切，不会错位。
 *
 * 用法：node tools/codemod-drop-unused-react-import.ts          # 改写
 *       node tools/codemod-drop-unused-react-import.ts --dry    # 只报数，不落盘
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const parser = require('@babel/parser');

const ROOT: string = path.resolve(__dirname, '..');
const DRY: boolean = process.argv.includes('--dry');

interface Hit {
  file: string;
  line: number;
}

interface ImportNode {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number } };
  source: { value: string };
  importKind?: string;
  specifiers: { type: string; local: { name: string } }[];
}

function collectHits(): Hit[] {
  const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  const res = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '--jsx', 'react-jsx'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  const HIT = /^(\S[^(]*)\((\d+),\d+\): error TS6133: 'React' is declared but its value is never read\.$/;
  const hits: Hit[] = [];
  for (const line of out.split('\n')) {
    const m = line.match(HIT);
    if (m && m[1] && m[2]) hits.push({ file: m[1], line: Number(m[2]) });
  }
  // 编译器没跑起来时输出里一条都匹配不上，读成「没有要改的」就是静默失败
  if (!hits.length && !/error TS/.test(out)) {
    throw new Error(`tsc 输出里没有任何诊断，多半是没跑起来：\n${out.slice(0, 400)}`);
  }
  return hits;
}

/** 删掉 [start, end) 这一段；它若独占一行，连同行尾换行一起删 */
function removeStatement(text: string, start: number, end: number): string {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const before = text.slice(lineStart, start);
  let stop = end;
  while (text[stop] === ' ' || text[stop] === '\t') stop++;
  if (/^[\s﻿]*$/.test(before) && (text[stop] === '\n' || text[stop] === '\r' || stop === text.length)) {
    if (text[stop] === '\r') stop++;
    if (text[stop] === '\n') stop++;
    return text.slice(0, lineStart) + text.slice(lineStart, start).replace(/[ \t]+$/, '') + text.slice(stop);
  }
  return text.slice(0, start) + text.slice(end);
}

function rewrite(file: string, lines: number[]): 'dropped' | 'trimmed' | string {
  const abs = path.join(ROOT, file);
  const text: string = fs.readFileSync(abs, 'utf8');
  const ast = parser.parse(text, {
    sourceType: 'module',
    plugins: /\.tsx$/.test(file) ? ['typescript', 'jsx'] : ['typescript'],
  });
  const imports: ImportNode[] = ast.program.body.filter(
    (n: ImportNode) => n.type === 'ImportDeclaration' && n.source.value === 'react' && n.importKind !== 'type',
  );
  const target = imports.find(
    n =>
      lines.includes(n.loc.start.line) &&
      n.specifiers.some(
        s => (s.type === 'ImportDefaultSpecifier' || s.type === 'ImportNamespaceSpecifier') && s.local.name === 'React',
      ),
  );
  if (!target) return `跳过：诊断行 ${lines.join(',')} 上没找到 React 的默认 / 命名空间导入`;

  let next: string;
  let kind: 'dropped' | 'trimmed';
  if (target.specifiers.length === 1) {
    next = removeStatement(text, target.start, target.end);
    kind = 'dropped';
  } else {
    const stmt = text.slice(target.start, target.end);
    const trimmed = stmt.replace(/^import\s+React\s*,\s*/, 'import ');
    if (trimmed === stmt) return `跳过：认不出这条 import 的写法：${stmt.split('\n')[0]}`;
    next = text.slice(0, target.start) + trimmed + text.slice(target.end);
    kind = 'trimmed';
  }
  if (!DRY) fs.writeFileSync(abs, next);
  return kind;
}

const hits = collectHits();
const byFile = new Map<string, number[]>();
for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) || []), h.line]);

const tally: Record<string, number> = {};
const skipped: string[] = [];
for (const [file, lines] of byFile) {
  const r = rewrite(file, lines);
  if (r === 'dropped' || r === 'trimmed') tally[r] = (tally[r] || 0) + 1;
  else skipped.push(`${file}: ${r}`);
}

console.log(
  `${DRY ? '[dry] ' : ''}命中 ${byFile.size} 个文件：整行删 ${tally.dropped || 0}，去掉默认导入保留具名导入 ${tally.trimmed || 0}，跳过 ${skipped.length}`,
);
if (skipped.length) console.log(skipped.join('\n'));
