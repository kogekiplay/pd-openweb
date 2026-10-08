import { FROM } from '../../../core/config';
import type { FormControl } from 'src/utils/controlTypes';
export const MOBILE_TABLE_SHOW_TYPES: readonly string[] = ['2', '5', '6'];
interface RecordLoadingProps { flag?: unknown; control?: (FormControl & { from?: number | undefined; hasDefaultValue?: boolean | undefined }) | undefined; }
export function shouldLoadInitialRecords({ control = {} }: RecordLoadingProps): boolean {
  const settings = control.advancedSetting || {};
  const publicForm = typeof window !== 'undefined' && Boolean(window.shareState?.isPublicForm);
  return (publicForm && MOBILE_TABLE_SHOW_TYPES.includes(settings['originShowType'] || '')) ||
    (MOBILE_TABLE_SHOW_TYPES.includes(settings.showtype || '') &&
      [FROM.H5_EDIT, FROM.RECORDINFO, FROM.DRAFT].includes(control.from ?? 0) && !control.hasDefaultValue);
}
export function shouldReloadInitialRecords(previous: RecordLoadingProps, next: RecordLoadingProps): boolean {
  return next.flag !== previous.flag && shouldLoadInitialRecords(next);
}
