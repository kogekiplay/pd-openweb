import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Grid } from 'react-window';

/**
 * react-window 2.x 的 `VariableSizeGrid` 兼容层。
 *
 * 为什么要这一层而不是改调用方：v2 与 v1 **零导出名重叠**，并且删掉了 v1 的整个命令式 API
 * （`scrollTo` / `resetAfterIndices` / `resetAfterColumnIndex` / `resetAfterRowIndex`）。
 * 而本仓的 6 网格同步冻结表格（`FixedTable/index.tsx`、`MDTable/MDTable.tsx`）正是建立在
 * 这套命令式 API 上的——滚动同步、列宽重测量共 17 处调用。把差异收进这一个文件，
 * 调用方几乎不用动，出问题也只需回滚这一处。
 *
 * v1 → v2 的差异，逐条都在下面用实测结论处理：
 *
 * 1. **没有 width / height prop**：v2 自测量容器，尺寸只能通过 style 给。
 *    实测传 `style={{width,height}}` 后外层 DIV 确实拿到 `width:300px; height:200px`，
 *    与 v2 自己的 `position:relative; overflow:auto; ...` 合并，且调用方的 style 在后、能覆盖。
 *
 * 2. **itemData → cellProps，且是【展开】传给 cell 而不是嵌在 `data` 下**。
 *    实测 cell 收到的 props 是 `{ ariaAttributes, columnIndex, rowIndex, style, ...cellProps }`。
 *    这里用一个私有键把 v1 的 itemData 整体塞进 cellProps，再由适配器还原成 `data`，
 *    这样 v1 写法的 Cell（`props.data.xxx`）一行都不用改。
 *
 * 3. **尺寸函数签名变成 `(index, cellProps)`**：多出来的参数忽略即可，这里包一层只透传 index。
 *
 * 4. **没有 resetAfterIndices**。实测 v2 的尺寸缓存有【两个】失效条件：尺寸函数的标识变化，
 *    以及 **cellProps 的标识变化**。这三个方法实现为「递增 sizeEpoch → 换尺寸函数标识」。
 *
 *    ⚠️ 已知的语义差异：由于两个调用点每次渲染都造新的 itemData 对象，cellProps 的标识
 *    必然每次都变，所以**实际效果是每次渲染都重新测量**，而不是 v1 的「缓存到 reset 为止」。
 *    判断为可以接受且更好：列宽永远新鲜，而 SheetView.tsx:687 的注释恰恰说明既有代码是在
 *    **对抗**这个缓存（靠 forceUpdate 强制重算）。代价只是每次渲染多调 columnWidth(i)
 *    若干次（很便宜），而格子本来就因为 itemData 换新对象而每次都重渲，这点与 v1 相同。
 *
 * 5. **没有 initialScrollLeft / initialScrollTop**。v1 的语义就是挂载时设一次外层元素的
 *    scrollLeft/scrollTop（实测 v1 传 initialScrollLeft=40 后 outer.scrollLeft 就是 40）。
 *    这里必须用**回调 ref**：实测 v2 填充 gridRef 的时机晚于父组件的 useLayoutEffect、
 *    useEffect，甚至晚于 v2 自己的 onResize / onCellsRendered 回调（那时 element 都还是 null）。
 *
 * 6. **scrollTo 用 `gridRef.element` 实现**。v2 的 imperative handle 有 `element` getter
 *    （实测返回外层 DIV），直接写它的 scrollLeft/scrollTop 即可（实测设 120/60 能读回）。
 *
 * 关于 `overflow: hidden`：调用方（FixedTable/Grid.tsx）刻意传 `overflow:'hidden'`，
 * 因为这套表格用的是自绘的覆盖式滚动条（FixedTable/ScrollBar.tsx），滚动完全由
 * `scrollTo` 命令式驱动，不依赖原生滚动条。overflow:hidden 只是裁剪，元素仍然可以被
 * 脚本滚动、且赋值 scrollLeft 仍会触发 scroll 事件（v2 的虚拟化据此更新可视区）。
 * 这一点 jsdom 不做布局所以验不了，需要真实浏览器确认。
 *
 * DOM 层数变化：v1 是 outer > inner > cells，v2 是 outer > cells + 一个撑尺寸的
 * `z-index:-1` 的 DIV。已 grep 确认本仓 LESS/CSS 没有任何选择器依赖 react-window 的
 * 内部结构，所以这个变化不影响样式。
 */

// 放进 cellProps 的私有键，用来把 v1 的 itemData 整体带给 cell 适配器。
const V1_ITEM_DATA = '__v1ItemData';

const VariableSizeGridCompat = forwardRef(function VariableSizeGridCompat(props: any, ref) {
  const {
    width,
    height,
    columnCount,
    rowCount,
    columnWidth,
    rowHeight,
    itemData,
    initialScrollLeft,
    initialScrollTop,
    className,
    style,
    children: Cell,
    overscanColumnCount,
    overscanRowCount,
  } = props;
  // 刻意【不】把剩余 props 转发给 v2 的 Grid：v1 会忽略不认识的 prop，而 v2 会把它们
  // 摊到外层 DOM 元素上。本仓 MDTable.tsx:468 就传了一个 v1 时代被忽略的 `virtualdom`，
  // 转发过去会变成一个无意义的 DOM 属性。所以这里只透传下面显式列出的那些。

  const gridRef = useRef<any>(null);
  // 递增它就换掉下面两个尺寸函数的标识，从而让 v2 重新测量——用来实现 resetAfterIndices。
  const [sizeEpoch, setSizeEpoch] = useState(0);

  // v2 把 cellProps 展开传给 cell；v1 的 Cell 期望 { columnIndex, rowIndex, style, data }。
  //
  // 适配器组件的标识必须【绝对稳定】：MDTable.tsx:476 传进来的 children 是内联箭头
  // （`args => <Cell {...args} />`），每次渲染都是新函数。如果适配器跟着变，React 会
  // 认为组件类型变了、把所有格子 unmount/remount 一遍（v1 本来就有这个问题）。
  // 所以把当前的 Cell 放进 ref，适配器本身用空依赖 useMemo 固定下来——顺手把这个
  // 既存的重挂问题也消掉了。
  const cellRef = useRef(Cell);
  cellRef.current = Cell;

  const CellAdapter = useMemo(() => {
    function CellAdapterInner(cellProps: any) {
      const { columnIndex, rowIndex, style: cellStyle } = cellProps;
      const CurrentCell = cellRef.current;

      return (
        <CurrentCell columnIndex={columnIndex} rowIndex={rowIndex} style={cellStyle} data={cellProps[V1_ITEM_DATA]} />
      );
    }

    return CellAdapterInner;
  }, []);

  // 尺寸函数的【标识】只随 sizeEpoch 变化，函数体内部读 ref 拿调用方最新的回调。
  // 不把 columnWidth / rowHeight 放进依赖，是因为两个调用点传的都是内联箭头（每次渲染
  // 都是新标识），放进去就等于把「函数标识」这个失效通道也永久打开、纯属浪费。
  // （注意：实际重测量仍会每次发生，因为 cellProps 标识也是每次都变——见文件头第 4 条。
  //  这里保持函数标识稳定，是为了让 resetAfterIndices 这个显式通道语义清晰。）
  const columnWidthRef = useRef(columnWidth);
  columnWidthRef.current = columnWidth;
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;

  const getColumnWidth = useMemo(
    () => (index: number) => {
      const cw = columnWidthRef.current;

      return typeof cw === 'function' ? cw(index) : cw;
    },
    [sizeEpoch],
  );
  const getRowHeight = useMemo(
    () => (index: number) => {
      const rh = rowHeightRef.current;

      return typeof rh === 'function' ? rh(index) : rh;
    },
    [sizeEpoch],
  );

  const resetSizes = useCallback(() => setSizeEpoch(n => n + 1), []);

  useImperativeHandle(
    ref,
    () => ({
      get element() {
        return gridRef.current ? gridRef.current.element : null;
      },
      scrollTo({ scrollLeft, scrollTop }: { scrollLeft?: number; scrollTop?: number } = {}) {
        const el = gridRef.current && gridRef.current.element;

        if (!el) return;

        if (typeof scrollLeft === 'number') el.scrollLeft = scrollLeft;

        if (typeof scrollTop === 'number') el.scrollTop = scrollTop;
      },
      scrollToItem({ columnIndex, rowIndex, align }: any = {}) {
        const api = gridRef.current;

        if (!api) return;

        api.scrollToCell({ columnIndex, rowIndex, columnAlign: align, rowAlign: align });
      },
      // v1 的三个失效方法在 v2 里都归结为「换尺寸函数标识让它重测量」。
      // 它们的参数（起始 index）在 v2 下没有意义——v2 不维护按索引的偏移缓存，所以一律整体重测。
      resetAfterIndices: resetSizes,
      resetAfterColumnIndex: resetSizes,
      resetAfterRowIndex: resetSizes,
    }),
    [resetSizes],
  );

  // v1 的 initialScrollLeft/Top 语义是挂载时设一次，之后不再干预。
  //
  // 这里必须用【回调 ref】而不是在 effect 里读 gridRef.current。实测 v2 填充 gridRef 的
  // 时机非常晚：父组件的 useLayoutEffect、useEffect、甚至 v2 自己的 onResize /
  // onCellsRendered 回调里，`gridRef.current.element` 都还是 null。
  // v2 的 gridRef 类型是 `Ref<...>`（接受回调），所以改成回调后就能在它把 API 交出来的
  // 那一刻立即应用初始滚动位置。
  //
  // 这一点对本仓是有实际意义的：FixedTable/Grid.tsx 给 center 网格传 initialScrollLeft，
  // 用途是让宽度变化导致的整体重挂后直接落回原横向位置，避免表头与内容错位。
  const initialScrollRef = useRef({ left: initialScrollLeft, top: initialScrollTop, applied: false });
  const handleGridRef = useCallback((api: any) => {
    gridRef.current = api;

    if (!api || initialScrollRef.current.applied) return;

    const el = api.element;

    if (!el) return;

    initialScrollRef.current.applied = true;
    const { left, top } = initialScrollRef.current;

    if (left) el.scrollLeft = left;

    if (top) el.scrollTop = top;
  }, []);

  return (
    <Grid
      gridRef={handleGridRef}
      className={className}
      // width/height 放在前面，调用方 style 里的同名属性可以覆盖它们
      style={{ width, height, ...style }}
      columnCount={columnCount}
      rowCount={rowCount}
      columnWidth={getColumnWidth}
      rowHeight={getRowHeight}
      cellComponent={CellAdapter}
      cellProps={{ [V1_ITEM_DATA]: itemData }}
      // v1 的 overscanColumnCount / overscanRowCount 在 v2 合并成了单个 overscanCount。
      // 本仓目前两个调用点都没传，这里只是把语义接上，取两者较大值。
      {...(overscanColumnCount || overscanRowCount
        ? { overscanCount: Math.max(overscanColumnCount || 0, overscanRowCount || 0) }
        : {})}
    />
  );
});

export default VariableSizeGridCompat;
