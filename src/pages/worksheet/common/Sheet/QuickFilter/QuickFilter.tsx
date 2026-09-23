import { useEffect, useRef, useState } from 'react';
import _ from 'lodash';
import { arrayOf, bool, func, number, shape, string } from 'prop-types';
import styled from 'styled-components';
import autoSize from 'ming-ui/components/AutoSize';
import { FASTFILTER_CONDITION_TYPE } from 'worksheet/common/ViewConfig/components/fastFilter/util';
import Conditions from './Conditions';
import type { FormControl } from 'src/utils/controlTypes';

const Con = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  .conditionItem .content {
    &:hover {
      .timeZoneTag {
        display: none;
      }
    }
  }
`;

const Empty = styled.div`
  width: 100%;
  text-align: center;
  padding: var(--space-3) 0 var(--space-5);
  color: var(--color-text-disabled);
`;

function isFullLine(filter) {
  return String((filter.advancedSetting || {}).direction) === '1';
}

function QuickFilter(props) {
  const {
    mode,
    isDark,
    showTextAdvanced,
    defaultTriggerUpdate = false,
    base = {},
    from,
    noExpand,
    activeFilterId,
    emptyText,
    appId,
    width,
    view,
    projectId,
    viewRowsLoading,
    controls = [],
    filters = [],
    navGroupFilters = [],
    refreshSheet = () => {},
    updateQuickFilter = () => {},
    resetQuickFilter = () => {},
    fireWhenViewLoaded = () => {},
    onFilterClick = () => {},
  }: { controls: FormControl[]; [key: string]: any } = props;
  const { worksheetId } = base;
  const isConfigMode = mode === 'config';
  const filtersLength = useRef(filters.length);
  const needClickSearch = useRef(_.get(view, 'advancedSetting.clicksearch'));
  let colNum = 2;

  if (width > 1220) {
    colNum = 4;
  } else if (width > 1000) {
    colNum = 3;
  } else if (width > 500) {
    colNum = 2;
  } else {
    colNum = 1;
  }

  const showQueryBtn = _.get(view, 'advancedSetting.enablebtn') === '1' || props.enablebtn === '1';
  const fullLineCount = filters.filter(isFullLine).length;
  const showExpand =
    !noExpand && (filters.length > (showQueryBtn ? colNum - 1 : colNum) || (filters.length > 1 && fullLineCount > 0));
  const [fullShow, setFullShow] = useState(showExpand && localStorage.getItem('QUICK_FILTER_FULL_SHOW') === 'true');
  const _fullShow = fullShow || noExpand;
  let visibleFilters = _fullShow ? filters : filters.slice(0, showQueryBtn ? colNum - 1 : colNum);
  let firstIsFullLine = false;

  if (!_fullShow) {
    const firstFullLineIndex = _.findIndex(visibleFilters, isFullLine);

    if (firstFullLineIndex === 0) {
      visibleFilters = visibleFilters.slice(0, 1);
      firstIsFullLine = true;
    } else if (firstFullLineIndex > -1) {
      visibleFilters = visibleFilters.slice(0, firstFullLineIndex);
    }
  }

  let operateIsNewLine = false;

  /* 【visibleFilters 为空时必须跳过，保持 false】
     原先这段包在 try/catch 里、没有这个判断：为空时 _.last([]) 是 undefined，
     isFullLine(undefined) 去读 .advancedSetting 当场抛 TypeError，被 catch 吞掉后 console.log 出来
     —— 每次渲染都往控制台打一条。那个 try/catch 存在的唯一理由就是这里，所以一并拿掉了：
     同一个 isFullLine 在上面对 filters 逐项调用、外面从来没有 try/catch，说明元素不会是空值。
     什么时候会空：showQueryBtn 且 colNum 为 1 时 slice(0, 0)，窄布局下筛选项全收进「展开」，
     首行只剩操作按钮。
     注意不能简单把 isFullLine 改成对 undefined 安全：那样顺着算下去 0 % colNum === 0 会得 true，
     而原先靠异常得到的是 false（按钮留在首行，也就是用户一直看到的样子）。 */
  if (visibleFilters.length) {
    const lastIsFullLine = isFullLine(_.last(visibleFilters));

    if (lastIsFullLine) {
      operateIsNewLine = true;
    } else if (fullLineCount === 0) {
      operateIsNewLine = _.sum(visibleFilters.map(f => (isFullLine(f) ? colNum : 1))) % colNum === 0;
    } else {
      const lastFullLineIndex = _.findLastIndex(visibleFilters, isFullLine);
      operateIsNewLine =
        _.sum(visibleFilters.slice(lastFullLineIndex + 1).map(f => (isFullLine(f) ? colNum : 1))) % colNum === 0;
    }
  }

  useEffect(() => {
    filtersLength.current = 0;
    needClickSearch.current = undefined;
  }, [view && view.viewId]);
  useEffect(() => {
    if (filtersLength.current > 0 && filters.length > filtersLength.current && !_fullShow) {
      setFullShow(true);
    }

    filtersLength.current = filters.length;
  }, [filters.length]);
  useEffect(() => {
    if (needClickSearch.current === '1' && _.get(view, 'advancedSetting.clicksearch') === '0') {
      // clicksearch=1 时默认值只回填到 quickFilterWithDefault，未写入 quickFilter；取消勾选后需先把默认条件写回 quickFilter 再刷新，否则刷新会用空条件查询导致默认条件不生效。
      fireWhenViewLoaded(view, { forceUpdate: true });
      refreshSheet(view);
    }

    needClickSearch.current = _.get(view, 'advancedSetting.clicksearch');
  }, [_.get(view, 'advancedSetting.clicksearch')]);
  if (!filters.length) {
    return (
      <Con isConfigMode={isConfigMode} className="quickFilterWrap">
        <Empty>{emptyText || _l('暂未添加快速筛选')}</Empty>
      </Con>
    );
  }

  return (
    <Con isConfigMode={isConfigMode} className="quickFilterWrap">
      <Conditions
        viewRowsLoading={viewRowsLoading}
        from={from}
        defaultTriggerUpdate={defaultTriggerUpdate}
        showTextAdvanced={showTextAdvanced}
        isDark={isDark}
        worksheetId={worksheetId}
        isFilterComp={from === 'filterComp'}
        isConfigMode={isConfigMode}
        activeFilterId={activeFilterId}
        projectId={projectId}
        appId={appId}
        operateIsNewLine={operateIsNewLine}
        firstIsFullLine={firstIsFullLine}
        view={view}
        controls={controls.filter((c: FormControl) => {
          let tempType = c.type;

          if (c.type === 30) {
            tempType = c.sourceControlType;
          } else if (c.type === 53) {
            tempType = c.enumDefault2;
          }

          return _.includes(FASTFILTER_CONDITION_TYPE, tempType);
        })}
        hideStartIndex={visibleFilters.length}
        filters={filters}
        navGroupFilters={navGroupFilters}
        colNum={colNum}
        fullShow={isConfigMode || _fullShow}
        showExpand={showExpand}
        setFullShow={setFullShow}
        updateQuickFilter={updateQuickFilter}
        resetQuickFilter={resetQuickFilter}
        onFilterClick={onFilterClick}
      />
    </Con>
  );
}

QuickFilter.propTypes = {
  from: string,
  noExpand: bool,
  mode: string,
  activeFilterId: string,
  emptyText: string,
  width: number,
  projectId: string,
  filters: arrayOf(shape({})),
  view: shape({}),
  controls: arrayOf(shape({})),
  updateQuickFilter: func,
  resetQuickFilter: func,
};

export default autoSize(QuickFilter, { onlyWidth: true });
