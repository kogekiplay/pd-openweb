import _ from 'lodash';
import publicWorksheetAjax from 'src/api/publicWorksheet';
import sheetAjax from 'src/api/worksheet';
import { getFilter } from 'src/pages/worksheet/common/WorkSheetFilter/util';
import type { FormControl } from 'src/utils/controlTypes';
import type { FreeFieldRelationParams } from './bridgeTypes';

export function getRowsRelation(
  {
    control,
    recordId,
    formData = [],
    parentAppId,
  }: {
    control: FormControl;
    recordId?: string | undefined;
    formData?: FormControl[] | undefined;
    parentAppId?: string | undefined;
    parentWorksheetId?: string | undefined;
  },
  params: FreeFieldRelationParams = {},
): Promise<unknown> {
  const { pageIndex = 1, pageSize = 50, keyWords } = params;
  const relatedControl = { ...control, recordId };
  const filterControls = getFilter({ control: relatedControl, formData, appId: parentAppId });
  let getFilterRowsPromise;
  let args: Record<string, unknown>;
  args = {
    worksheetId: control.dataSource,
    viewId: control.viewId,
    searchType: 1,
    pageSize,
    pageIndex,
    status: 1,
    keyWords: _.trim(keyWords),
    isGetWorksheet: true,
    getType: 7,
    filterControls: filterControls || [],
  };
  // if (parentWorksheetId && _.get(parentWorksheetId, 'length') === 24) {
  //   args.relationWorksheetId = parentWorksheetId;
  //   args.rowId = recordId;
  //   args.controlId = control.controlId;
  // }
  if (!window.isPublicWorksheet) {
    getFilterRowsPromise = sheetAjax.getFilterRows;
  } else {
    getFilterRowsPromise = publicWorksheetAjax.getRelationRows;
    args['shareId'] = window.publicWorksheetShareId;
  }

  return getFilterRowsPromise(args);
}
