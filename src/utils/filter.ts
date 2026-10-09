import _, { get } from 'lodash';
import { VIEW_DISPLAY_TYPE } from 'worksheet/constants/enum';
import type { WorksheetFilterCondition, WorksheetView } from 'src/pages/worksheet/types';

export function formatQuickFilter(items: WorksheetFilterCondition[] = []): WorksheetFilterCondition[] {
  return items.map(item =>
    _.pick(item, [
      'advancedSetting',
      'controlId',
      'dataType',
      'spliceType',
      'filterType',
      'dateRange',
      'dateRangeType',
      'value',
      'values',
      'minValue',
      'maxValue',
    ]),
  );
}

export function needHideViewFilters(
  view: Pick<WorksheetView, 'advancedSetting'> & {
    viewType?: number | string | undefined;
    childType?: number | string | undefined;
  },
): boolean {
  return (
    (String(view.viewType) === VIEW_DISPLAY_TYPE.structure &&
      !_.includes([0, 1], Number(view.childType)) &&
      get(view, 'advancedSetting.hierarchyViewType') === '3') ||
    String(view.viewType) === VIEW_DISPLAY_TYPE.gunter
  );
}
