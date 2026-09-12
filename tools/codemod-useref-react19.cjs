/**
 * useRef() → useRef(undefined)（React 19 的 @types/react 迁移，一次性工具）
 *
 * 为什么必须改：@types/react 19 删掉了 useRef 的【无参重载】。v18 有
 *   function useRef<T = undefined>(): MutableRefObject<T | undefined>
 * v19 只剩三个都要求实参的重载（index.d.ts:1744/1756/1768），于是全仓 189 处
 * `useRef()` 一律报 TS2554「Expected 1 arguments, but got 0」。
 *
 * 为什么补 undefined 而不是 <any> 或 null：
 *   - 运行时完全等价 —— useRef() 本来就是把 current 初始化成 undefined。
 *   - 类型上也等价：v19 的第一个重载 useRef<T>(initialValue: T): RefObject<T>
 *     会把 T 推成 undefined，得到 RefObject<undefined>，
 *     与 v18 的 MutableRefObject<undefined> 口径一致。下游那些
 *     `ref.current.foo`(TS2339) / `ref.current = x`(TS2322) 仍落在【原有基线
 *     key】上，不会凭空多出新诊断。
 *   - 反过来，写 useRef<any>(undefined) 会把 current 变成 any，把这 189 个 ref
 *     的下游检查【整体关掉】。那是在依赖升级里顺手削弱类型，不该做 ——
 *     真要逐个给出正确类型是独立一件事。
 *
 * 只改裸 `useRef()`：实测全仓 189 处【全部】是这个形态，没有 React.useRef()、
 * 也没有 useRef<T>() 带类型参数的写法（那种 v19 下本来就合法，不能动）。
 * 另外只处理确实从 react 导入了 useRef 的文件，避免误伤同名函数。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // src/library 是自带 React 的压缩 vendor bundle，不属于本仓源码
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.(jsx|tsx|ts|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const CALL = /\buseRef\(\)/g;

let changedFiles = 0;
let changedSites = 0;
const skipped = [];

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  if (!CALL.test(src)) continue;
  CALL.lastIndex = 0;

  // 必须确认 useRef 来自 react，否则可能是同名的自定义 hook
  const importsFromReact = /import\s+(?:React\s*,\s*)?\{[^}]*\buseRef\b[^}]*\}\s+from\s+['"]react['"]/.test(src);
  if (!importsFromReact) {
    skipped.push(path.relative(ROOT, file));
    continue;
  }

  const next = src.replace(CALL, () => {
    changedSites++;
    return 'useRef(undefined)';
  });
  fs.writeFileSync(file, next);
  changedFiles++;
}

console.log(`改写 ${changedSites} 处，涉及 ${changedFiles} 个文件`);
if (skipped.length) {
  console.log(`\n跳过 ${skipped.length} 个文件（有 useRef() 但没从 react 导入 useRef，需人工确认）:`);
  skipped.forEach(f => console.log('  ' + f));
}
