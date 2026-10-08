import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheet } from 'antd-mobile';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import { getTitleTextFromControls } from 'src/utils/domain/control/display';
import { controlState } from 'src/utils/domain/control/state';
import { getControlStyles } from 'src/utils/domain/control/style';
import { lineHeightInfo, TableWrap } from '../ChildTable/TableComponent';
import { getTableBodyHeight, getTableScrollers, getViewportSize } from '../../tools/viewport';
import type { ReactNode, TouchEvent } from 'react';
import type { FormControl } from 'src/utils/controlTypes';
import type { SheetSwitchPermitItem } from 'src/utils/worksheet';
import { createRelateTreeIndex, getDefaultExpandedIds, getTreeChildrenIds, getVisibleTreeRows } from './treeData';
import type { RelateTreeRow, VisibleTreeRow } from './treeData';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import MobileCardCellControl from '../MobileCardCellControls/MobileCardCellControl';

const TREE_LEVEL_INDENT = 16;
const TREE_TITLE_CELL_MAX_WIDTH = 180;


const TreeTableWrap = styled(TableWrap)`
  margin-bottom: 10px;

  .titleCell {
    display: flex;
    align-items: center;
    box-sizing: content-box;
    max-width: ${TREE_TITLE_CELL_MAX_WIDTH}px;
    min-width: 0;
  }

  .treeToggle {
    width: 18px;
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    text-align: center;
    margin-right: var(--space-2);
  }

  .treeNumber {
    flex-shrink: 0;
    margin-right: var(--space-2);
    color: var(--color-text-tertiary);
  }

  .treeTitle {
    min-width: 0;
    color: var(--color-text-title);
    font-size: var(--font-md);
    font-weight: 600;
  }

  .treeLoading {
    display: inline-block;
    animation: rotate 1.2s linear infinite;
  }

  .moreOperate {
    width: 100%;
    text-align: center;
    color: var(--color-text-tertiary);
  }
`;

export interface MobileRelateTreeTableProps {
  appId?: string | undefined; control: FormControl; controls: FormControl[]; rows: RelateTreeRow[]; titleControl: FormControl;
  displayControls: FormControl[]; projectId?: string | undefined; worksheetId?: string | undefined;
  sheetSwitchPermit?: SheetSwitchPermitItem[] | undefined; h5height?: '0' | '1' | '2' | '3' | undefined;
  showExpand?: boolean | undefined; showHeader?: boolean | undefined; allowAddChild?: boolean | undefined; allowRemove?: boolean | undefined;
  onAddChild: (row: RelateTreeRow) => void; onLoadChildren: (row: RelateTreeRow) => Promise<unknown>;
  onOpen: (row: RelateTreeRow) => void; onRemove: (row: RelateTreeRow) => unknown; isEdit?: boolean | undefined;
}
interface TableTouchInfo {
  x: number; y: number; left: number; top: number; horizontalScroller?: HTMLElement | undefined; verticalScroller?: HTMLElement | undefined;
}
interface TreeColumn { dataIndex: string; title: ReactNode; width: number; render: (value: unknown, row: VisibleTreeRow) => ReactNode; }

export default function MobileRelateTreeTable(props: MobileRelateTreeTableProps) {
  const {
    appId,
    control,
    controls,
    rows,
    titleControl,
    displayControls,
    projectId,
    worksheetId,
    sheetSwitchPermit,
    h5height,
    showExpand,
    showHeader = true,
    allowAddChild,
    allowRemove,
    onAddChild,
    onLoadChildren,
    onOpen,
    onRemove,
    isEdit = false,
  } = props;
  const defaultLayer = Math.max(Number(_.get(control, 'advancedSetting.defaultlayer')) || 1, 1);
  const [expandedIds, setExpandedIds] = useState(() => getDefaultExpandedIds(rows, defaultLayer));
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const actionSheetHandlerRef = useRef<ReturnType<typeof ActionSheet.show> | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<TableTouchInfo | null>(null);
  const expandedInitialized = useRef(rows.length > 0);
  useEffect(() => {
    if (!expandedInitialized.current && rows.length) {
      expandedInitialized.current = true;
      setExpandedIds(getDefaultExpandedIds(rows, defaultLayer));
    }
  }, [rows, defaultLayer]);
  const treeIndex = useMemo(() => createRelateTreeIndex(rows), [rows]);
  const visibleRows = useMemo(() => getVisibleTreeRows(rows, expandedIds), [expandedIds, rows]);
  const getChildren = (row: RelateTreeRow): RelateTreeRow[] => treeIndex.children(row);

  const maxTreePadding = Math.max((_.max(visibleRows.map(row => row.treeLevel)) || 1) - 1, 0) * TREE_LEVEL_INDENT;
  useEffect(() => () => actionSheetHandlerRef.current?.close(), []);
  const showNumber = _.get(control, 'advancedSetting.hidenumber') !== '1';

  const toggleRow = async (row: RelateTreeRow): Promise<void> => {
    const isExpanded = expandedIds.has(row.rowid);

    if (isExpanded) {
      setExpandedIds(current => {
        const next = new Set(current);
        next.delete(row.rowid);
        return next;
      });
      return;
    }

    setExpandedIds(current => new Set(current).add(row.rowid));
    if (!getChildren(row).length && getTreeChildrenIds(row).length) {
      setLoadingIds(current => _.uniq(current.concat(row.rowid)));
      try {
        await onLoadChildren(row);
      } catch (error: unknown) {
        setExpandedIds(current => { const next = new Set(current); next.delete(row.rowid); return next; });
        alertIfNotUnauthorized(error, _l('加载失败'), 2);
      } finally {
        setLoadingIds(current => current.filter(id => id !== row.rowid));
      }
    }
  };

  const showOperate = (row: VisibleTreeRow): void => {
    const sourceRow = { ..._.omit(row, ['treeLevel', 'treeNumber']), rowid: row.rowid }; 
    const title = getTitleTextFromControls(controls, sourceRow) || _l('未命名');
    const actions: Parameters<typeof ActionSheet.show>[0]['actions'] = [
      allowRemove && {
        key: 'remove',
        text: (
          <div className="flexRow valignWrapper">
            <Icon icon="link_Dismiss" className="Font18 textError mRight16" />
            <span className="bold">{_l('取消关联')}</span>
          </div>
        ),
      },
      allowAddChild && {
        key: 'addChild',
        text: (
          <div className="flexRow valignWrapper">
            <Icon icon="add" className="Font18 textTertiary mRight16" />
            <span className="bold">{_l('添加下级记录')}</span>
          </div>
        ),
      },
    ].reduce<Parameters<typeof ActionSheet.show>[0]['actions']>((result, action) => { if (action) result.push(action); return result; }, []);

    if (!actions.length) return;

    actionSheetHandlerRef.current = ActionSheet.show({
      popupClassName: 'md-adm-actionSheet',
      actions,
      extra: (
        <div className="flexRow header">
          <span className="Font13 overflow_ellipsis">{title}</span>
          <div className="closeIcon flex-shrink-0" onClick={() => actionSheetHandlerRef.current?.close()}>
            <Icon icon="close" />
          </div>
        </div>
      ),
      onAction: action => {
        actionSheetHandlerRef.current?.close();
        if (action.key === 'remove') {
          onRemove(sourceRow);
        } else if (action.key === 'addChild') {
          setExpandedIds(current => new Set(current).add(row.rowid));
          onAddChild(sourceRow);
        }
      },
    });
  };

  const columns: TreeColumn[] = [
    {
      dataIndex: titleControl.controlId || 'title',
      title: titleControl.controlName || _l('标题'),
      width: TREE_TITLE_CELL_MAX_WIDTH + maxTreePadding,
      render: (_value: unknown, row: VisibleTreeRow) => {
        const children = getChildren(row);
        const hasChildren = children.length || getTreeChildrenIds(row).length;
        const isExpanded = expandedIds.has(row.rowid);
        const isLoading = _.includes(loadingIds, row.rowid);

        return (
          <div
            className="titleCell"
            style={{ paddingLeft: (row.treeLevel - 1) * TREE_LEVEL_INDENT }}
            onClick={() => onOpen({ ..._.omit(row, ['treeLevel', 'treeNumber']), rowid: row.rowid })}
          >
            <span className="treeToggle" onClick={event => event.stopPropagation()}>
              {isLoading ? (
                <i className="icon icon-loading_button treeLoading Font12" />
              ) : (
                !!hasChildren && (
                  <i
                    className={`icon ${isExpanded ? 'icon-arrow-down' : 'icon-arrow-right-tip'} Font12`}
                    onClick={() => toggleRow(row)}
                  />
                )
              )}
            </span>
            {showNumber && <span className="treeNumber">{row.treeNumber}</span>}
            <span className="treeTitle titleText ellipsis">
              {getTitleTextFromControls(controls, row) || _l('未命名')}
            </span>
          </div>
        );
      },
    },
    ...displayControls.map(item => ({
      dataIndex: item.controlId || '',
      title: item.controlName,
      width: 110,
      render: (_value: unknown, row: VisibleTreeRow) => {
        const currentControl = {
          ...item,
          fieldPermission: item.fieldPermission || '111',
          controlPermissions: item.controlPermissions || '111',
        };

        return (
          <div onClick={() => onOpen({ ..._.omit(row, ['treeLevel', 'treeNumber']), rowid: row.rowid })}>
            {controlState(currentControl).visible && (
              <MobileCardCellControl
                appId={appId}
                control={currentControl}
                isTableCell
                projectId={projectId}
                row={row}
                rowHeight={30}
                rowFormData={() => controls.map(c => ({ ...c, value: row[c.controlId || ''] }))}
                sheetSwitchPermit={sheetSwitchPermit}
                showControlName={false}
                worksheetId={worksheetId}
              />
            )}
          </div>
        );
      },
    })),
    ...(!showExpand && (allowRemove || allowAddChild)
      ? [
          {
            dataIndex: 'operate',
            title: '',
            width: 40,
            render: (_value: unknown, row: VisibleTreeRow) => (
              <div className="moreOperate" onClick={() => showOperate(row)}>
                <i className="icon icon-more_horiz Font18" />
              </div>
            ),
          },
        ]
      : []),
  ];
  const tableScrollX = _.sumBy(columns, 'width');

  useEffect(() => {
    if (!showExpand || !tableRef.current) return undefined;

    const tableRoot = tableRef.current;

    const updateTableBodyHeight = () => {
      const bodyHeight = getTableBodyHeight(tableRoot);

      if (bodyHeight) {
        tableRoot.style.setProperty('--mobile-table-body-height', `${bodyHeight}px`);
      }
    };

    const frame = window.requestAnimationFrame(updateTableBodyHeight);
    const resizeObserver = window.ResizeObserver ? new window.ResizeObserver(updateTableBodyHeight) : null;

    resizeObserver?.observe(tableRoot);
    window.addEventListener('resize', updateTableBodyHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateTableBodyHeight);
      tableRoot.style.removeProperty('--mobile-table-body-height');
    };
  }, [showExpand]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    const touch = event.touches[0];
    const { horizontalScroller, verticalScroller } = getTableScrollers(tableRef.current);

    touchRef.current =
      touch && (horizontalScroller || verticalScroller)
        ? {
            x: touch.clientX,
            y: touch.clientY,
            left: horizontalScroller?.scrollLeft || 0,
            top: verticalScroller?.scrollTop || 0,
            horizontalScroller,
            verticalScroller,
          }
        : null;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>): void => {
    const touch = event.touches[0];
    const touchInfo = touchRef.current;

    if (!touch || !touchInfo) return;

    const offsetX = touch.clientX - touchInfo.x;
    const offsetY = touch.clientY - touchInfo.y;
    const absX = Math.abs(offsetX);
    const absY = Math.abs(offsetY);
    const viewportSize = getViewportSize();
    const isRotateHorizontal = viewportSize.width <= viewportSize.height;

    if (Math.max(absX, absY) < 4 || (!isRotateHorizontal && absY > absX)) return;

    if (isRotateHorizontal && absX > absY) {
      const { verticalScroller } = touchInfo;

      if (!verticalScroller) return;

      const maxTop = verticalScroller.scrollHeight - verticalScroller.clientHeight;
      const nextTop = Math.max(0, Math.min(maxTop, touchInfo.top + offsetX));

      if (nextTop === verticalScroller.scrollTop) return;

      verticalScroller.scrollTop = nextTop;
    } else {
      const { horizontalScroller } = touchInfo;

      if (!horizontalScroller) return;

      const offset = isRotateHorizontal && absY > absX ? offsetY : offsetX;
      const maxLeft = horizontalScroller.scrollWidth - horizontalScroller.clientWidth;
      const nextLeft = Math.max(0, Math.min(maxLeft, touchInfo.left - offset));

      if (nextLeft === horizontalScroller.scrollLeft) return;

      horizontalScroller.scrollLeft = nextLeft;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    event.stopPropagation();
  };

  const clearTouch = () => {
    touchRef.current = null;
  };

  return (
    <>
      <div
        ref={tableRef}
        className="flex overflowHidden"
        style={{ minHeight: 0 }}
        onTouchStartCapture={showExpand ? handleTouchStart : undefined}
        onTouchMoveCapture={showExpand ? handleTouchMove : undefined}
        onTouchEndCapture={showExpand ? clearTouch : undefined}
        onTouchCancelCapture={showExpand ? clearTouch : undefined}
      >
        <TreeTableWrap
          className="mobileRelationTable treeRelationTable"
          controlStyles={getControlStyles([titleControl, ...displayControls])}
          h5height={h5height}
          noData={!visibleRows.length}
          $showExpand={showExpand}
          $showHeader={showHeader}
          columns={columns.map(item => ({
            ...item,
            title: (
              <div className={`ellipsis control-head-${item.dataIndex}`}>
                <span className="controlName ellipsis">{item.title}</span>
              </div>
            ),
            className: `mobileTableItem control-val-${item.dataIndex}`,
            onCell: () => ({
              style: {
                maxWidth: item.width,
                minWidth: item.width,
              },
            }),
          }))}
          dataSource={visibleRows}
          pagination={false}
          showHeader={showHeader}
          rowClassName={() => lineHeightInfo[Number(h5height || '1')] || ''}
          rowKey="rowid"
          scroll={
            showExpand
              ? { x: tableScrollX, y: 'var(--mobile-table-body-height, calc(100% - 40px))' }
              : { x: tableScrollX }
          }
          tableLayout="fixed"
        />
      </div>
      {!isEdit && !visibleRows.length && <div className="textTertiary mTop15 bold">{_l('暂无记录')}</div>}
    </>
  );
}
