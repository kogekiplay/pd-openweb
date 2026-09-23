/**
 * 给 noUnusedParameters（TS6133「参数声明了没用」）把未用的参数改名成 _名字。
 * 输入是 tsc 的命中清单，每行 "path:line:col"（tsc 的行列都从 1 开始）。
 *
 * 【为什么改名而不是删】2026-09-23 统计的 725 个普通参数里，721 个后面还跟着被用到的参数 ——
 * 它们是占位用的（(e, index) => index、(text, record) => record.name），删了后面的参数就错位了。
 * 剩下 4 个在末尾，删掉会改变函数的 length：React.forwardRef 的渲染函数在 dev 下会检查参数个数，
 * _.curry 这类按 length 工作。改名对运行时完全无影响（参数名不参与求值，length 不变），所以统一改名。
 * 参数解构出来的属性（{ a, b }）不在这里处理 —— 要看有没有 rest 元素，人工改。
 *
 * 【改名不能遮住外层变量】函数体里要是恰好引用了外层一个叫 _e 的变量，把参数 e 改成 _e 就把它遮住了。
 * 所以新名字要在这个函数的作用域链上没有绑定、函数体里也没有同名的引用；冲突就换成 _unused 前缀再试。
 *
 * 解析走 @babel/core + 仓库 .babelrc，与真实构建看到的语法一致。
 *
 * 用法：node tools/codemod-unused-params.ts < 命中清单
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

interface Edit {
  start: number;
  end: number;
  text: string;
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

const stats = { files: 0, renamed: 0, fallbackNames: 0, skipped: [] as string[] };

for (const [file, list] of byFile) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = babel.parseSync(code, { filename: path.resolve(file), babelrc: true, sourceType: 'module' });
  const lineStarts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1);

  // 参数位置 -> { 函数, 标识符 }。只收「顶层参数」和「带默认值的顶层参数」，解构出来的不收
  const params = new Map();
  traverse(ast, {
    Function(p) {
      for (const param of p.node.params) {
        const id =
          param.type === 'Identifier'
            ? param
            : param.type === 'AssignmentPattern' && param.left.type === 'Identifier'
              ? param.left
              : null;
        if (id && id.name !== 'this') params.set(id.start, { fnPath: p, id });
      }
    },
  });

  const edits: Edit[] = [];
  for (const h of list) {
    const pos = lineStarts[h.line - 1] + (h.col - 1);
    const found = params.get(pos);
    if (!found) {
      stats.skipped.push(`${file}:${h.line}:${h.col} 不是顶层参数（解构出来的要人工看）`);
      continue;
    }
    const { fnPath, id } = found;
    const name = id.name;
    if (code.slice(id.start, id.start + name.length) !== name) {
      stats.skipped.push(`${file}:${h.line}:${h.col} 源码与标识符对不上`);
      continue;
    }

    // 函数体里所有出现过的标识符名（含对外层变量的引用），新名字不能和它们撞
    const namesInside = new Set<string>();
    fnPath.traverse({
      Identifier(q) {
        namesInside.add(q.node.name);
      },
    });
    const free = (candidate: string) => !fnPath.scope.hasBinding(candidate) && !namesInside.has(candidate);
    let newName = `_${name}`;
    if (!free(newName)) {
      newName = `_unused${name[0].toUpperCase()}${name.slice(1)}`;
      stats.fallbackNames++;
      if (!free(newName)) {
        stats.skipped.push(`${file}:${h.line}:${h.col} 找不到不冲突的新名字（${name}）`);
        continue;
      }
    }
    edits.push({ start: id.start, end: id.start + name.length, text: newName });
    stats.renamed++;
  }

  let out = code;
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (out !== code) {
    fs.writeFileSync(file, out);
    stats.files++;
  }
}

console.log(
  `改了 ${stats.files} 个文件：参数改名 ${stats.renamed} 处（其中因重名改用 _unused 前缀的 ${stats.fallbackNames} 处）`,
);
if (stats.skipped.length) console.log(`跳过 ${stats.skipped.length} 处（需人工）：\n  ` + stats.skipped.join('\n  '));
