import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { GridImperativeAPI } from 'react-window';
import Hammer from 'hammerjs';
import _, { includes } from 'lodash';
import { OverlayScrollbars } from 'overlayscrollbars';
import { bool, func, number } from 'prop-types';
import { getScrollBarWidth } from 'src/utils/common';
import styled from 'src/utils/typedStyled';
import Skeleton from '../Skeleton';
import Grid from './Grid';
import ScrollBar from './ScrollBar';
import type { EmptyFixedTableProps, FixedTableCache, FixedTableProps, GridId, GridProps, HammerCache } from './types';
import { useRefCache } from './useRefCache';

function wheelTarget(event: WheelEvent): Element {
  if (!(event.target instanceof Element)) throw new TypeError('Missing table wheel target');
  return event.target;
}
const EMPTY_TABLE_DATA = {};
function hasTableData<Data extends object>(
  props: FixedTableProps<Data> | EmptyFixedTableProps,
): props is FixedTableProps<Data> {
  return props.tableData !== undefined;
}

const Con = styled.div`
  position: relative;
  border-top: 1px solid var(--color-background-disabled);
  > div {
    box-sizing: border-box;
  }
  overscroll-behavior-x: none;
  &:hover {
    .scroll-x,
    .scroll-y {
      .os-scrollbar {
        visibility: visible !important;
        opacity: 1 !important;
      }
    }
  }
`;

const TableBorder = styled.div`
  border-left: 1px solid var(--color-background-secondary);
  width: 0px;
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
`;

function sum(array: number[] = []): number {
  return array.reduce((a, b) => a + b, 0);
}

/**
 * 取出可滚动的 DOM 节点。
 *
 * cache 里混着两类东西：
 *   - 网格（'top-center' / 'main-center' / ...）：react-window 2 交出来的 imperative API，
 *     滚动位置只能通过它的 element getter 拿到外层节点后直接写 scrollLeft / scrollTop
 *     （v2 删掉了 v1 的命令式 scrollTo）。
 *   - 'scrollX' / 'scrollY'：ScrollBar 经 setViewPortRef 交出来的 OverlayScrollbars
 *     viewport【DOM 元素】。
 *
 * v1 时代这两类恰好都有 `.scrollTo`，所以下面两个函数是多态调用的。但 DOM 元素的
 * `scrollTo()` 吃的是 `{ left, top }` 而不是 `{ scrollLeft, scrollTop }`，也就是说
 * 对 'scrollX' / 'scrollY' 这两个条目**原来一直是空操作**。
 *
 * 这里刻意保持这个行为不变（只认网格、跳过 DOM 元素条目），原因有两条：
 *   1. 滚动条才是唯一真源——setScroll() 直接改滚动条 DOM，滚动条的 customScroll 再回来
 *      驱动网格。若在这里反向去设滚动条自身的位置，会形成 customScroll 的反馈循环。
 *   2. 依赖迁移不该顺手改动滚动行为。那个既存的空操作（例如 :463 的 defaultScrollLeft
 *      只移动网格、不移动滚动条滑块）记录在此，留待单独处理。
 */
function gridScrollElement(target: GridImperativeAPI | null | undefined): HTMLDivElement | null {
  // 只处理 react-window 2 的 imperative API；DOM 元素条目按上面说明跳过。
  return target && target.element ? target.element : null;
}

function setScrollX(cache: FixedTableCache, newLeft: number | undefined): void {
  const names: GridId[] = ['top-center', 'main-center', 'bottom-center'];
  names.forEach(name => {
    const el = gridScrollElement(cache[name]);

    if (el) {
      el.scrollLeft = Number(newLeft);
    }
  });
}

function setScrollY(cache: FixedTableCache, newTop: number): void {
  if (newTop < 0) {
    newTop = 0;
  }

  const names: GridId[] = ['main-left', 'main-center', 'main-right'];
  names.forEach(name => {
    const el = gridScrollElement(cache[name]);

    if (el) {
      el.scrollTop = newTop;
    }
  });
}

function FixedTable(props: EmptyFixedTableProps): ReactElement;
function FixedTable<Data extends object>(props: FixedTableProps<Data>): ReactElement;
function FixedTable<Data extends object>(props: FixedTableProps<Data> | EmptyFixedTableProps): ReactElement {
  const ref = props.ref;
  const {
    noRenderEmpty,
    isGroupTableView,
    isSubList,
    loading,
    showLoadingMask,
    loadingMaskChildren = null,
    className,
    showHead,
    showFoot,
    width,
    columnHeadHeight = 34,
    rowCount,
    disableYScroll,
    columnCount,
    barWidth = getScrollBarWidth(),
    sheetColumnWidths = {},
    rowHeight = 34,
    getColumnWidth,
    getRowHeight = () => props.rowHeight || 34,
    leftFixedCount = 0,
    rightFixedCount = 0,
    hasSubListFooter,
    defaultScrollLeft, // 默认横向滚动距离
    renderEmpty, // 渲染空状态
    disablePanVertical,
    tableFooter,
    onScroll = () => {},
    renderCompInMainCenter,
  } = props;
  let height = props.height;
  let withFooterHeight = props.height;
  const hasFooter = tableFooter && tableFooter.height;

  if (hasFooter) {
    withFooterHeight += tableFooter.height;
  }

  const bottomFixedCount = showFoot ? 1 : 0;
  const topFixedCount = showHead ? 1 : 0;
  const conRef = useRef<HTMLDivElement>(null);
  const tableContainer = (): HTMLDivElement => {
    if (!conRef.current) throw new TypeError('Missing table container');
    return conRef.current;
  };
  const tablehammer = useRef<HammerManager | undefined>(undefined);
  const [hammerCache, setHammer] = useRefCache<HammerCache>({});
  const [cache, set] = useRefCache<FixedTableCache>({
    left: 0,
    top: 0,
    needUpdated: {},
  });
  // 递增它只为触发一次重渲，从而让所有可见网格重新测量——见下面 forceUpdate 的说明。
  const [, bumpSizeVersion] = useState(0);
  window['cache'] = cache;
  const tableSize = useMemo(
    () => ({
      width: sum([...new Array(columnCount)].map((_a, i) => getColumnWidth(i) || 200)),
      height: sum([...new Array(rowCount)].map((_a, i) => getRowHeight(i) || 34)) - (hasSubListFooter ? 8 : 0),
    }),
    [getRowHeight, columnCount, rowCount, sheetColumnWidths, width],
  );
  const XIsScroll = useMemo(
    () => tableSize.width > width,
    [width, tableSize.width, leftFixedCount, rightFixedCount, columnCount],
  );
  const YIsScroll = useMemo(
    () =>
      !disableYScroll && tableSize.height > height - (showHead ? columnHeadHeight : 0) - (bottomFixedCount ? 28 : 0),
    [height, tableSize.height, topFixedCount, columnHeadHeight, bottomFixedCount, rowCount],
  );
  const tableConfigs: Array<{
    id: GridId;
    visible: boolean;
    topFixed?: boolean;
    bottomFixed?: boolean;
    leftFixed?: boolean;
    rightFixed?: boolean;
    renderCustomComp?: (() => ReactNode) | undefined;
  }> = [
    {
      id: 'top-left',
      topFixed: true,
      leftFixed: true,
      visible: leftFixedCount > 0 && topFixedCount > 0,
    },
    {
      id: 'top-center',
      topFixed: true,
      visible: topFixedCount > 0,
    },
    {
      id: 'top-right',
      topFixed: true,
      rightFixed: true,
      visible: rightFixedCount > 0 && topFixedCount > 0,
    },
    {
      id: 'main-left',
      leftFixed: true,
      visible: leftFixedCount > 0 && rowCount > 0,
    },
    { id: 'main-center', visible: rowCount > 0, renderCustomComp: renderCompInMainCenter },
    { id: 'main-right', rightFixed: true, visible: rightFixedCount > 0 && rowCount > 0 },
    {
      id: 'bottom-left',
      bottomFixed: true,
      leftFixed: true,
      visible: leftFixedCount > 0 && bottomFixedCount > 0 && rowCount > 0,
    },
    {
      id: 'bottom-center',
      bottomFixed: true,
      visible: bottomFixedCount > 0 && rowCount > 0,
    },
    {
      id: 'bottom-right',
      bottomFixed: true,
      rightFixed: true,
      visible: rightFixedCount > 0 && bottomFixedCount > 0 && rowCount > 0,
    },
  ];
  // react-window 2 删掉了 resetAfterRowIndex / resetAfterColumnIndex。
  // 实测 v2 的尺寸缓存有两个失效条件：尺寸函数的标识，以及 cellProps 的标识。
  // Grid.tsx 每次渲染都会重建 cellProps 对象，所以让本组件重渲一次就会让所有可见网格
  // 整体重新测量——效果等价于原来对每个网格逐个调 reset，而且不再需要持有网格实例。
  const forceUpdate = useCallback(() => {
    bumpSizeVersion(n => n + 1);
  }, []);
  const tables = tableConfigs
    .filter(item => item.visible && (!loading || includes(item.id, 'top')))
    .map(t => {
      // key 用 tableConfigs 里那个稳定的 id（top-left / bottom-right …）
      const grid: Omit<GridProps<Data>, 'Cell' | 'tableData'> = Object.assign(t, {
        isGroupTableView,
        width: YIsScroll ? width - barWidth : width,
        height: XIsScroll ? height + barWidth * -1 : height,
        columnHeadHeight,
        rowCount,
        columnCount,
        topFixedCount,
        bottomFixedCount,
        leftFixedCount,
        rightFixedCount,
        rowHeight,
        cache, // 用来更新指定位置
        getColumnWidth,
        getRowHeight,
        setRef: (ref: GridImperativeAPI | null) => {
          if (ref) cache[t.id] = ref;
        },
      });
      if (hasTableData(props)) return <Grid<Data> key={t.id} {...grid} Cell={props.Cell} tableData={props.tableData} />;
      return <Grid<object> key={t.id} {...grid} Cell={props.Cell} tableData={EMPTY_TABLE_DATA} />;
    });
  const verticalScroll = useMemo(
    () => (
      <ScrollBar
        {...{
          type: 'y',
          barWidth,
          style: {
            right: 0,
            top: topFixedCount * columnHeadHeight,
            bottom: bottomFixedCount * 28 + (hasFooter ? tableFooter.height : 0),
            height: 'auto',
          },
          contentStyle: {
            height: tableSize.height + (XIsScroll ? 10 : 0),
          },
          setRef: ref => {
            cache.scrollY = ref;
          },
          setScrollY: y => {
            set('top', y);
            setScrollY(cache, y);
          },
          onScroll: onScroll,
        }}
      />
    ),
    [tableSize.height, XIsScroll, bottomFixedCount],
  );
  const horizontalScroll = useMemo(
    () => (
      <ScrollBar
        {...{
          type: 'x',
          style: {
            left: 0,
            right: 0,
            bottom: 0,
          },
          contentStyle: {
            width: tableSize.width + (YIsScroll ? 10 : 0),
          },
          barWidth,
          setRef: ref => {
            cache.scrollX = ref;
          },
          setScrollX: x => {
            set('left', x);
            setScrollX(cache, x);
          },
          onScroll: onScroll,
        }}
      />
    ),
    [tableSize.width, YIsScroll, leftFixedCount],
  );
  // 缓存滚动元素引用，避免重复查询
  const scrollElementsRef = useRef<{
    $scrollX: HTMLElement | null | undefined;
    $scrollY: HTMLElement | null | undefined;
  }>({ $scrollX: null, $scrollY: null });

  // 更新滚动元素缓存
  const updateScrollElements = useCallback(() => {
    if (conRef.current) {
      scrollElementsRef.current.$scrollX = cache.scrollX;
      scrollElementsRef.current.$scrollY = cache.scrollY;
    }
  }, []);

  // 强制 OverlayScrollbars 重新测量。
  // 子表在记录详情等弹层中挂载时，os 实例可能在容器尺寸/可见性尚未稳定时初始化，
  // 测出“无溢出”后把滚动条置为隐藏态，导致滚动正常但滚动条不显示。
  // 在布局绘制后及关键尺寸变化时 update(true) 重新测量即可纠正。
  const refreshScrollbars = useCallback(() => {
    if (!conRef.current) {
      return;
    }

    ['x', 'y'].forEach(type => {
      const host = tableContainer().querySelector<HTMLElement>(`.scroll-${type}`);
      const osInstance = host && OverlayScrollbars(host);

      if (osInstance && _.isFunction(osInstance.update)) {
        osInstance.update(true);
      }
    });
  }, []);

  // 原始的滚轮处理逻辑
  const performMouseWheel = useCallback(
    (e: WheelEvent) => {
      if (wheelTarget(e).closest('.scrollInTable')) {
        return;
      }

      let direction = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y';

      if (window.isWindows && e.shiftKey) {
        direction = 'x';
      }

      // 直接实时查询，避免缓存引用指向已脱离 DOM 的 viewport 节点
      const $scrollX = conRef.current && tableContainer().querySelector<HTMLElement>('.scroll-x .scroll-viewport');
      const $scrollY = conRef.current && tableContainer().querySelector<HTMLElement>('.scroll-y .scroll-viewport');

      if (direction === 'x') {
        let newLeft = cache.left + (window.isWindows && e.shiftKey ? e.deltaY : e.deltaX);

        if ($scrollX) {
          $scrollX.scrollLeft = newLeft;
        }

        e.preventDefault();
        e.stopPropagation();
      } else if (direction === 'y') {
        let newTop = cache.top + e.deltaY;

        if ($scrollY) {
          $scrollY.scrollTop = newTop;
        }
      }

      if (!$scrollY) {
        return;
      }

      if (
        isSubList &&
        (!$scrollY ||
          ($scrollY &&
            ((e.deltaY < 0 && $scrollY.scrollTop === 0) ||
              (e.deltaY > 0 && $scrollY.scrollTop + $scrollY.clientHeight === $scrollY.scrollHeight))))
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
    },
    [cache.left, cache.top, isSubList],
  );

  // 节流的滚轮处理函数 - 优化为8ms以获得更流畅的体验
  const throttledMouseWheel = useMemo(
    () => _.throttle(performMouseWheel, 8), // 约120fps，更流畅的滚动体验
    [performMouseWheel],
  );

  function handleMouseWheel(e: WheelEvent): void {
    // 对于立即需要阻止默认行为的情况，先处理
    if (wheelTarget(e).closest('.scrollInTable')) {
      return;
    }

    // 然后通过节流函数处理滚动逻辑
    throttledMouseWheel(e);
  }

  // hammer event
  function handlePanMove(e: HammerInput): void {
    if (window['disableTableScroll']) {
      return;
    }

    const isScrollVer = Math.abs(e.deltaY) > Math.abs(e.deltaX);
    setHammer('leftForHammer', Number(hammerCache.leftForHammer) + Number(hammerCache.lastPandeltaX) - e.deltaX);
    setHammer('topForHammer', Number(hammerCache.topForHammer) + Number(hammerCache.lastPandeltaY) - e.deltaY);
    setHammer('lastPandeltaX', e.deltaX);
    setHammer('lastPandeltaY', e.deltaY);
    const $scrollX = tableContainer().querySelector<HTMLElement>('.scroll-x .scroll-viewport');
    const $scrollY = tableContainer().querySelector<HTMLElement>('.scroll-y .scroll-viewport');

    if (isScrollVer) {
      if ($scrollY) {
        $scrollY.scrollTop = Number(hammerCache.topForHammer);
      }
    } else {
      if ($scrollX) {
        $scrollX.scrollLeft = Number(hammerCache.leftForHammer);
      }
    }
  }

  // hammer event
  function handlePanEnd() {
    setHammer('lastPandeltaX', 0);
    setHammer('lastPandeltaY', 0);
  }

  useImperativeHandle(ref, () => ({
    dom: conRef,
    forceUpdate,
    setScroll: (left, top) => {
      const $scrollX = tableContainer().querySelector<HTMLElement>('.scroll-x .scroll-viewport');
      const $scrollY = tableContainer().querySelector<HTMLElement>('.scroll-y .scroll-viewport');

      if (!_.isUndefined(left) && $scrollX) {
        $scrollX.scrollLeft = left;
      }

      if (!_.isUndefined(top) && $scrollY) {
        $scrollY.scrollTop = top;
      }
    },
    setScrollX: left => {
      set('left', left);
      setScrollX(cache, left);
    },
  }));
  useLayoutEffect(() => {
    if (cache.scrollX?.scrollLeft) {
      setTimeout(() => {
        setScrollX(cache, cache.scrollX?.scrollLeft);
      }, 10);
    }
  }, [loading]);
  useEffect(forceUpdate, [tableSize.width]);

  // 当表格结构变化时更新滚动元素缓存
  useEffect(() => {
    updateScrollElements();
  }, [updateScrollElements, loading, rowCount]);

  useLayoutEffect(() => {
    cache.didMount = true;
    if (document.body) document.body.style.overscrollBehaviorX = 'none';

    // 初始化滚动元素缓存
    updateScrollElements();

    tableContainer().addEventListener('wheel', handleMouseWheel);
    // --- 表格触摸事件处理 ---
    tablehammer.current = new Hammer(tableContainer(), { inputClass: Hammer.TouchInput });
    setHammer(
      'leftForHammer',
      tableContainer().querySelector<HTMLElement>('.scroll-x .scroll-viewport')?.scrollLeft || 0,
    );
    setHammer(
      'topForHammer',
      tableContainer().querySelector<HTMLElement>('.scroll-y .scroll-viewport')?.scrollTop || 0,
    );
    setHammer('lastPandeltaX', 0);
    setHammer('lastPandeltaY', 0);
    tablehammer.current
      .get('pan')
      .set({ direction: disablePanVertical ? Hammer.DIRECTION_HORIZONTAL : Hammer.DIRECTION_ALL });
    tablehammer.current.on('panmove', handlePanMove);
    tablehammer.current.on('panend', handlePanEnd);
    // ---
    setTimeout(() => {
      if (defaultScrollLeft) {
        const viewport = conRef.current && tableContainer().querySelector<HTMLElement>('.scroll-x .scroll-viewport');
        if (viewport) {
          setScrollX(cache, defaultScrollLeft);
          viewport.scrollLeft = defaultScrollLeft;
        }
      }
    }, 0);
    return () => {
      conRef.current && conRef.current.removeEventListener('wheel', handleMouseWheel);
      if (tablehammer.current) {
        tablehammer.current.off('panmove', handlePanMove);
        tablehammer.current.off('panend', handlePanEnd);
        tablehammer.current.destroy();
      }

      // 清理节流函数
      throttledMouseWheel.cancel();
    };
  }, [updateScrollElements, throttledMouseWheel]);
  useEffect(() => {
    if (!XIsScroll && cache.scrollX) {
      set('left', 0);
      setScrollX(cache, 0);
    }
  }, [XIsScroll]);
  // 布局绘制后（下一帧）及尺寸/溢出输入变化时重新测量，纠正初始化时机带来的滚动条不显示
  useEffect(() => {
    const raf = requestAnimationFrame(refreshScrollbars);
    return () => cancelAnimationFrame(raf);
  }, [refreshScrollbars, YIsScroll, XIsScroll, tableSize.height, tableSize.width, height, width, loading, rowCount]);
  return (
    <Con ref={conRef} className={className} style={{ width, height: hasFooter ? withFooterHeight : height }}>
      <TableBorder
        className="tableBorder"
        style={{
          left: 0,
          bottom: XIsScroll ? barWidth : 0,
        }}
      />
      <TableBorder
        className="tableBorder"
        style={{
          right: 0,
          bottom: XIsScroll ? barWidth : 0,
        }}
      />
      {/* 表格 */}
      {tables}
      {tableFooter && tableFooter.comp && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: width,
            height: tableFooter.height - 2,
            bottom: XIsScroll ? barWidth : 0,
          }}
        >
          {tableFooter.comp}
        </div>
      )}
      {/* 滚动条 */}
      {YIsScroll && verticalScroll}
      {XIsScroll && horizontalScroll}
      {/* 空状态 */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: columnHeadHeight,
            width: '100%',
            height: `calc(100% - ${columnHeadHeight}px)`,
            overflow: 'hidden',
            backgroundColor: 'var(--color-background-primary)',
          }}
        >
          <Skeleton
            style={{ flex: 1 }}
            direction="column"
            widths={['30%', '40%', '90%', '60%']}
            active
            itemStyle={{ marginBottom: '10px' }}
          />
        </div>
      )}
      {/* 加载遮罩 */}
      {showLoadingMask && (
        <div
          className="flexCenter justifyContentCenter"
          style={{
            position: 'absolute',
            top: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: 'var(--color-background-secondary)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {loadingMaskChildren}
        </div>
      )}
      {!loading &&
        rowCount === 0 &&
        !noRenderEmpty &&
        (
          renderEmpty ||
          (() => {
            throw new TypeError('Missing table empty renderer');
          })
        )({
          style: {
            top: columnHeadHeight,
            ...(XIsScroll ? { height: 'auto', bottom: barWidth } : {}),
          },
        })}
      {}
    </Con>
  );
}

FixedTable.propTypes = {
  width: number.isRequired,
  height: number.isRequired,
  columnCount: number.isRequired,
  rowCount: number.isRequired,
  rowHeight: number.isRequired,
  getColumnWidth: func.isRequired,
  disablePanVertical: bool,
};

export type { FixedTableHandle, FixedTableProps, EmptyFixedTableProps, FixedTableCellProps } from './types';
export default FixedTable;
