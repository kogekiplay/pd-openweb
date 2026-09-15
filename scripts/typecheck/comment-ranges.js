/**
 * 判定某个 (line, col) 是否落在注释内。
 *
 * 【为什么不能用裸词法扫描器】没有解析器反馈就分不清模板字符串 / 正则与除号 /
 * JSX 文本。这条是实测出来的：早先用 TS 的 createScanner 扫 src/utils/app.js
 * 只得到 266 个 token、0 条注释 —— 它把一个反引号之后的 1161 个字符整块
 * 吞成了模板字符串。所以必须走真解析器。
 *
 * 【为什么从 TypeScript 换到 @babel/parser】TypeScript 7 把编译器 JS API 整个
 * 搬到了 `typescript/unstable/*`，而那套里【没有 parser】—— 只有 scanner 和
 * 注释区间工具，拿不到 SourceFile。能拿到 AST 的只有 `unstable/sync` 的
 * Program，那要先起一个 Go 进程、建整个工程，为了判几个注释位置太重了。
 * babel 的 parser 本来就在依赖里（构建链就用它转译），直接吐 `comments`
 * 数组，连遍历 token 都省了，而且 jsx / typescript 两个插件一开就能同时
 * 处理 .ts/.tsx/.js/.jsx。
 *
 * 正确性由 comment-ranges.spec.js 的负向控制保证：正则里的 `//`、模板字符串
 * 里的 `//`、JSX 文本里的 `//` 都【不能】被判成注释。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const PLUGINS = ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'classPrivateProperties'];

function buildInfo(absPath, fileName) {
  let text;
  try {
    text = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }

  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);

  let ast;
  try {
    ast = parser.parse(text, {
      sourceType: 'module',
      // 解析出错也要尽量拿到注释：门禁本来就是跑在「有问题的代码」上的
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      plugins: PLUGINS,
    });
  } catch {
    // 连 recovery 都救不回来就当作「没有注释」，宁可少剔噪也不要误剔
    return { lineStarts, ranges: [] };
  }

  const ranges = (ast.comments || []).map(c => [c.start, c.end]).sort((a, b) => a[0] - b[0]);
  return { lineStarts, ranges };
}

class CommentIndex {
  constructor(root) {
    this.root = root;
    this.cache = new Map();
  }

  /** true=注释内, false=真代码, null=文件读不到/位置越界 */
  isInComment(relPath, line, col) {
    let info = this.cache.get(relPath);
    if (info === undefined) {
      info = buildInfo(path.join(this.root, relPath), relPath);
      this.cache.set(relPath, info);
    }
    if (!info) return null;
    const ls = info.lineStarts[line - 1];
    if (ls === undefined) return null;
    const off = ls + (col - 1);
    for (const [a, b] of info.ranges) {
      if (off < a) break;
      if (off < b) return true;
    }
    return false;
  }
}

module.exports = { CommentIndex, buildInfo };
