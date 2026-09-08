import React from 'react';
import cx from 'classnames';
import Hammer from 'hammerjs';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';
import DragMask from 'worksheet/common/DragMask';
import { Grid as WindowGrid } from 'react-window';
import type { CellComponentProps } from 'react-window';
import { emitter } from 'src/utils/common';
import { normalizeGridCellStyle, RESET_V2_CONTAINER_BOX } from '../gridCellStyle';
import Skeleton from '../Skeleton';
import './style.less';

delete Hammer.defaults.cssProps.userSelect;

const FIXED_ROW_HEIGHT = 34;
const FOOTER_ROW_HEIGHT = 28;

// react-window 2 用组件而不是 render 函数渲染格子，且把 cellProps 展开后连同 ariaAttributes
// 一起传进来。这里做四件事：剥掉 ariaAttributes（v1 没有，否则会原样透传给 renderCell）、
// 把网格内的局部行列号加上偏移还原成整表坐标、把格子坐标还原成 v1 的 left / top、
// 再按 renderFooter 分派到 renderCell / renderFooterCell。
// 定义在模块级是为了标识稳定——它是 v2 内部 memo 的依赖，每次渲染换新的会让所有格子重挂。
//
// v1 时代这里曾套过一层只比较行列号的 memo。那时 children 是每次渲染新建的内联函数、
// 被 react-window 当作组件类型，类型变了格子就整体重挂，所以那个比较器从未真正执行过；
// 换成稳定组件后它会生效，却不比较 style，列宽一改格子就停在旧样式上——故不再保留。
// 这就是 cellProps 的形状；v2 从它反推 cellProps 该长什么样，不标就会推成必填 ariaAttributes / style。
type MDTableCellProps = {
  renderVersion: number;
  needUpdateRows: number[];
  renderCell: (args: any) => any;
  renderFooterCell: (args: any) => any;
  renderFooter?: boolean;
  columnOffset: number;
  rowOffset: number;
  grid: any;
  scrollTo: (args: { left?: number; top?: number }) => void;
  tableScrollTop: number;
  gridHeight: number;
  allowlink: any;
};

function MDTableGridCell({
  ariaAttributes,
  renderVersion,
  style,
  columnIndex,
  rowIndex,
  columnOffset,
  rowOffset,
  renderFooter,
  renderCell,
  renderFooterCell,
  ...rest
}: CellComponentProps<MDTableCellProps>) {
  return (renderFooter ? renderFooterCell : renderCell)({
    ...rest,
    style: normalizeGridCellStyle(style),
    columnIndex: columnIndex + columnOffset,
    rowIndex: rowIndex + rowOffset,
  });
}

// v2 的 gridRef 给的是 imperative API 对象，命令式滚动改为直接写它暴露的外层 DOM 节点。
// 首渲染时 ref 还没填充、卸载后又会变回 null，两种情况都按无操作处理。
function setGridScrollLeft(ref, left) {
  const el = ref.current && ref.current.element;

  if (el) {
    el.scrollLeft = left;
  }
}

function setGridScrollTop(ref, top) {
  const el = ref.current && ref.current.element;

  if (el) {
    el.scrollTop = top;
  }
}

export default class MDTable extends React.Component<any, any> {
  static propTypes = {
    loading: PropTypes.bool,
    topFixed: PropTypes.bool,
    disableFrozen: PropTypes.bool,
    forceScrollOffset: PropTypes.shape({}),
    scrollBarHoverShow: PropTypes.bool,
    width: PropTypes.number,
    height: PropTypes.number,
    responseHeight: PropTypes.bool, // 垂直方向不需要滚动
    columnScrollStartIndex: PropTypes.number, // 表格起始位置 column index
    defaultScrollLeft: PropTypes.number,
    fixedRowCount: PropTypes.number,
    sheetColumnWidths: PropTypes.shape({}),
    className: PropTypes.string,
    rowHeight: PropTypes.number,
    fixedColumnCount: PropTypes.number,
    columnCount: PropTypes.number,
    rowCount: PropTypes.number,
    scrollbarWidth: PropTypes.number,
    getCellWidth: PropTypes.func,
    showFooterRow: PropTypes.bool,
    renderCell: PropTypes.func,
    renderFooterCell: PropTypes.func,
    renderEmpty: PropTypes.func,
  };

  static defaultProps = {
    topFixed: true,
    fixedRowCount: 1,
    fixedColumnCount: 0,
    columnScrollStartIndex: 0,
    rowHeight: 36,
    scrollbarWidth: 0,
    renderEmpty: () => {},
    renderCell: () => {},
    renderFooterCell: () => {},
  };
  topleftgrid = React.createRef();
  toprightgrid = React.createRef();
  mainleftgrid = React.createRef();
  mainrightgrid = React.createRef();
  bottomleftgrid = React.createRef();
  bottomrightgrid = React.createRef();
  constructor(props) {
    super(props);
    this.state = {
      scrollLeft: 100,
      scrollTop: 100,
      columnWidthChangeMaskVisible: false,
    };
    this.mdtabldId = props.id || uuidv4();
    this.scrollbarWidth = props.scrollbarWidth;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.fixedColumnsWidth = this.updateFixedWidth(props);
    this.scrollWidth = this.getSumSize(props.columnCount, props.getCellWidth);
    this.scrollHeight = this.getSumSize(props.rowCount - props.fixedRowCount, props.rowHeight);
  }

  componentDidMount() {
    const { defaultScrollLeft, columnScrollStartIndex } = this.props;
    const { fixedColumnCount } = this;
    emitter.addListener('TRIGGER_CHANGE_COLUMN_WIDTH_MASK_' + this.mdtabldId, this.showColumnWidthChangeMask);
    $(this.mdtable).on('mouseenter', '.cell:not(.row-0)', this.handleCellEnter);
    $(this.mdtable).on('mouseleave', '.cell:not(.row-0)', this.handleCellLeave);
    $(this.mdtable).on('mousewheel', '.scrollInTable', this.handleStopPop);
    // --- 表格触摸事件处理 ---
    var tablehammer = new Hammer(this.mdtable, { inputClass: Hammer.TouchInput });
    this.tablehammer = tablehammer;
    this.leftForHammer = _.get(this.scrollhor, 'scrollLeft') || 0;
    this.topForHammer = _.get(this.scrollver, 'scrollTop') || 0;
    this.lastPandeltaX = 0;
    this.lastPandeltaY = 0;
    tablehammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
    tablehammer.on('panmove', this.handlePanMove);
    tablehammer.on('panend', this.handlePanEnd);
    // ---
    $(this.mdtable).on('mousewheel', this.handleMouseWheel);
    if (columnScrollStartIndex > fixedColumnCount) {
      const column = document.querySelector('.row-0.col-' + (columnScrollStartIndex - fixedColumnCount + 1));

      if (column) {
        this.setScroll({ left: column.offsetLeft });
      }
    }

    if (defaultScrollLeft) {
      this.setScroll({ left: defaultScrollLeft });
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps !== this.props) {
      if (this.props.rowHeight !== prevProps.rowHeight) {
        this.scrollHeight = this.getSumSize(this.props.rowCount - this.props.fixedRowCount, this.props.rowHeight);
        this.fixedColumnsWidth = this.updateFixedWidth(this.props);

        // react-window 2 没有 resetAfterIndices。实测它的尺寸缓存由 cellProps 的标识失效，
        // 而下面 renderGrid 每次渲染都会重建 cellProps 对象，所以重渲一次就会整体重新测量。
        this.forceUpdate();
      }

      if (
        !_.isEqual(this.props.sheetColumnWidths, prevProps.sheetColumnWidths) ||
        this.props.fixedColumnCount !== prevProps.fixedColumnCount ||
        this.props.rowCount !== prevProps.rowCount ||
        this.props.columnCount !== prevProps.columnCount ||
        this.props.width !== prevProps.width ||
        this.props.height !== prevProps.height
      ) {
        this.updateTableLayout(this.props);
      }

      if (this.props.defaultScrollLeft !== prevProps.defaultScrollLeft) {
        this.setScroll({
          left: this.props.defaultScrollLeft,
        });
      }
    }

    this.needUpdateRows = [];
  }

  componentWillUnmount() {
    emitter.removeListener('TRIGGER_CHANGE_COLUMN_WIDTH_MASK_' + this.mdtabldId, this.showColumnWidthChangeMask);
    $(this.mdtable).off('mouseenter', '.cell:not(.row-0)', this.handleCellEnter);
    $(this.mdtable).off('mouseleave', '.cell:not(.row-0)', this.handleCellLeave);
    $(this.mdtable).off('mousewheel', '.scrollInTable', this.handleStopPop);
    $(this.mdtable).off('mousewheel', this.handleMouseWheel);
    if (this.tablehammer) {
      this.tablehammer.off('panmove', this.handlePanMove);
      this.tablehammer.off('panend', this.handlePanEnd);
      this.tablehammer.destroy();
    }
  }

  get widthScroll() {
    return this.scrollWidth > this.props.width;
  }

  get heightScroll() {
    const { height, showFooterRow } = this.props;
    return (
      this.scrollHeight >
      height - FIXED_ROW_HEIGHT - (showFooterRow ? FOOTER_ROW_HEIGHT : 0) - (this.widthScroll ? this.scrollbarWidth : 0)
    );
  }

  get width() {
    const { width, responseHeight } = this.props;
    return this.heightScroll && !responseHeight ? width - this.scrollbarWidth : width;
  }

  get height() {
    const { height } = this.props;
    return this.widthScroll ? height - this.scrollbarWidth - 3 : height;
  }

  updateFixedWidth(props) {
    let fixedWidth = this.getSumSize(props.fixedColumnCount, props.getCellWidth);
    this.fixedColumnCount = props.fixedColumnCount;
    if (fixedWidth > props.width) {
      this.fixedColumnCount = 1;
      fixedWidth = this.getSumSize(this.fixedColumnCount, props.getCellWidth);
    }

    return fixedWidth;
  }

  updateRow(rowIndex) {
    this.needUpdateRows = [rowIndex];
    this.updateTableLayout();
  }

  // hammer event
  handlePanMove = e => {
    if (window.disableTableScroll) {
      return;
    }

    const isScrollVer = Math.abs(e.deltaY) > Math.abs(e.deltaX);
    this.leftForHammer = this.leftForHammer + this.lastPandeltaX - e.deltaX;
    this.topForHammer = this.topForHammer + this.lastPandeltaY - e.deltaY;
    this.lastPandeltaX = e.deltaX;
    this.lastPandeltaY = e.deltaY;
    if (isScrollVer) {
      this.touchScroll({ top: this.topForHammer });
    } else {
      this.touchScroll({ left: this.leftForHammer });
    }
  };

  // hammer event
  handlePanEnd = () => {
    this.lastPandeltaX = 0;
    this.lastPandeltaY = 0;
  };

  handleStopPop(event) {
    event.stopPropagation();
  }

  handleMouseWheel = event => {
    let { deltaX, deltaY } = event;
    let isScrollVer = Math.abs(deltaY) > Math.abs(deltaX);

    if ((isScrollVer && this.heightScroll) || (!isScrollVer && this.widthScroll)) {
      if (
        this.scrollver &&
        ((deltaY > 0 && this.scrollver.scrollTop === 0) ||
          (deltaY < 0 && this.scrollver.scrollTop + this.scrollver.clientHeight === this.scrollver.scrollHeight))
      ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();
    }

    if (navigator.platform.indexOf('Win') > -1 && event.shiftKey) {
      isScrollVer = false;
      deltaX = deltaX * -1;
    }

    if (isScrollVer && this.scrollver) {
      const newTop = this.scrollver.scrollTop - deltaY * event.deltaFactor;
      this.scrollver.scrollTop = newTop;
      this.topForHammer = newTop;
    } else if (this.scrollhor) {
      const newLeft = this.scrollhor.scrollLeft + deltaX * event.deltaFactor;
      this.scrollhor.scrollLeft = newLeft;
      this.leftForHammer = newLeft;
    }
  };

  handleCellLeave = () => {
    const { onCellLeave = () => {} } = this.props;

    if (this.mdtable) {
      $(this.mdtable).find('.cell').removeClass('hover');
      onCellLeave();
    }
  };

  handleCellEnter = e => {
    const { onCellEnter = () => {} } = this.props;
    const $target = $(e.originalEvent.target).closest('.cell');
    const classMatch = $target.attr('class').match(/.*(row-[0-9]+) .*/);

    if (classMatch && this.mdtable) {
      $(this.mdtable).find('.cell').removeClass('hover');
      $(this.mdtable)
        .find('.' + classMatch[1])
        .addClass('hover');
      onCellEnter($target[0]);
    }
  };

  updateTableLayout = props => {
    props = props || this.props;
    this.scrollWidth = this.getSumSize(props.columnCount, props.getCellWidth);
    this.scrollHeight = this.getSumSize(props.rowCount - props.fixedRowCount, props.rowHeight);
    this.fixedColumnsWidth = this.updateFixedWidth(props);
    // 同上：v2 无 resetAfterIndices，重渲一次即让全部 6 个网格重新测量，
    // 不再需要逐个持有并调用网格实例。
    this.forceUpdate();
  };

  getSumSize(index, size) {
    let width = 0;

    for (let i = 0; i < index; i++) {
      if (typeof size === 'function') {
        width += size(i);
      } else {
        width += size;
      }
    }

    return width;
  }

  touchScroll = ({ left, top }) => {
    if (_.isNumber(top) && this.scrollver) {
      this.scrollver.scrollTop = top;
    }

    if (_.isNumber(left) && this.scrollhor) {
      this.scrollhor.scrollLeft = left;
    }
  };

  setScroll = ({ left, top }) => {
    const newPos = {};

    if (_.isNumber(left)) {
      newPos.left = left;
    }

    if (_.isNumber(top)) {
      newPos.top = top;
    }

    if (!_.isEmpty(newPos)) {
      this.scrollTo(newPos);
      if (!_.isUndefined(left) && this.scrollhor) {
        this.scrollhor.scrollLeft = left;
      }

      if (!_.isUndefined(top) && this.scrollver) {
        this.scrollver.scrollTop = top;
      }
    }
  };

  scrollTo = ({ top, left }) => {
    if (_.isNumber(left)) {
      this.scrollLeft = left;
      emitter.emit('MDTABLE_SCROLL');
      // v2 删掉了命令式 scrollTo，改为通过 imperative API 的 element getter 拿外层节点直接写。
      setGridScrollLeft(this.toprightgrid, left);
      setGridScrollLeft(this.mainrightgrid, left);
      setGridScrollLeft(this.bottomrightgrid, left);
    }

    if (_.isNumber(top)) {
      this.scrollTop = top;
      setGridScrollTop(this.mainrightgrid, top);
      setGridScrollTop(this.mainleftgrid, top);
    }
  };

  renderTable = ({ hide, className, top, left, ref, isColumnFixed, isRowFixed, renderFooter }, index) => {
    const {
      disableFrozen,
      responseHeight,
      topFixed,
      columnCount,
      rowCount,
      getCellWidth,
      rowHeight,
      showFooterRow,
      heightOffset,
      renderCell,
      allowlink,
      renderFooterCell,
    } = this.props;
    const { fixedColumnCount } = this;
    const { width, height } = this;
    let cellHeight;
    let gridHeight;
    const fixedRowCount = topFixed ? 1 : 0;

    if (renderFooter) {
      cellHeight = FOOTER_ROW_HEIGHT;
      gridHeight = FOOTER_ROW_HEIGHT;
    } else if (isRowFixed) {
      cellHeight = FIXED_ROW_HEIGHT;
      gridHeight = FIXED_ROW_HEIGHT;
    } else {
      cellHeight = rowHeight;
      gridHeight = responseHeight
        ? (rowCount - fixedRowCount) * rowHeight + heightOffset
        : height - FIXED_ROW_HEIGHT - (showFooterRow ? FOOTER_ROW_HEIGHT : 0);
    }

    if (hide) {
      return;
    }

    return (
      <WindowGrid
        key={index}
        className={className}
        // v2 没有 width / height prop（它自测量容器），尺寸只能通过 style 给。
        // overflow: hidden 是刻意的：滚动由 scrollTo() 命令式驱动，见本文件的 setScroll。
        style={{
          ...RESET_V2_CONTAINER_BOX,
          position: 'absolute',
          overflow: 'hidden',
          top,
          left,
          width: isColumnFixed ? this.fixedColumnsWidth : width - this.fixedColumnsWidth,
          height: gridHeight,
          borderRight:
            fixedColumnCount > 1 && !disableFrozen && className.match(/left-grid/)
              ? '1px solid var(--color-border-primary)'
              : '',
        }}
        gridRef={ref}
        columnCount={isColumnFixed ? fixedColumnCount : columnCount - fixedColumnCount}
        columnWidth={columnIndex => getCellWidth(isColumnFixed ? columnIndex : columnIndex + fixedColumnCount)}
        rowCount={isRowFixed ? fixedRowCount : rowCount - fixedRowCount}
        rowHeight={() => cellHeight}
        cellComponent={MDTableGridCell}
        // v2 把 cellProps【展开】传给 cell，所以原来那个内联 render 函数换成模块级的
        // MDTableGridCell（标识稳定，不会每次渲染都让所有格子重挂）；
        // 行列偏移改由 cellProps 传进去、在 cell 里做加法。
        cellProps={{
          renderVersion: this.renderVersion,
          needUpdateRows: this.needUpdateRows,
          renderCell,
          renderFooterCell,
          renderFooter,
          columnOffset: isColumnFixed ? 0 : fixedColumnCount,
          rowOffset: isRowFixed ? 0 : fixedRowCount,
          grid: ref,
          scrollTo: this.setScroll,
          tableScrollTop: this.scrollTop,
          gridHeight: gridHeight,
          allowlink: allowlink,
        }}
      />
    );
  };

  showColumnWidthChangeMask = ({ columnWidth, defaultLeft, maskMinLeft, callback }) => {
    this.setState({
      columnWidthChangeMaskVisible: true,
      maskLeft: defaultLeft,
      maskMinLeft: maskMinLeft || defaultLeft - (columnWidth - 10),
      maskMaxLeft: window.innerWidth,
      maskOnChange: left => {
        this.setState({
          columnWidthChangeMaskVisible: false,
        });
        const newWidth = columnWidth + (left - defaultLeft);
        callback(newWidth);
      },
    });
  };

  render() {
    // v1 每次渲染都重挂所有可见格子（原因见 MDTableGridCell 的注释），下游 renderCell 因此
    // 从不需要考虑自己何时该更新。v2 会按 cellProps 浅比较跳过未变的格子，若消费方的
    // renderCell 标识稳定（如类方法）但闭包里的数据变了，格子就会停在旧内容上。
    // 用一个每次渲染都变的版本号让 cellProps 必然失效，把更新语义精确对齐到 v1
    // （重渲而非重挂，成本仍低于 v1）。想拿回 v2 的记忆化收益，得先审计各消费方的 renderCell。
    this.renderVersion = (this.renderVersion || 0) + 1;
    const {
      loading,
      width,
      allowlink,
      heightOffset,
      topFixed,
      scrollBarHoverShow,
      responseHeight,
      forceScrollOffset,
      rowHeight,
      className,
      fixedRowCount,
      rowCount,
      renderEmpty,
      showFooterRow,
    } = this.props;
    const { fixedColumnCount } = this;
    const { columnWidthChangeMaskVisible, maskLeft, maskMaxLeft, maskMinLeft, maskOnChange } = this.state;
    const { height } = this;
    const isEmpty = rowCount === 0;
    const tables = [
      {
        hide: !topFixed,
        className: 'top-left-grid',
        top: 0,
        left: 0,
        height: FIXED_ROW_HEIGHT,
        isColumnFixed: true,
        isRowFixed: true,
        ref: this.topleftgrid,
      },
      {
        hide: !topFixed,
        className: 'top-right-grid',
        top: 0,
        left: this.fixedColumnsWidth,
        isColumnFixed: false,
        isRowFixed: true,
        ref: this.toprightgrid,
      },
      {
        hide: !fixedColumnCount || isEmpty,
        className: 'main-left-grid',
        top: FIXED_ROW_HEIGHT,
        left: 0,
        isColumnFixed: true,
        isRowFixed: false,
        ref: this.mainleftgrid,
      },
      {
        hide: isEmpty,
        className: 'main-right-grid',
        top: FIXED_ROW_HEIGHT,
        left: this.fixedColumnsWidth,
        isColumnFixed: false,
        isRowFixed: false,
        ref: this.mainrightgrid,
      },
      {
        hide: !showFooterRow || isEmpty,
        className: 'bottom-left-grid',
        top: height - FOOTER_ROW_HEIGHT,
        left: 0,
        isColumnFixed: true,
        isRowFixed: true,
        ref: this.bottomleftgrid,
        renderFooter: true,
      },
      {
        hide: !showFooterRow || isEmpty,
        className: 'bottom-right-grid footer',
        top: height - FOOTER_ROW_HEIGHT,
        left: this.fixedColumnsWidth,
        isColumnFixed: false,
        isRowFixed: true,
        ref: this.bottomrightgrid,
        renderFooter: true,
      },
    ];
    return (
      <div
        className={cx('mdTable', `id-${this.mdtabldId}-id`, className, {
          widthScroll: !!this.widthScroll,
          disableRowHoverBgColor: allowlink === '0',
        })}
        ref={mdtable => (this.mdtable = mdtable)}
        style={
          responseHeight
            ? {
                height:
                  (topFixed ? FIXED_ROW_HEIGHT + (rowCount - 1) * rowHeight : rowCount * rowCount) +
                  (this.widthScroll || (forceScrollOffset && forceScrollOffset.height) ? this.scrollbarWidth : 0) +
                  heightOffset,
              }
            : {}
        }
      >
        {columnWidthChangeMaskVisible && (
          <DragMask value={maskLeft} min={maskMinLeft} max={maskMaxLeft} onChange={maskOnChange} />
        )}
        {!this.widthScroll && forceScrollOffset && forceScrollOffset.height && (
          <div
            style={{
              width: width - (this.heightScroll ? this.scrollbarWidth : 0),
              height: this.scrollbarWidth,
              overflow: 'auto',
              position: 'absolute',
              bottom: 1,
            }}
          />
        )}
        {this.widthScroll && (
          <div
            className={cx('scroll-hor', { hoverShow: scrollBarHoverShow })}
            ref={scroll => (this.scrollhor = scroll)}
            style={{
              width: width - (this.heightScroll ? this.scrollbarWidth : 0),
              height: this.scrollbarWidth,
              overflow: 'auto',
              position: 'absolute',
              bottom: 1,
            }}
            onScroll={e => {
              this.scrollTo({ left: e.target.scrollLeft });
            }}
          >
            <div className="content" style={{ width: this.scrollWidth, height: this.scrollbarWidth }}></div>
          </div>
        )}
        {this.heightScroll && (
          <div
            className={cx('scroll-ver', { hide: responseHeight, hoverShow: scrollBarHoverShow })}
            ref={scroll => (this.scrollver = scroll)}
            style={{
              top: FIXED_ROW_HEIGHT * fixedRowCount,
              height: height - fixedRowCount * FIXED_ROW_HEIGHT - (showFooterRow ? FOOTER_ROW_HEIGHT : 0),
              width: this.scrollbarWidth,
              overflow: 'auto',
              position: 'absolute',
              right: 1,
            }}
            onScroll={e => {
              this.scrollTo({ top: e.target.scrollTop });
            }}
          >
            <div className="content" style={{ height: this.scrollHeight, width: this.scrollbarWidth }}></div>
          </div>
        )}
        <div className={cx('mdTableContent', { isEmpty })} ref={table => (this.table = table)}>
          {tables.map(this.renderTable)}
          {loading && (
            <div
              style={{
                position: 'absolute',
                top: FIXED_ROW_HEIGHT,
                width: '100%',
                height: '100%',
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
          {!loading &&
            isEmpty &&
            renderEmpty({
              style: {
                top: FIXED_ROW_HEIGHT,
                ...(this.widthScroll ? { height: 'auto', bottom: this.scrollbarWidth } : {}),
              },
            })}
        </div>
      </div>
    );
  }
}
