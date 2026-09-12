import React from 'react';
import cx from 'classnames';
import _, { isEmpty } from 'lodash';
import { arrayOf, bool, number, shape, string } from 'prop-types';
import { toFixed } from 'src/utils/control';
import { controlIsNumber, formatNumberThousand } from 'src/utils/control';
import { getSummaryNameByType, getSummaryResult } from 'src/utils/record';

export default function SummaryContent({
  isChildTableSummaryCell,
  control,
  type,
  summaryType,
  summaryValue,
  rows = [],
  selectedIds,
  allWorksheetIsSelected,
  disabled,
  // 【必须接住并挂到根元素上】本组件是 SummaryCell 里 <Trigger> 的直接子元素。
  // rc-trigger 5 用 findDOMNode 拿子元素的 DOM 节点，子组件接不接 ref 都无所谓；
  // 继任的 @rc-component/trigger 不再用 findDOMNode，改为把 ref 挂到子元素上取节点。
  // 接不住的话 targetEle 一直是 null，useAlign 算出的坐标完全失真 ——
  // 实测弹层被放到 (-6260, -7880)，即【渲染在屏幕外】。
  // 这个失败是【静默】的：DOM 里弹层在、内容也对（「选择统计方式 / 不显示 / 已填写…」）、
  // 控制台一条报错都没有，用户看到的就是「点了没反应」。
  // React 19 允许函数组件把 ref 当普通 prop 接收，所以不需要 forwardRef。
  // 必须给默认值：解构模式里没有默认值的属性会被 TS 推成【必填】，
  // 不写的话所有不传 ref 的调用点都报 TS2741「Property 'ref' is missing」。
  ref = undefined,
}) {
  const isPercent = _.get(control, 'advancedSetting.numshow') === '1';
  let summaryName;
  let summaryDataValue = summaryValue;

  if (summaryType) {
    summaryName = getSummaryNameByType(summaryType);
    if (rows.length && ((selectedIds.length && !allWorksheetIsSelected) || isChildTableSummaryCell)) {
      if (isChildTableSummaryCell && isEmpty(selectedIds)) {
        selectedIds = rows.map(row => row.rowid);
      }

      summaryDataValue = getSummaryResult(
        rows.filter(row => _.includes(selectedIds, row.rowid)),
        control,
        summaryType,
      );
    }

    if (!_.isUndefined(summaryDataValue)) {
      if (_.includes([3, 4, 5, 6], summaryType)) {
        summaryDataValue = toFixed(summaryDataValue * (isPercent ? 100 : 1), control.dot);
        summaryDataValue = formatNumberThousand(summaryDataValue);
        if (isPercent) {
          summaryDataValue = summaryDataValue + '%';
        }
      }
    }
  }

  const isNumber = controlIsNumber(control);
  return (
    <div
      ref={ref}
      className={cx('flexRow', {
        hide: type === 25,
        empty: !summaryType,
      })}
    >
      <span className="summaryName">{summaryName}：</span>
      {isNumber && <div className="flex"></div>}
      <div className="summaryValue" title={summaryDataValue}>
        {typeof summaryDataValue === 'undefined' || summaryType === 0 ? '-' : summaryDataValue}
      </div>
      {!isNumber && <div className="flex"></div>}
      {!disabled && <i className="iconArrow icon icon-arrow-down-border"></i>}
    </div>
  );
}

SummaryContent.propTypes = {
  control: shape({}),
  type: number,
  summaryType: number,
  summaryValue: string,
  rows: arrayOf(shape({})),
  selectedIds: arrayOf(string),
  allWorksheetIsSelected: bool,
  disabled: bool,
};
