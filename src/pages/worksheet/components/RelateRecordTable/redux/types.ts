import type { RelateRecordState } from 'src/utils/subListStoreTypes';

export type {
  RelateRecordState as RelateRecordTableState,
  RelateRecordDispatch as RelateRecordTableDispatch,
} from 'src/utils/subListStoreTypes';
export type RelateRecordTableGetState = () => RelateRecordState;
