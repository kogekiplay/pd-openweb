/**
 * 给 redux thunk 的 (dispatch, getState) 参数标上真实类型（一次性工具）
 *
 * 这两个参数有【确定的】类型，不需要任何 any/unknown：
 *   dispatch → AppDispatch  (ThunkDispatch<RootState, undefined, UnknownAction>)
 *   getState → GetState     (() => RootState)
 * 定义见 src/redux/types.ts。
 *
 * 为什么值得单独做一批：全量 strict 下隐式 any（TS7xxx）占 63%，
 * 其中 TS7006「参数隐式 any」4 万条是大头，而 dispatch/getState 合计 1139 条
 * 是里面【类型最确定】的一块 —— 不用推断、不用建模，照抄 store 的类型即可。
 *
 * 只改形如 `(dispatch, getState) =>` 的裸解构，已有类型标注的一律跳过。
 *
 * ⚠⚠ 【不要无脑跑这个工具】本仓【不止一个 store】。
 * 实测 41 个含 thunk 的文件里，只有 8 个用的是全局 store；其余 33 个属于
 * 页面自建的局部 store（如 src/pages/Admin/user/membersDepartments/structure/index.tsx:9
 * 的 configureStore()，以及 Mobile 各页、FormSet columnRules、PublicWorksheetConfig 等）。
 * 给它们套全局 RootState 会当场产生 135 条新诊断 ——
 * getState().entities / .current / .contact 这些 slice 根本不在根 reducer 里
 * （根 reducer 只有 sheet/chat/kc/task/workflow/appPkg/mobile/publicWorksheet/
 *   formSet/customPage/sheetList/statistics/portal/appRole/orgManagePage）。
 *
 * 正确做法是【按 store 分别处理】：局部 store 的 action 文件要用它自己那棵
 * reducer 推出来的 state 类型，写法参照 src/redux/types.ts 的 RootState
 * （ReturnType<ReturnType<typeof makeRootReducer>>）。
 * 跑完务必比对 tsc 基线，把产生新诊断的文件回退掉。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const IMPORT_LINE = "import type { AppDispatch, GetState } from 'src/redux/types';";

// 只匹配两个参数都没有类型标注的形态
const BARE = /\(dispatch, getState\) =>/g;
const BARE_FN = /function \(dispatch, getState\)/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.spec\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0;
let sites = 0;

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  if (rel === 'src/redux/types.ts') continue;

  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  src = src.replace(BARE, '(dispatch: AppDispatch, getState: GetState) =>');
  src = src.replace(BARE_FN, 'function (dispatch: AppDispatch, getState: GetState)');

  if (src === before) continue;

  const n = (before.match(BARE) || []).length + (before.match(BARE_FN) || []).length;

  if (!src.includes("from 'src/redux/types'")) {
    // 插在【第一条】import 之前 —— 多行 import 的首行也匹配 /^\s*import/，
    // 按「最后一条 import + 1」插会把语句从中间劈开。顺序交给 prettier 的 sort-imports。
    const lines = src.split('\n');
    const first = lines.findIndex(l => /^\s*import\b/.test(l));

    if (first === -1) {
      console.log(`  跳过 ${rel}：找不到 import 语句`);
      continue;
    }

    lines.splice(first, 0, IMPORT_LINE);
    src = lines.join('\n');
  }

  fs.writeFileSync(file, src);
  files++;
  sites += n;
  console.log(`  ${rel}  ${n} 处`);
}

console.log(`\n改写 ${files} 个文件 / ${sites} 处 thunk 参数`);
