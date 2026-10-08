import { useEffect, useRef, useState } from 'react';
import { ActionSheet, Popup } from 'antd-mobile';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import { filterRowsByKeywords } from 'src/utils/record';
import { getViewportSize } from '../../tools/viewport';
import SearchInput from '../ChildTable/SearchInput';
import MobileRelateTreeTable from './MobileRelateTreeTable';
import type { MobileRelateTreeTableProps } from './MobileRelateTreeTable';
import type { RelateTreeRow } from './treeData';

interface SectionProps extends Omit<MobileRelateTreeTableProps, 'showExpand' | 'h5height'> {
  keywords?: string | undefined;
  onSearch: (keywords: string) => void;
  isLoadingMore?: boolean | undefined;
  showLoadMore?: boolean | undefined;
  onLoadMore: () => void;
}
const ExpandedContent = styled.div<{ $width: number; $height: number; $rotate: boolean }>`
  display: flex;
  flex-direction: column;
  background: var(--color-background-primary);
  position: fixed;
  top: 0;
  left: 0;
  width: ${props => props.$width}px;
  height: ${props => props.$height}px;
  ${props => props.$rotate && `transform: rotate(90deg); transform-origin: top left; left: ${props.$height}px;`}
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  .treeExpandHeader { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); }
  .treeExpandedBody { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0 var(--space-3); }
`;
const rowHeightLabels = [_l('紧凑'), _l('中等'), _l('高'), _l('自适应')];
export default function RelateTreeSection(props: SectionProps) {
  const { keywords = '', onSearch, onLoadMore, isLoadingMore, showLoadMore } = props;
  const [expanded, setExpanded] = useState(false);
  const rowHeightSheet = useRef<ReturnType<typeof ActionSheet.show> | null>(null);
  const [viewport, setViewport] = useState(getViewportSize);
  const [rowHeight, setRowHeight] = useState<'0' | '1' | '2' | '3'>(() => {
    const configured = props.control.advancedSetting?.['h5height'];
    return configured === '1' || configured === '2' || configured === '3' ? configured : '0';
  });
  useEffect(() => () => rowHeightSheet.current?.close(), []);
  useEffect(() => {
    if (!expanded) return undefined;
    const resize = () => setViewport(getViewportSize());
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
    };
  }, [expanded]);
  const rows = props.isEdit && keywords
    ? filterRowsByKeywords({ rows: props.rows, controls: props.controls, keywords }) as RelateTreeRow[]
    : props.rows;
  const renderLoadMore = () => showLoadMore && (
    <button className="colorPrimary Hand mTop10" type="button" disabled={isLoadingMore} onClick={onLoadMore}>
      {isLoadingMore ? _l('加载中...') : _l('加载更多')}
    </button>
  );
  const chooseRowHeight = () => {
    rowHeightSheet.current?.close();
    rowHeightSheet.current = ActionSheet.show({
      popupClassName: 'md-adm-actionSheet',
      actions: rowHeightLabels.map((text, index) => ({ key: String(index), text })),
      onAction: action => {
        const value = String(action.key);
        if (value === '0' || value === '1' || value === '2' || value === '3') setRowHeight(value);
        rowHeightSheet.current?.close();
      },
    });
  };
  const portrait = viewport.width <= viewport.height;
  return <div className="mobileChildTableCon">
    <div className="flexRow alignItemsCenter mBottom10" style={{ gap: 'var(--space-3)' }}>
      <SearchInput keywords={keywords} onOk={onSearch} onClear={() => onSearch('')} />
      <button type="button" aria-label={_l('调整行高')} onClick={chooseRowHeight}><Icon icon="row_height" /></button>
      <button type="button" aria-label={_l('展开')} onClick={() => { setViewport(getViewportSize()); setExpanded(true); }}><Icon icon="enlarge1" /></button>
    </div>
    {!expanded && <MobileRelateTreeTable {...props} rows={rows} h5height={rowHeight} showHeader={Boolean(keywords) || rows.length > 0} />}
    {renderLoadMore()}
    <Popup visible={expanded} position="bottom" onMaskClick={() => setExpanded(false)} bodyStyle={{ width: '100vw', height: '100vh', borderRadius: 0 }}>
      <ExpandedContent $width={portrait ? viewport.height : viewport.width} $height={portrait ? viewport.width : viewport.height} $rotate={portrait}>
        <div className="treeExpandHeader">
          <span className="flex bold ellipsis">{props.control.controlName}</span>
          <button type="button" aria-label={_l('调整行高')} onClick={chooseRowHeight}><Icon icon="row_height" /></button>
          <button type="button" aria-label={_l('关闭')} onClick={() => setExpanded(false)}><Icon icon="close" /></button>
        </div>
        <div className="treeExpandedBody">
          <MobileRelateTreeTable {...props} rows={rows} h5height={rowHeight} showExpand showHeader={Boolean(keywords) || rows.length > 0} />
          {renderLoadMore()}
        </div>
      </ExpandedContent>
    </Popup>
  </div>;
}
