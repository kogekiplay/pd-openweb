import { isRelateRecordTableControl } from 'src/utils/control.js';
import type { FormControl } from 'src/utils/controlTypes';
import { VIEWCONTROL_CONDITION_MULTI_TYPE, VIEWCONTROL_CONDITION_TYPE } from './config';

/**
 * 类型表里都是 number，而 FormControl.type 是可选的。
 * includes(undefined) 运行时本来就是 false，这里显式判一下 ——
 * 用 `as number` 把 undefined 蒙混过去的话，真正的空类型就查不出来了。
 */
const includesType = (types: number[], type?: number) => type !== undefined && types.includes(type);

export const canSetGroup = (control: FormControl = {}, worksheetId = '', view: { viewType?: number } = {}) => {
  if (view.viewType === 1) {
    //看板 不支持多选类型的字段作为分组字段
    const dataType = control?.type === 30 ? control?.sourceControlType : control?.type;
    const isMulti =
      includesType(VIEWCONTROL_CONDITION_MULTI_TYPE, dataType) &&
      ((includesType([26, 27, 48], dataType) && control?.enumDefault === 1) || //多选类型
        (dataType === 29 && control?.enumDefault === 2) || //关联多条
        dataType === 10); //多选字段

    if (isMulti) {
      return false;
    }
  }

  if (
    includesType(VIEWCONTROL_CONDITION_TYPE, control.type) ||
    (control.type === 30 && //支持他表字段 仅存储
      includesType(VIEWCONTROL_CONDITION_TYPE, control.sourceControlType) &&
      (control.strDefault || '').split('')[0] !== '1')
  ) {
    //表格形式不支持
    if (isRelateRecordTableControl(control)) return false;
    if (control.type === 29) {
      //关联他表 且 单条/多条
      if (worksheetId !== control.dataSource) {
        return true;
      }
    } else {
      return true;
    }
  }
  return undefined;
};
