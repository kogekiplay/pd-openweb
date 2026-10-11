import type { ReactNode } from 'react';

/** OnlySync consumes this configuration subset; child-only source metadata is opaque. */
export interface SyncConnector {
  id: string;
  type: string;
  sourceName?: string | undefined;
  className?: string | undefined;
  iconBgColor?: string | undefined;
  hasSchema?: boolean | undefined;
  formData?: unknown;
  [metadata: string]: unknown;
}
export interface SourceTableTab {
  db?: string | undefined;
  table?: string | undefined;
  tableName?: string | undefined;
  schema?: string | undefined;
}
export interface SyncFieldSetting {
  remark?: string | null | undefined;
  strDefault?: string | undefined;
  sourceControlType?: number | undefined;
  enumDefault?: number | undefined;
  [metadata: string]: unknown;
}
export interface SyncField {
  id?: string | null | undefined;
  name: string;
  alias?: string | undefined;
  oid?: string | null | undefined;
  fid?: string | null | undefined;
  mdType?: number | null | undefined;
  jdbcTypeId?: number | null | undefined;
  dataType?: string | null | undefined;
  precision?: number | null | undefined;
  scale?: number | null | undefined;
  orderNo?: number | null | undefined;
  status?: string | undefined;
  isPk?: boolean | undefined;
  isCheck?: boolean | undefined;
  isFakePk?: boolean | undefined;
  isUniquePk?: boolean | undefined;
  isNotNull?: boolean | undefined;
  isCanBePk?: boolean | undefined;
  isTitle?: boolean | null | undefined;
  disabled?: boolean | undefined;
  comment?: string | null | undefined;
  controlSetting?: SyncFieldSetting | null | undefined;
  [metadata: string]: unknown;
}
export interface SyncMapping {
  sourceField: SyncField;
  destField: SyncField;
  [metadata: string]: unknown;
}
export interface MatchedFieldType {
  typeName: string;
  mdType?: number | null | undefined;
  dataType?: number | null | undefined;
  maxLength?: number | null | undefined;
  defaultScale?: number | null | undefined;
  [metadata: string]: unknown;
}
export type MatchedTypes = Record<string, MatchedFieldType[] | undefined>;
export interface SyncWorksheetControl {
  controlId?: string | undefined;
  controlName?: string | undefined;
  alias?: string | undefined;
  type?: number | undefined;
  advancedSetting?: { usertype?: string | undefined; [metadata: string]: unknown } | undefined;
  enumDefault?: number | undefined;
  dot?: number | undefined;
  required?: boolean | undefined;
  strDefault?: string | undefined;
  sourceControlType?: number | undefined;
  remark?: string | null | undefined;
  [metadata: string]: unknown;
}
export interface SyncTableMeta {
  tableName?: string | undefined;
  schema?: string | undefined;
}
export interface SyncSheetData extends SyncTableMeta {
  dbName?: string | null | undefined;
  schemaName?: string | null | undefined;
  sheetName?: string | null | undefined;
  sheetNameValue?: string | null | undefined;
  sheetCreateType?: string | undefined;
  appSectionId?: string | null | undefined;
  writeMode?: string | undefined;
  writeNode?: unknown;
  fieldForIdentifyDuplicate?: string | null | undefined;
  isCleanDestTableData?: boolean | undefined;
  insertTrigger?: boolean | undefined;
  updateTrigger?: boolean | undefined;
  deleteTrigger?: boolean | undefined;
  scheduleConfig?: Record<string, unknown> | undefined;
}
export interface SyncFieldData extends SyncTableMeta {
  fields?: SyncField[] | undefined;
  workSheetId?: string | undefined;
}
export interface SyncMappingData extends SyncTableMeta {
  fieldsMapping?: SyncMapping[] | null | undefined;
}
export interface SyncMatchedData extends SyncTableMeta {
  matchedTypes?: MatchedTypes | undefined;
}
export interface SyncOption {
  label: ReactNode;
  value: string;
  workSheetName?: string | undefined;
  disabled?: boolean;
  [metadata: string]: unknown;
}
export interface SyncTableOptions extends SyncTableMeta {
  schemaOptionList?: SyncOption[] | null | undefined;
  sheetOptionList?: SyncOption[] | null | undefined;
}
export type SyncTables<T> = Record<string, Record<string, T | undefined> | undefined>;
/** The existing object mixes top-level database options and per-source-table caches. */
export interface SyncOptionsState {
  dbOptionList: SyncOption[];
  sheetOptionList: SyncOption[];
  [key: string]: SyncOption[] | Record<string, SyncTableOptions | undefined> | undefined;
}
export interface MappingDefaults {
  initMapping: SyncMapping[];
  sourceFields?: SyncField[] | undefined;
  isCreate?: boolean | undefined;
  noFetchSet?: boolean | undefined;
  isSetDefaultFields?: boolean | undefined;
  destFields?: SyncField[] | undefined;
}
export interface OnlySyncStepProps {
  source: SyncConnector;
  dest: SyncConnector;
  currentProjectId: string;
  onClose(): void;
  setSubmitData?: ((data: SyncTask[]) => void) | undefined;
  setNextOrSaveDisabled?: ((disabled: boolean) => void) | undefined;
  submitData?: SyncTask[] | undefined;
  [forwarded: string]: unknown;
}
export interface SyncTask {
  projectId: string;
  owner: string;
  sourceNode: {
    nodeId: string;
    name: string;
    nodeType: string;
    description: string;
    fields: Partial<SyncField>[];
    config: {
      datasourceId: string;
      dbName: string | undefined;
      tableName: string | undefined;
      schema: string | undefined;
      dsType: string;
      className: string | undefined;
      iconBgColor: string | undefined;
      appId: string | undefined;
      workSheetId: string | undefined;
      fields: Partial<SyncField>[];
    };
  };
  destNode: {
    nodeId: string;
    name: string;
    nodeType: string;
    description: string;
    fields: Partial<SyncField>[];
    config: {
      dataDestId: string;
      dbName: string | null | undefined;
      tableName: string | undefined;
      schema: string | null | undefined;
      createTable: boolean;
      dsType: string;
      className: string | undefined;
      iconBgColor: string | undefined;
      appId: string | undefined;
      workSheetId: string | null | undefined;
      fieldsMapping: Array<{ sourceField: Partial<SyncField>; destField: Partial<SyncField> | null }>;
      appSectionId: string | null | undefined;
      writeMode?: string | undefined;
      fieldForIdentifyDuplicate?: SyncField | undefined;
      isCleanDestTableData?: boolean | undefined;
    };
  };
  workflowConfig: { insertTrigger: boolean; updateTrigger: boolean; deleteTrigger: boolean } | undefined;
  scheduleConfig: Record<string, unknown> | undefined;
  tableList: SyncOption[];
  destPkCount: number;
}
