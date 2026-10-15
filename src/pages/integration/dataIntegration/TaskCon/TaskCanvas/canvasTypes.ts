import type { MatchedTypes, SyncField, SyncMapping } from '../../connector/components/OnlySyncStep/connectorTypes';

export interface CanvasNodeConfig extends Record<string, unknown> {
  leftTableId?: string | undefined;
  rightTableId?: string | undefined;
  dsType?: string | undefined;
  workSheetId?: string | undefined;
  tableName?: string | undefined;
  dbName?: string | undefined;
  schema?: string | undefined;
  datasourceId?: string | undefined;
  dataSourceId?: string | undefined;
  dataDestId?: string | undefined;
  iconBgColor?: string | undefined;
  className?: string | undefined;
  joinType?: string | undefined;
  unionType?: string | undefined;
}
export interface CanvasNode extends Record<string, unknown> {
  nodeId: string;
  nodeType: string;
  name?: string | undefined;
  nextIds?: string[] | undefined;
  prevIds?: Array<string | undefined> | undefined;
  x?: number | undefined;
  y?: number | undefined;
  nodeConfig?:
    | {
        fields?: SyncField[] | undefined;
        config?: CanvasNodeConfig | undefined;
        [metadata: string]: unknown;
      }
    | undefined;
}
export interface CanvasLine {
  fromDt: CanvasNode;
  toDt: CanvasNode | Record<string, never>;
}
export interface UnionField {
  leftField?: SyncField | undefined;
  rightField?: SyncField | undefined;
  resultField: SyncField;
}
export interface CanvasMappingDefaults {
  initMapping: SyncMapping[];
  sourceFields?: SyncField[] | undefined;
  isCreate?: boolean | undefined;
  matchedTypes?: MatchedTypes | undefined;
  isSetDefaultFields?: boolean | undefined;
  destFields?: SyncField[] | undefined;
  dataDestType?: string | undefined;
  isSourceAppType?: boolean | undefined;
  isDestAppType?: boolean | undefined;
}
export interface CanvasFieldRequest {
  node: CanvasNode;
  projectId?: string | undefined;
  isGetDest?: boolean | undefined;
  isSourceAppType?: boolean | undefined;
  isDestAppType?: boolean | undefined;
  withRowId?: boolean | undefined;
  withSys?: boolean | undefined;
  destType?: string | undefined;
}
