/**
 * 判定某个 (line, col) 是否落在注释内。
 *
 * 为什么不用 ts.createScanner：裸词法扫描器没有解析器反馈，无法正确处理
 * 模板字符串 / 正则 vs 除号 / JSX。实测 src/utils/app.js 用裸 scanner 只扫出
 * 266 个 token、0 条注释 —— 它把一个反引号之后的 1161 个字符整块吞成了
 * 模板字符串。所以必须走真解析器。
 *
 * 做法：ts.createSourceFile 建树（有解析错误时解析器会 recover，树仍可用），
 * 然后递归 getChildren(sf) 遍历到【每一个 token】，把每个 token 的
 * leading/trailing comment trivia 区间收集起来。注释必然是某个 token 的
 * leading trivia（文件末尾的注释是 EndOfFileToken 的 leading trivia），
 * 所以这个枚举是完备的。
 */
const fs = require('fs');
const ts = require('typescript');

function scriptKindOf(fileName) {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.ts')) return ts.ScriptKind.TS;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function buildInfo(absPath, fileName) {
  let text;
  try {
    text = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }

  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);

  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, /*setParentNodes*/ false, scriptKindOf(fileName));

  const ranges = [];
  const seen = new Set();
  const add = rs => {
    if (!rs) return;
    for (const r of rs) {
      const k = r.pos + ':' + r.end;
      if (!seen.has(k)) {
        seen.add(k);
        ranges.push([r.pos, r.end]);
      }
    }
  };

  // 递归到每个 token。用显式栈，避免深层 JSX 把调用栈打爆。
  const stack = [sf];
  while (stack.length) {
    const node = stack.pop();
    add(ts.getLeadingCommentRanges(text, node.pos));
    add(ts.getTrailingCommentRanges(text, node.end));
    let kids;
    try {
      kids = node.getChildren(sf);
    } catch {
      kids = [];
    }
    for (const k of kids) stack.push(k);
  }

  ranges.sort((a, b) => a[0] - b[0]);
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
      info = buildInfo(require('path').join(this.root, relPath), relPath);
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

module.exports = { CommentIndex };
