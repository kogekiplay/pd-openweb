import { Fragment, useState } from 'react';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import _, { get } from 'lodash';
import { Icon, Menu, MenuItem, SortableList } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import type { SortableRenderItemOptions } from 'ming-ui/components/SortableList';
import { VerticalMiddle } from 'worksheet/components/Basics';
import type { FormControl } from 'src/utils/controlTypes';
import styled from 'src/utils/typedStyled';
import { FILTER_TYPE } from '../enum';
import { filterRecord } from '../filterModelBoundary';
import type { EditingFilter } from '../filterModelTypes';
import { filterId } from './contents/dynamicBoundary';
import type { FilterTitleListProps } from './contents/dynamicTypes';

const Con = styled.div`
  .title {
    font-size: var(--font-md);
    color: var(--color-text-tertiary);
    padding: var(--space-2) 18px;
  }
`;

const MenuCon = styled(Menu)`
  width: 160px;
  position: relative !important;
  hr {
    border: none;
    margin: var(--space-1) 0;
    border-top: 1px solid var(--color-border-secondary) !important;
  }
  .ming.Item .Item-content {
    padding-left: 50px !important;
    .Icon {
      left: 15px;
    }
  }
  .red {
    color: var(--color-error-text);
    &.ming.MenuItem .icon {
      color: var(--color-error);
    }
  }
`;

const FilterTitleItemCon = styled(VerticalMiddle)`
  cursor: pointer;
  height: 36px;
  border-radius: var(--radius-sm);
  padding: 0 18px;
  justify-content: space-between;
  position: relative;
  .content {
    overflow: hidden;
  }
  .icon.dragger {
    cursor: pointer;
    font-size: var(--font-xs);
    transform: translateX(-14px);
    position: absolute;
    top: 12px;
    left: 18px;
  }
  .icon {
    font-size: var(--font-xl);
    color: var(--color-text-tertiary);
  }
  .hoverShow {
    display: none;
  }
  &.active {
    background: var(--color-primary-transparent);
    color: var(--color-primary-text);
    .filterIcon {
      color: var(--color-primary);
    }
  }
  &:hover:not(.active):not(.isDragging) {
    background: var(--color-background-secondary);
  }
  &:hover:not(.isDragging) {
    .hoverShow {
      display: inline-block;
    }
  }
  &.moreMenuActive {
    .moreMenu {
      display: inline-block;
    }
  }
  &.draggingItem {
    z-index: 9999;
    background: var(--color-background-secondary);
    .dragger {
      display: inline-block;
    }
  }
`;

function FilterTitleItem(
  props: Omit<SortableRenderItemOptions<EditingFilter>, 'item'> & {
    error: boolean;
    filter: EditingFilter;
    active: boolean;
    className: string;
    isCharge?: boolean | undefined;
    onEditFilter: (filter: EditingFilter) => void;
    onCopy: (filter: EditingFilter) => void;
    onDelete: (filter: EditingFilter) => void;
    onToggleFilterType: (filter: EditingFilter) => void;
    triggerFilter: (filter: EditingFilter) => void;
    onHideFilterPopup: () => void;
  },
) {
  const {
    error,
    isCharge,
    className,
    active,
    filter,
    DragHandle,
    onEditFilter,
    onCopy,
    onDelete,
    onToggleFilterType,
    triggerFilter,
    onHideFilterPopup,
  } = props;
  const { name } = filter;
  const [moreMenuActive, setMoreMenuActive] = useState(false);
  const canEdit =
    (filter.type === FILTER_TYPE.PUBLIC ? isCharge : filter.createAccountId === md.global.Account.accountId) &&
    !get(window, 'shareState.shareId');
  return (
    <FilterTitleItemCon
      className={cx(className, { active, moreMenuActive })}
      onClick={() => {
        triggerFilter(filter);
        onHideFilterPopup();
      }}
    >
      <VerticalMiddle className="content">
        {DragHandle && (
          <DragHandle>
            <i className="icon icon-drag dragger hoverShow hoverColorPrimary"></i>
          </DragHandle>
        )}
        <i className="icon icon-worksheet_filter filterIcon"></i>
        <span title={name} className="Font14 mLeft10 ellipsis">
          {name}
        </span>
        {error && (
          <Tooltip title={_l('该筛选器中的筛选条件出错')}>
            <i className="icon icon-error1 Font16 mLeft6" style={{ color: 'var(--color-error)' }}></i>
          </Tooltip>
        )}
      </VerticalMiddle>
      <div onClick={e => e.stopPropagation()}>
        {canEdit ? (
          <Tooltip placement="bottom" title={_l('编辑')}>
            <i
              className="icon icon-edit Hand editIcon hoverShow hoverColorPrimary Font16 mRight12"
              onClick={() => onEditFilter(filter)}
            ></i>
          </Tooltip>
        ) : (
          <Tooltip placement="bottom" title={_l('查看')}>
            <i
              className="icon icon-visibility Hand moreMenu hoverShow hoverColorPrimary Font16 mRight12"
              onClick={() => onEditFilter(filter)}
            ></i>
          </Tooltip>
        )}
        <Trigger
          popupVisible={moreMenuActive}
          action={['click']}
          popupAlign={{
            points: ['tr', 'br'],
            offset: [0, 4],
            overflow: {
              adjustX: true,
              adjustY: true,
            },
          }}
          popup={
            <MenuCon>
              {canEdit && (
                <MenuItem
                  icon={<Icon icon="rename_input" className="Font18" />}
                  onClick={() => {
                    onEditFilter(filter);
                    setTimeout(() => {
                      const element = document.querySelector<HTMLElement>('.filterDetailName .name');
                      if (!element) throw new TypeError('Missing filter detail name element');
                      element.click();
                    }, 40);
                  }}
                >
                  {_l('重命名')}
                </MenuItem>
              )}
              <MenuItem
                icon={<Icon icon="copy" className="Font18" />}
                onClick={() => {
                  setMoreMenuActive(false);
                  onCopy(filter);
                }}
              >
                {_l('复制')}
              </MenuItem>
              {isCharge && (
                <MenuItem
                  icon={<Icon icon="group" className="Font18" />}
                  onClick={() => {
                    setMoreMenuActive(false);
                    onToggleFilterType(filter);
                  }}
                >
                  {filter.type === FILTER_TYPE.PUBLIC ? _l('设为个人筛选') : _l('设为公共筛选')}
                </MenuItem>
              )}
              {canEdit && (
                <Fragment>
                  <hr />
                  <MenuItem
                    className="red"
                    icon={<Icon icon="trash" className="Font18" />}
                    onClick={() => {
                      setMoreMenuActive(false);
                      onDelete(filter);
                    }}
                  >
                    {_l('删除')}
                  </MenuItem>
                </Fragment>
              )}
            </MenuCon>
          }
          onPopupVisibleChange={setMoreMenuActive}
        >
          <i className="icon icon-more_horiz Hand moreMenu hoverShow hoverColorPrimary"></i>
        </Trigger>
      </div>
    </FilterTitleItemCon>
  );
}

function filterHasError(filter: unknown, controls: FormControl[]): boolean {
  if (!filterRecord(filter)) throw new TypeError('Invalid saved filter group');
  const groups = filter['conditionsGroups'];
  if (groups) {
    if (!Array.isArray(groups)) throw new TypeError('Invalid saved filter condition groups');
    return _.some(groups.map(gf => filterHasError(gf, controls)));
  }
  const conditions = filter['conditions'] || [];
  if (!Array.isArray(conditions)) throw new TypeError('Invalid saved filter conditions');
  return !!conditions.filter(c => {
    if (!filterRecord(c)) throw new TypeError('Invalid saved filter condition');
    return !_.find(controls, { controlId: c['controlId'] });
  }).length;
}

export default function FilterTitleList(props: FilterTitleListProps) {
  const {
    isCharge,
    title,
    activeFilter = {},
    controls = [],
    filters = [],
    onSortEnd = () => {},
    onEditFilter = () => {},
    onCopy = () => {},
    onDelete = () => {},
    onToggleFilterType = () => {},
    triggerFilter = () => {},
    onHideFilterPopup = () => {},
  } = props;
  return (
    <Con>
      <div className="title">{title}</div>
      <SortableList
        useDragHandle
        items={filters}
        itemKey="id"
        helperClass="draggingItem"
        onSortEnd={newItems => {
          onSortEnd(newItems.map(filterId));
        }}
        renderItem={options => {
          const { item, index, dragging, isLayer } = options;
          const filter = item;
          return (
            <FilterTitleItem
              {...options}
              error={filterHasError(filter, controls)}
              active={activeFilter.id === filter.id}
              isCharge={isCharge}
              className={cx({ isDragging: dragging, draggingItem: isLayer }, 'filter_' + filter.id)}
              key={filter.id}
              index={index}
              filter={filter}
              onEditFilter={onEditFilter}
              onCopy={onCopy}
              onDelete={onDelete}
              onToggleFilterType={onToggleFilterType}
              triggerFilter={triggerFilter}
              onHideFilterPopup={onHideFilterPopup}
            />
          );
        }}
      />
    </Con>
  );
}
