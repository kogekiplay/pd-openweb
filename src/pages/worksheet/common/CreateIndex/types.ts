import type { WorksheetIndexConfig, WorksheetIndexField } from 'src/api/worksheet';

type ApiAvailableField = HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetAvailableFieldModel;
/** The selector appends the local users pseudo-field with controlType 0. */
export type IndexAvailableField = Omit<ApiAvailableField, 'controlType'> & {
  controlType: ApiAvailableField['controlType'] | 0;
};

/** Starts as [{}]; create uses string "1", while the rule selector writes number 1. */
export interface SelectedIndexField extends Partial<WorksheetIndexField> {
  name?: string | undefined;
  type?: IndexAvailableField['type'] | '' | undefined;
  selectFiledsList?: IndexAvailableField[] | undefined;
}

export interface CreateIndexProps {
  isEdit: boolean;
  currentIndexInfo: Partial<WorksheetIndexConfig>;
  selectedIndexList: SelectedIndexField[];
  worksheetAvailableFields: IndexAvailableField[];
  appId?: string | undefined;
  worksheetId?: string | undefined;
  worksheetRowIndexLimit: number;
  getIndexesInfo: () => void;
  indexList: WorksheetIndexConfig[];
  onClose: () => void;
  getFieldObjById: (id: string | undefined) => Partial<IndexAvailableField>;
}

export interface CreateIndexState {
  selectedIndexList: SelectedIndexField[];
  selectIndexFileds: IndexAvailableField[];
  uniqueIndex: boolean;
  wildcardIndex: boolean;
  customeIndexName: string | undefined;
  showQAList: number[];
  saveLoading?: boolean | undefined;
}
