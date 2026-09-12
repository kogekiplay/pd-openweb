/**
 * componentDidUpdate 里的 props 变更守卫：引用比较 → 浅比较（一次性工具）
 *
 *   if (prevProps !== this.props) {   →   if (!shallowEqual(prevProps, this.props)) {
 *
 * 为什么必须改 —— 这不是风格问题，是 React 19 下【守卫恒为真】：
 * React 19 在组件【自身 setState】触发的重渲染里会给类组件一个新的 props 对象，
 * 即使父组件根本没有重渲染。React 18 则复用同一个对象。
 *
 * 实测数据（工作表视图 /app/…，ViewItems 这条链）：
 *   ViewControl（祖父）渲染        4 次
 *   withRouter(ViewItems)（父）    3 次
 *   ViewItems.componentDidUpdate  52 次 —— 每次 prevProps !== this.props 都为真
 * 于是守卫内的 computeDirectionVisible()（含 setState）每次都执行，形成自激循环，
 * React 抛 Maximum update depth exceeded，整个工作表视图被 ErrorBoundary 接管
 * （页面显示「程序错误，请刷新页面重试」）。
 *
 * 影响面不止"会崩的那几个"：守卫恒为真意味着所有 331 处的语义都变了 ——
 * 本该只在 props 变化时执行的逻辑，现在连纯 state 更新也会执行。
 * 所以全量替换，而不是只修崩溃点。
 *
 * 为什么是 shallowEqual：这个守卫的【意图】一直是"props 变了"，引用比较只是
 * React 18 下碰巧等价的实现。浅比较把意图写实，且在 18 / 19 下行为一致 ——
 * 父组件重渲染带来新的内联回调时，逐键引用比较同样判定为"变了"，与旧行为吻合。
 *
 * 取 react-redux 的 shallowEqual：已是核心依赖、实现稳定，且仓里
 * src/pages/chat/lib/addressBook/index.tsx 已经这么用。
 * 文件里若已有 shallowEqual 绑定（kc/utils 或 shallowequal 包）则不重复引入。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const GUARD = 'prevProps !== this.props';
const IMPORT_LINE = "import { shallowEqual } from 'react-redux';";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.(jsx|tsx)$/.test(e.name) && !/\.spec\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0;
let sites = 0;
let importsAdded = 0;
const problems = [];

for (const file of walk(SRC)) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes(GUARD)) continue;

  const count = src.split(GUARD).length - 1;
  src = src.split(GUARD).join('!shallowEqual(prevProps, this.props)');
  sites += count;

  // 已有 shallowEqual 绑定就不再引入（可能来自 kc/utils 或 shallowequal 包）
  const hasBinding = /\bshallowEqual\b/.test(
    src
      .split('\n')
      .filter(l => /^\s*import\b/.test(l))
      .join('\n'),
  );

  if (!hasBinding) {
    const lines = src.split('\n');
    // 插在【第一条】import 之前 —— 不能按"最后一条 import 的行号 + 1"插：
    // 多行 import（import {\n a,\n b,\n} from 'x';）的首行也匹配 /^\s*import/，
    // 那样会把语句从中间劈开，实测产出 110 条 TS1003/TS1005。
    // 插在最前面不可能劈开任何语句，顺序交给 prettier 的 sort-imports 插件收拾。
    const firstImport = lines.findIndex(l => /^\s*import\b/.test(l));
    if (firstImport === -1) {
      problems.push(`${path.relative(ROOT, file)} — 找不到 import 语句，未插入 shallowEqual`);
    } else {
      lines.splice(firstImport, 0, IMPORT_LINE);
      src = lines.join('\n');
      importsAdded++;
    }
  }

  fs.writeFileSync(file, src);
  files++;
}

console.log(`改写 ${sites} 处守卫，涉及 ${files} 个文件；新增 import ${importsAdded} 条`);
if (problems.length) {
  console.log(`\n⚠ 需人工处理 ${problems.length} 条:`);
  problems.forEach(p => console.log('  ' + p));
}
