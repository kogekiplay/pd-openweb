import type { FormControl } from '../../../utils/controlTypes';

/** GetQueryBySheetId queries after formatSearchConfigs attaches their typed templates. */
export type FormQueryConfig = Omit<
  Partial<HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetQueryDto>,
  'queryCount'
> & {
  /** The editor initially stores the count input as a string; the API returns a number. */
  queryCount?: string | number | undefined;
  templates?: Array<{ controls?: FormControl[] | undefined }> | undefined;
};
