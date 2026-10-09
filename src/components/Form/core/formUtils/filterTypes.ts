import type { FormControl } from 'src/utils/controlTypes';
import type { FormComparisonCondition } from './types';

/** Some legacy HASVALUE branches return the area code itself; preserve that scalar result. */
export type FilterEvaluation = boolean | string | number | undefined;
export interface FilterFnOptions {
  filterData: FormComparisonCondition;
  originControl: FormControl;
  data?: FormControl[] | undefined;
  recordId?: string | undefined;
  appTimeZone?: number | undefined;
}
export interface FilterEntity {
  id?: string | undefined;
  sid?: string | undefined;
  accountId?: string | undefined;
  departmentId?: string | undefined;
  organizeId?: string | undefined;
  code?: string | number | undefined;
}
