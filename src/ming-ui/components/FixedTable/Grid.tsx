import React, { Fragment, useCallback, useMemo, useRef } from 'react';
import { Grid as WindowGrid } from 'react-window';
import { includes, isFunction } from 'lodash';
import { normalizeGridCellStyle, RESET_V2_CONTAINER_BOX } from '../gridCellStyle';

function sum(array = []) {
  return array.reduce((a, b) => a + b, 0);
}

function cx(obj) {
  return Object.keys(obj)
    .filter(key => obj[key])
    .join(' ');
}

export default function Grid(props) {
  const {
    isGroupTableView,
    id,
    leftFixed,
    topFixed,
    rightFixed,
    bottomFixed,
    width,
    height,
    columnHeadHeight,
    rowCount,
    columnCount,
    topFixedCount,
    bottomFixedCount,
    rightFixedCount,
    rowHeight,
    getColumnWidth,
    getRowHeight,
    Cell,
    tableData,
    setRef,
    renderCustomComp,
    cache,
  } = props;
  let leftFixedCount = props.leftFixedCount;
  let leftFixedWidth = leftFixedCount ? sum([...new Array(leftFixedCount)].map((n, i) => getColumnWidth(i))) : 0;

  if (leftFixedWidth > width && leftFixedCount > 2) {
    leftFixedCount = isGroupTableView ? 2 : 1;
    leftFixedWidth = leftFixedCount ? sum([...new Array(leftFixedCount)].map((n, i) => getColumnWidth(i))) : 0;
  }

  const rightFixedWidth = rightFixedCount
    ? sum([...new Array(rightFixedCount)].map((n, i) => getColumnWidth(columnCount - rightFixedCount + i)))
    : 0;
  let topFixedHeight = topFixedCount ? topFixedCount * columnHeadHeight : 0;
  let bottomFixedHeight = bottomFixedCount ? bottomFixedCount * 28 : 0;
  let gridHeight = topFixed
    ? topFixedHeight
    : bottomFixed
      ? bottomFixedHeight
      : height - topFixedHeight - bottomFixedHeight;

  if (includes(id, 'main') && gridHeight < 60) {
    gridHeight = 60;
  }

  const config = {
    left: leftFixed ? 0 : rightFixed ? width - rightFixedWidth : leftFixedWidth,
    top: topFixed ? 0 : bottomFixed ? height - bottomFixedHeight : topFixedHeight,
    width: leftFixed ? leftFixedWidth : rightFixed ? rightFixedWidth : width - leftFixedWidth - rightFixedWidth,
    height: gridHeight,
    columnCount: leftFixed
      ? leftFixedCount
      : rightFixed
        ? rightFixedCount
        : columnCount - leftFixedCount - rightFixedCount,
    rowCount: topFixed || bottomFixed ? 1 : rowCount,
  };

  // key 含宽度：行数/滚动条状态变化（如子表筛选）导致宽度变时 grid 会整体重挂。
  // center 列是横向滚动区，重挂若回到 0 而表头/内容不同步重挂就会横向错位；
  // 用缓存的横向位置初始化，使重挂后直接落在原位置，不依赖异步的 setScrollX 纠正。
  const initialScrollLeft = id.endsWith('center') ? (cache && cache.left) || 0 : 0;

  // react-window 2 没有 initialScrollLeft，也没有 v1 那种「ref 拿到的就是组件实例」的时机。
  // 实测它填充 gridRef 的时机晚于父组件的 useLayoutEffect / useEffect，甚至晚于它自己的
  // onResize / onCellsRendered（那时 api.element 还是 null），所以只能在 gridRef 回调里
  // 拿到 api 的那一刻立即设初始横向位置。
  // 回调必须标识稳定（useCallback 空依赖），否则每次渲染都会被 React 当成新 ref 反复调用。
  const appliedInitialScroll = useRef(false);
  // 这两个值每次渲染都可能变，但回调标识必须稳定，所以用 ref 读最新值。
  // setRef 由 FixedTable/index.tsx 每次渲染重新创建（它只是往 cache 里塞引用），
  // 直接闭包捕获会调到过期的那个。
  const initialScrollLeftRef = useRef(initialScrollLeft);
  initialScrollLeftRef.current = initialScrollLeft;
  const setRefRef = useRef(setRef);
  setRefRef.current = setRef;

  const handleGridRef = useCallback(api => {
    if (isFunction(setRefRef.current)) {
      setRefRef.current(api);
    }

    if (!api || appliedInitialScroll.current) return;

    const el = api.element;

    if (!el) return;

    appliedInitialScroll.current = true;

    if (initialScrollLeftRef.current) {
      el.scrollLeft = initialScrollLeftRef.current;
    }
  }, []);

  // v2 会把格子的 ariaAttributes 一起传给 cellComponent，而这里的 Cell 是外部传进来的
  // 业务组件（WorksheetTable 的 Cell、ImportFileToChildTable 的内联 Cell），都不认识它。
  // 顺手在同一层把坐标还原成 v1 的 left / top（见 gridCellStyle.ts）。
  // 必须 useMemo：包装组件的标识就是 v2 memo 的依赖，每次渲染换新的会让所有格子重挂。
  const NormalizedCell = useMemo(
    () =>
      function GridCell({ ariaAttributes, style, ...rest }) {
        return <Cell {...rest} style={normalizeGridCellStyle(style)} />;
      },
    [Cell],
  );

  if (!config.width || !config.height) {
    return;
  }

  return (
    <Fragment>
      <WindowGrid
        gridRef={handleGridRef}
        className={id + ' ' + cx({ leftFixed, rightFixed, topFixed, bottomFixed }) + '' + id}
        key={`${id}-${config.width}`}
        // v2 没有 width / height prop——它自测量容器，尺寸只能通过 style 给。
        // overflow: hidden 是刻意的：这套表格用的是自绘的覆盖式滚动条（见同目录 ScrollBar.tsx），
        // 滚动完全由 FixedTable/index.tsx 命令式驱动，不依赖原生滚动条。
        style={{
          ...RESET_V2_CONTAINER_BOX,
          position: 'absolute',
          left: config.left,
          top: config.top,
          width: config.width,
          height: config.height,
          overflow: 'hidden',
          backgroundColor: 'var(--color-background-primary)',
        }}
        columnCount={config.columnCount}
        // v2 的尺寸函数签名是 (index, cellProps)，多出来的参数忽略即可。
        columnWidth={i => {
          let index = i;

          if (id.endsWith('center')) {
            index = i + leftFixedCount;
          } else if (id.endsWith('right')) {
            index = i + columnCount - rightFixedCount;
          }

          return getColumnWidth(index);
        }}
        rowHeight={getRowHeight || (() => rowHeight)}
        rowCount={config.rowCount}
        // as any：v2 会从 cellComponent 的参数类型反推 cellProps 该长什么样，而这里的参数没有标注，
        // 它就把 ariaAttributes / style 也算进 cellProps 的必填项。给参数加类型能修，但那要引入具名类型，
        // 而本仓 eslint 用 @babel/eslint-parser、不做 TS 作用域分析，纯类型位置的标识符会被 no-undef 误报。
        // 本仓整体是 Component<any, any> 的无类型风格，这里跟随，把类型让给 tsc 那条独立管线。
        cellComponent={NormalizedCell as any}
        // v2 把 cellProps【展开】传给 cell（cell 收到的是
        // { ariaAttributes, columnIndex, rowIndex, style, ...cellProps }），
        // 所以这里把整包数据放在 `data` 键下——Cell 组件里 `const { data } = props` 的写法
        // 与 v1 的 itemData 完全一致，一行都不用改。
        cellProps={{
          data: {
            ...tableData,
            grid: {
              id,
              tableColumnCount: columnCount,
              leftFixed,
              rightFixed,
              topFixed,
              bottomFixed,
              rightFixedCount,
              leftFixedCount,
              ...config,
            },
          },
        }}
      />
      {isFunction(renderCustomComp) && (
        <div style={{ left: 0, top: 0, display: 'inline-block' }}>{renderCustomComp()}</div>
      )}
    </Fragment>
  );
}
