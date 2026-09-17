/**
 * 虚拟表 cellProps 的两条不变量，外加一条「别再往回改」的记录。
 *
 * 【背景】左侧分组面板一折叠，工作表整张表的单元格全部重渲染一遍
 * （实测 AGV测试问题清单：DOM 里 210 个单元格，一次折叠有 198~220 次单元格渲染；
 * 生产 trace 里主线程被切成 99 / 61 / 59ms 几个大任务）。
 * react-window 2 本身是给单元格做了 memo 的（cellProps 走 useMemo(() => e, Object.values(e))，
 * 单元格外面套 memo + 浅比较），问题全在我们这边把它顶掉。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../../../../scripts/spec-harness.ts');

const gridPath = path.join(ROOT, 'src/ming-ui/components/FixedTable/Grid.tsx');
const grid = fs.readFileSync(gridPath, 'utf8');

/* ---------- 1. key 里不能带宽度 ---------- */

assert.ok(
  !/key=\{`\$\{id\}-\$\{config\.width\}`\}/.test(grid),
  'WindowGrid 的 key 不能带 config.width：宽度一变整个 grid 连同所有单元格重新挂载，' +
    '上层所有 memo（包括 react-window 自带的）全部作废。' +
    'v2 自己测量容器，不需要靠重挂刷新；尺寸缓存另有失效途径（columnWidth 每次都是新箭头函数）。' +
    '顺带：不重挂就不会回到 scrollLeft 0，原先担心的横向错位反而消失了。',
);

/* ---------- 2. cellProps 的 grid 字段：不能多，也不能少 ---------- */

assert.ok(/cellProps=\{cellProps\}/.test(grid), 'cellProps 必须是 useMemo 出来的对象，不要在 JSX 里现写字面量。');

assert.ok(
  !/grid:\s*\{[^}]*\.\.\.config/s.test(grid),
  'grid 里不能摊入整个 config：其中 config.width 随容器宽度变，等于把「改宽 → 全表重渲」这条链焊死。',
);

/* 【裁过头会列错位】Cell 里是 `getIndex({ columnIndex, rowIndex, ...grid })`，
   下面七个字段是它把「分区内局部列号」换算成全局列号用的，少一个就错。
   真出过事：只留 id + leftFixedCount（靠 grep `grid\.\w+` 得出的结论），
   左固定区丢了 leftFixed:true，掉进 `leftFixedCount + columnIndex` 分支，
   左固定列显示成中间区的第一列 —— 肉眼就是「同一列渲染了两次」。
   教训：grep 属性访问查不出「整个对象被 ...spread 下去」这种用法。 */
['tableColumnCount', 'leftFixed', 'rightFixed', 'topFixed', 'bottomFixed', 'rightFixedCount', 'leftFixedCount'].forEach(
  field => {
    assert.ok(
      new RegExp('grid:\\s*\\{[^}]*\\b' + field + '\\b', 's').test(grid),
      `cellProps 的 grid 里必须带 ${field}：Cell 的 getIndex 靠它换算全局列号，缺了会导致列错位。`,
    );
  },
);

/* ---------- 3. render prop 必须走订阅式插槽 ---------- */

const wtPath = path.join(ROOT, 'src/pages/worksheet/components/WorksheetTable/index.tsx');
const wt = fs.readFileSync(wtPath, 'utf8');

/* tableData 整包稳定化本身是对的（单元格渲染 ~210 → 0~22），但 renderFunctions
   （rowHead / head / operates …）是 render prop，输出依赖【没经过 tableData 的外部状态】，
   例如 SheetView 的 layoutChangeVisible。第一版直接把它们当普通回调稳定化，结果是
   那类状态变了也不再触发单元格重渲染 —— 界面停在旧的一帧且不报错：
   「调完列宽点保存，服务端已存好，但保存入口不消失，必须再点一次保存」。
   现在改走 renderSlots.tsx 的订阅式插槽：标识固定但内部订阅最新实现，
   只有真正用到 render prop 的那几十个格子会更新。 */
assert.ok(
  /const tableData = useStablePropsObject\(rawTableData\)/.test(wt),
  'tableData 必须过 useStablePropsObject，否则单元格 memo 全部落空。',
);

assert.ok(
  /const renderFunctions = useRenderSlots\(/.test(wt),
  'renderFunctions 必须走 useRenderSlots：它们是 render prop，' +
    '直接当普通回调稳定化会导致「保存后入口不消失」这类静默陈旧界面。',
);

assert.ok(
  !/const renderFunctions = useStablePropsObject\(/.test(wt),
  'renderFunctions 不能用 useStablePropsObject 稳定化（只适用于调用型回调）。',
);

const slotPath = path.join(ROOT, 'src/pages/worksheet/components/WorksheetTable/renderSlots.tsx');
const slots = fs.readFileSync(slotPath, 'utf8');

assert.ok(
  /useSyncExternalStore/.test(slots),
  '插槽必须用 useSyncExternalStore 订阅版本号：并发渲染下它保证读到的版本与渲染批次一致。',
);

['head', 'foot', 'rowHead', 'operates', 'groupTitle', 'groupMore'].forEach(slot => {
  assert.ok(new RegExp(`'${slot}'`).test(slots), `renderSlots 必须覆盖 ${slot} 这个 render prop，漏一个就是一处静默陈旧界面。`);
});

console.log('FixedTable cellProps tests passed（key 1 项 + grid 字段 9 项 + render prop 10 项）');
