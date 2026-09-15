/**
 * comment-ranges 的负向控制。
 *
 * 这个模块只有一个职责：把「诊断落在注释里」和「落在真代码里」分开。
 * 判错的代价是不对称的 ——
 *   把真代码误判成注释 ⇒ 差分门禁把真诊断剔掉，回归就漏过去了；
 *   把注释误判成代码   ⇒ 只是多留几条噪声。
 * 所以下面的重点全在【不能误判成注释】那一侧：正则里的 `//`、模板字符串里的
 * `//`、JSX 文本里的 `//`，都是裸词法扫描器会栽的地方
 *（2026-09 从 TypeScript 的 API 换成 @babel/parser 时，就是靠这几条把实现钉住的）。
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CommentIndex } = require('./comment-ranges.ts');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-ranges-'));

/** 写个临时文件，返回 (line, col) -> 是否在注释里 */
function probe(name, source) {
  fs.writeFileSync(path.join(dir, name), source);
  const idx = new CommentIndex(dir);
  return (line, col) => idx.isInComment(name, line, col);
}

// ── 1. 基本能力：真注释要认出来，真代码不能误判 ──────────────────
{
  const at = probe(
    'basic.ts',
    ['// 行注释', 'const a = 1;', '/* 块', '   注释 */', 'const b = 2;'].join('\n'),
  );
  assert.strictEqual(at(1, 3), true, '行注释内应判为注释');
  assert.strictEqual(at(2, 7), false, 'const a 是真代码');
  assert.strictEqual(at(3, 3), true, '块注释首行');
  assert.strictEqual(at(4, 5), true, '块注释次行');
  assert.strictEqual(at(5, 7), false, 'const b 是真代码');
}

// ── 2. 正则里的 // 不是注释 ────────────────────────────────────
{
  const at = probe('regex.ts', ['const r = /a\\/\\/b/;', 'const c = 1;'].join('\n'));
  // 第 1 行第 13 列落在 /a\/\/b/ 里面
  assert.strictEqual(at(1, 13), false, '正则里的 // 不能判成注释');
  assert.strictEqual(at(2, 7), false, '正则之后的代码仍是代码');
}

// ── 3. 模板字符串里的 // 不是注释 ───────────────────────────────
{
  const at = probe('tpl.ts', ['const s = `http://x // y`;', 'const c = 1;'].join('\n'));
  assert.strictEqual(at(1, 20), false, '模板字符串里的 // 不能判成注释');
  assert.strictEqual(at(2, 7), false, '模板串之后的代码仍是代码');
}

// ── 4. JSX 文本里的 // 不是注释 ────────────────────────────────
{
  const at = probe(
    'jsx.tsx',
    ['const el = (', '  <div>', '    a // b', '  </div>', ');'].join('\n'),
  );
  assert.strictEqual(at(3, 8), false, 'JSX 文本里的 // 不能判成注释');
}

// ── 5. JSX 属性位的 // 行注释【是】注释 ─────────────────────────
//    （JSX 属性位只能放 `//`，放 {/* */} 会报 TS1005 —— 仓里踩过）
{
  const at = probe(
    'jsx-attr.tsx',
    ['const el = (', '  <div', '    // 这是属性位注释', '    id="x"', '  />', ');'].join('\n'),
  );
  assert.strictEqual(at(3, 8), true, 'JSX 属性位的行注释应判为注释');
  assert.strictEqual(at(4, 6), false, 'id="x" 是真代码');
}

// ── 6. 解析不了的文件要「宁可少剔噪」，不能整片当注释 ───────────
{
  const at = probe('broken.ts', ['const a = (((;;;', 'const b = 2;'].join('\n'));
  assert.notStrictEqual(at(2, 7), true, '解析失败时不能把真代码判成注释');
}

// ── 7. 位置越界 / 文件不存在返回 null ──────────────────────────
{
  const idx = new CommentIndex(dir);
  assert.strictEqual(idx.isInComment('不存在.ts', 1, 1), null, '文件不存在应返回 null');
  assert.strictEqual(idx.isInComment('basic.ts', 999, 1), null, '行号越界应返回 null');
}

fs.rmSync(dir, { recursive: true, force: true });
console.log('comment-ranges: 7 组断言全部通过');
