import type { formatSearchConfigs } from 'src/pages/widgetConfig/util';
import type {
  AppPkgData,
  QuickFilterDisplayCondition,
  WorksheetBase,
  WorksheetFilterCondition,
  WorksheetFilters,
  WorksheetInfo,
  WorksheetNavGroupCondition,
  WorksheetNavGroupCount,
  WorksheetView,
} from 'src/pages/worksheet/types';
import type { FormControl, WorksheetCustomBtn } from 'src/utils/controlTypes';

export type SheetSearchConfig = ReturnType<typeof formatSearchConfigs>;

/** 公共工作表切片的真实写入协议；重置操作不需要携带对应切片的载荷。 */
export type WorksheetAction =
  | { type: 'WORKSHEET_INIT'; value: WorksheetInfo }
  | {
      type:
        'WORKSHEET_INIT_FAIL' | 'WORKSHEET_FETCH_START' | 'WORKSHEET_CLEAR_FILTERS' | 'WORKSHEET_RESET_QUICK_FILTER';
    }
  | { type: 'WORKSHEET_UPDATE_LOADING' | 'WORKSHEET_UPDATE_OPERATE_BUTTON_LOADING'; loading: boolean }
  | { type: 'WORKSHEET_UPDATE_WORKSHEETINFO'; info: Partial<WorksheetInfo> }
  | { type: 'WORKSHEET_UPDATE_IS_REQUESTING_RELATION_CONTROLS'; value: boolean }
  | { type: 'WORKSHEET_UPDATE_CONTROLS' | 'WORKSHEET_UPDATE_SOME_CONTROLS'; controls: FormControl[] }
  | { type: 'WORKSHEET_UPDATE_CONTROL'; control: FormControl }
  | { type: 'WORKSHEET_PERMISSION_INIT'; value: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] }
  | { type: 'WORKSHEET_SEARCH_CONFIG_INIT'; value: SheetSearchConfig }
  | { type: 'WORKSHEET_UPDATE_VIEWS'; views?: WorksheetView[] | undefined }
  | { type: 'WORKSHEET_UPDATE_VIEW'; view: WorksheetView }
  | { type: 'WORKSHEET_ADD_MANAGE_VIEW'; views: WorksheetView[] }
  | { type: 'WORKSHEET_UPDATE_BUTTONS' | 'WORKSHEET_UPDATE_SHEETBUTTONS'; buttons: WorksheetCustomBtn[] }
  | { type: 'WORKSHEET_UPDATE_PRINT_LIST'; printList: HapApi.MD.Entity.Worksheet.PrintListModel[] }
  | { type: 'WORKSHEET_UPDATE_FILTERS'; filters: Partial<WorksheetFilters> }
  | { type: 'WORKSHEET_UPDATE_QUICK_FILTER'; filter: WorksheetFilterCondition[] }
  | { type: 'WORKSHEET_UPDATE_QUICK_FILTER_WITH_DEFAULT'; filter: QuickFilterDisplayCondition[] }
  | { type: 'WORKSHEET_UPDATE_GROUP_FILTER'; navGroupFilters?: WorksheetNavGroupCondition[] | undefined }
  | { type: 'WORKSHEET_NAVGROUP_COUNT'; data?: WorksheetNavGroupCount[] | null | undefined }
  | { type: 'WORKSHEET_UPDATE_BASE'; base: Partial<WorksheetBase> }
  | { type: 'WORKSHEET_UPDATE_IS_CHARGE'; isCharge: boolean }
  | { type: 'WORKSHEET_UPDATE_APPPKGDATA'; appPkgData: AppPkgData };

export type WorksheetActionOf<Type extends WorksheetAction['type']> = WorksheetAction & { type: Type };
