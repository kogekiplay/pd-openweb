/**
 * rc-trigger 5.3.4 → @rc-component/trigger 3.10.1（一次性工具）
 *
 * 为什么必须换：rc-trigger 5.3.4 在 getRootDomNode 的【最后兜底】里直接调
 *   return ReactDOM.findDOMNode(_assertThisInitialized(_this));
 * 没有任何守卫（es/index.js:254）。React 19 移除了 findDOMNode，这行直接抛
 * "TypeError: ReactDOM.findDOMNode is not a function"，被 ErrorBoundary 接住，
 * 整块 UI 变成「程序错误，请刷新页面重试」。
 * rc-trigger 已停止维护（5.3.4 是终版），继任者就是 antd 6 内部在用的
 * @rc-component/trigger —— 它不 import react-dom，改用 ref 拿节点。
 *
 * 迁移面（AST 精确统计，不是正则 —— <Trigger> 的 props 普遍带箭头函数，
 * `.*?>` 会在 `=>` 处截断，把嵌套 JSX 的属性也算进来，实测把 6 报成 113）：
 *   282 个文件 / 320 个 <Trigger> 元素
 *   destroyPopupOnHide → autoDestroy : 49 处（本工具处理）
 *   className → 挪到子元素           : 6 处（本工具【不处理】，留给人工，
 *                                       其中 5 处子元素已有 className 需要合并）
 * 其余高频 props（popupVisible 228 / action 193 / onPopupVisibleChange 183 /
 * popup 133 / popupAlign 90 / getPopupContainer 65 / popupClassName 40 /
 * zIndex 24 / builtinPlacements / popupStyle）新包全部保留，无需改写。
 *
 * ⚠ 新包不再用 findDOMNode，而是把 ref 挂到子元素上取节点。子元素若是不转发 ref
 * 的函数组件，定位会失效 —— 这是【静默】的，类型和构建都不会报。React 19 允许
 * 函数组件直接接收 ref 作为 prop，绝大多数情况能自动兼容，但迁移后仍需实际点开
 * 弹层看位置。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.(jsx|tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

let importFiles = 0;
let destroySites = 0;

for (const file of walk(SRC)) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes("'rc-trigger'")) continue;

  const before = src;
  src = src.split("from 'rc-trigger'").join("from '@rc-component/trigger'");

  // destroyPopupOnHide → autoDestroy（语义一致：隐藏时销毁弹层内容）
  const dCount = src.split('destroyPopupOnHide').length - 1;
  if (dCount) {
    src = src.split('destroyPopupOnHide').join('autoDestroy');
    destroySites += dCount;
  }

  if (src !== before) {
    fs.writeFileSync(file, src);
    importFiles++;
  }
}

console.log(`改写 import ${importFiles} 个文件；destroyPopupOnHide → autoDestroy ${destroySites} 处`);
console.log('\n⚠ className 那 6 处本工具【不碰】，需人工挪到子元素上：');
console.log('   运行 node tools/analyze-trigger-migration.cjs 查看清单');
