import type { FormControl } from '../../../../../utils/controlTypes';
import type { FieldStoreRecord, RelateRecordBase, RelateTableState } from '../../../../../utils/subListStoreTypes';
import type { TreeExpansionAction } from '../../../common/TreeTableHelper/types';

export type RelationBaseAction = { type: 'UPDATE_BASE'; value: RelateRecordBase };
export type RelationLoadingAction = { type: 'UPDATE_LOADING'; value: boolean };
export type RelationTableAction =
  | {
      type: 'UPDATE_RECORDS' | 'APPEND_RECORDS';
      records: FieldStoreRecord[];
      saveSync?: boolean | undefined;
      recordId?: string | undefined;
      afterRecordId?: string | undefined;
    }
  | { type: 'DELETE_RECORDS'; recordIds: string[]; saveSync?: boolean | undefined }
  | { type: 'UPDATE_TABLE_STATE'; value: Partial<RelateTableState> }
  | { type: 'CANCEL_CHANGE'; count?: number | undefined; records?: FieldStoreRecord[] | undefined }
  | { type: 'RESET'; doNotClearKeywords?: boolean | undefined }
  | { type: 'DELETE_ALL' };
export type RelationChangesAction = RelationTableAction | { type: 'UPDATE_RECORD'; newRecord: FieldStoreRecord };
export type RelationRecordsAction =
  | {
      type: 'UPDATE_RECORDS' | 'APPEND_RECORDS' | 'APPEND_FAKE_RECORDS';
      records: FieldStoreRecord[];
      saveSync?: boolean | undefined;
      recordId?: string | undefined;
      afterRecordId?: string | undefined;
    }
  | { type: 'UPDATE_ROWS_WITH_CHANGES'; rowIds: string[]; changes: FieldStoreRecord }
  | { type: 'UPDATE_RECORD'; newRecord: FieldStoreRecord }
  | { type: 'UPDATE_RECORD_BY_RECORD_ID'; recordId: string; changes: FieldStoreRecord }
  | { type: 'DELETE_RECORDS'; recordIds: string[]; saveSync?: boolean | undefined }
  | { type: 'CLEAR_RECORDS' | 'DELETE_ALL' }
  | { type: 'CANCEL_CHANGE'; records?: FieldStoreRecord[] | undefined; count?: number | undefined };

export type RelateRecordAction =
  | RelationBaseAction
  | RelationLoadingAction
  | RelationTableAction
  | RelationRecordsAction
  | TreeExpansionAction
  | { type: 'UPDATE_INIT_STATE'; value: boolean }
  | { type: 'UPDATE_CONTROLS'; controls: FormControl[] }
  | { type: 'INIT_FIRST_PAGE_RESULT'; value: { records?: FieldStoreRecord[] | undefined; count?: number | undefined } }
  | {
      type: 'UPDATE_ROWS_SUMMARY';
      types?: Record<string, number> | undefined;
      values?: Record<string, unknown> | undefined;
    };
