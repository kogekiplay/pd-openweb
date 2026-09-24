import cx from 'classnames';
import { find, get } from 'lodash';
import styled from 'styled-components';
import { ScrollView, Skeleton } from 'ming-ui';
import { getTitleTextFromRelateControl } from 'src/utils/control';
import RegExpValidator from 'src/utils/expression';

const ListCon = styled.div`
  flex: 1;
  margin: 17px -24px 0;
  min-height: 90px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  &:not(.isMultiple) {
    margin-bottom: var(--space-5);
  }
`;

const ListScroll = styled(ScrollView)`
  flex: 1;
  overflow: auto;
  .scroll-viewport {
    padding: 0 var(--space-6) !important;
  }
`;

const ListItemCon = styled.div`
  height: 40px;
  padding: 0 var(--space-4);
  display: flex;
  align-items: center;
  cursor: pointer;
  &:hover {
    background: var(--color-background-hover);
  }
  &.selected {
    background: var(--color-primary-transparent);
    .listItemCheck {
      font-size: var(--font-xl);
      color: var(--color-primary-text);
    }
  }
  .listItemCover {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    object-fit: cover;
    margin-right: var(--space-3);
    flex-shrink: 0;
  }
  .listItemTitle {
    flex: 1;
    font-size: var(--font-md);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .listItemCheck {
    flex-shrink: 0;
    margin-left: var(--space-2);
    min-width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
  }
`;

const LoadMoreTip = styled.div`
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  color: var(--color-text-tertiary);
`;

const EmptyCon = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: var(--color-text-tertiary);
  font-size: var(--font-md);
  padding: var(--space-6);
`;

function getCoverUrl(record, coverControl) {
  if (!coverControl) return '';
  const v = record[coverControl.controlId];
  if (!v) return '';
  // 附件类控件：值为 JSON 字符串，形如 [{ext, previewUrl, ...}]
  if (typeof v === 'string') {
    try {
      const files = safeParse(v, 'array');
      const imageFile = files.find(f => RegExpValidator.fileIsPicture(f.ext));
      return imageFile ? imageFile.previewUrl : '';
    } catch {
      return '';
    }
  }

  if (typeof v === 'object' && v !== null && v.url) return v.url;
  return '';
}

function ListItem({ record, control, coverControl, multiple, selected, onSelect, onOpenRecord, noMaskTitle }) {
  // 有些接口会直接返回已渲染的 name（可能是掩码后的展示值）
  // 解码后希望走 renderText + noMask 展示明文，因此在 noMask 时临时屏蔽 name。
  const titleData =
    noMaskTitle && record && record.name
      ? {
          ...record,
          name: '',
        }
      : record;
  const title = getTitleTextFromRelateControl(control, titleData, { noMask: noMaskTitle }) || _l('未命名');
  const coverUrl = getCoverUrl(record, coverControl);

  const handleClick = () => {
    if (multiple) {
      onSelect(record.rowid);
    } else {
      onSelect(record.rowid);
    }
  };

  return (
    <ListItemCon
      className={cx({ selected })}
      onClick={handleClick}
      onDoubleClick={() => onOpenRecord && onOpenRecord(record)}
    >
      {coverUrl && <img className="listItemCover" src={coverUrl} alt="" />}
      <span className="listItemTitle" title={title}>
        {title || _l('未命名')}
      </span>
      {multiple && <span className="listItemCheck">{selected && <i className="icon icon-ok" />}</span>}
    </ListItemCon>
  );
}

export default function SelectDialogList({
  loading,
  records = [],
  controls = [],
  control,
  multiple,
  selectedRowIds = [],
  needHideRowIds = [],
  noMaskTitle,
  onToggleSelect,
  onOpenRecord,
  loadMore,
  hasMore,
  loadMoreLoading,
  emptyIcon,
  emptyText,
  recordsLoading,
}) {
  const coverControl = get(control, 'coverCid') && find(controls, { controlId: get(control, 'coverCid') });
  const displayRecords = records.filter(r => !needHideRowIds.includes(r.rowid));

  if (loading) {
    return (
      <ListCon>
        <Skeleton
          style={{ flex: 1 }}
          direction="column"
          widths={['30%', '40%', '90%', '60%']}
          active
          itemStyle={{ marginBottom: '10px' }}
        />
      </ListCon>
    );
  }

  return (
    <ListCon className={cx({ isMultiple: multiple })}>
      <ListScroll onScrollEnd={loadMore}>
        {displayRecords.length === 0 && !recordsLoading ? (
          <EmptyCon>
            {emptyIcon}
            <span className="mTop8">{emptyText}</span>
          </EmptyCon>
        ) : (
          displayRecords.map(record => (
            <ListItem
              key={record.rowid}
              record={record}
              control={control}
              coverControl={coverControl}
              multiple={multiple}
              selected={selectedRowIds.includes(record.rowid)}
              onSelect={onToggleSelect}
              onOpenRecord={onOpenRecord}
              noMaskTitle={noMaskTitle}
            />
          ))
        )}
        {hasMore && loadMoreLoading && <LoadMoreTip>{_l('加载更多...')}</LoadMoreTip>}
      </ListScroll>
    </ListCon>
  );
}
