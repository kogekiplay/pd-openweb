export { getSheetViewRows } from 'src/pages/worksheet/common/TreeTableHelper/index';

import { VIEW_DISPLAY_TYPE } from 'src/pages/worksheet/constants/enum';
export function isTreeTableView(view?: { viewType?: number | string | undefined; advancedSetting?: { hierarchyViewType?: string | undefined } | undefined } | null): boolean {
  return String(view?.viewType) === (VIEW_DISPLAY_TYPE as { structure: string }).structure && view?.advancedSetting?.hierarchyViewType === '3';
}
