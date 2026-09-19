import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { get } from 'lodash';
import styled from 'styled-components';
import Pagination from 'worksheet/components/Pagination';
import { changePageIndex, changePageSize } from 'worksheet/redux/actions/sheetview';
import type { RootState } from 'src/redux/types';
import { getGroupControlId } from 'src/utils/worksheet';

/**
 * 表格视图的底部分页条。
 *
 * 【为什么单独做一个组件而不是在 Sheet.tsx 里直接渲染】
 * 分页要的四个值（pageIndex / pageSize / count / pageCountAbnormal）都在
 * state.sheet.sheetview 里，而 Sheet.tsx 的 basePara 不含它们。
 * 让这个组件自己连 redux，就不用为了一个页脚把四个值沿着组件树传下去。
 *
 * 【为什么不改 Pagination 本身】它被 8 处复用（子表、关联记录、选择记录弹层、
 * 聚合表预览、回收站…），改它会波及那些地方。这里只是换个位置渲染它。
 */
const Con = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 44px;
  padding: 0 12px;
  box-sizing: border-box;
  border-top: 1px solid var(--color-border-secondary);
  background: var(--color-background-card);
  /* Pagination 自带右外边距（它原来待在顶栏右端），在这儿会顶出一段空白 */
  .pagination {
    margin-right: 0;
  }
`;

function SheetFooter(props) {
  const { view, base, sheetViewData, sheetFetchParams, changePageSize, changePageIndex } = props;
  const { count, pageCountAbnormal } = sheetViewData;
  const { pageIndex, pageSize } = sheetFetchParams;

  // 只有表格视图（viewType 0）有分页；其余视图类型各有自己的加载方式。
  if (Number(get(view, 'viewType')) !== 0) {
    return null;
  }

  return (
    <Con className="sheetFooter">
      <Pagination
        disabled={!!get(base, 'forcePageSize')}
        abnormalMode={pageCountAbnormal}
        onlyShowCount={getGroupControlId(view)}
        className="pagination"
        pageIndex={pageIndex}
        pageSize={pageSize}
        allCount={count}
        changePageSize={changePageSize}
        changePageIndex={changePageIndex}
        onPrev={() => changePageIndex(pageIndex - 1)}
        onNext={() => changePageIndex(pageIndex + 1)}
      />
    </Con>
  );
}

export default connect(
  (state: RootState) => ({
    base: state.sheet.base,
    sheetViewData: state.sheet.sheetview.sheetViewData,
    sheetFetchParams: state.sheet.sheetview.sheetFetchParams,
  }),
  dispatch => bindActionCreators({ changePageSize, changePageIndex }, dispatch),
)(SheetFooter);
