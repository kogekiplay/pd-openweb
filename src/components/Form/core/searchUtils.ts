import _ from 'lodash';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_CONTROL, WORKFLOW_SYSTEM_CONTROL } from 'src/pages/widgetConfig/config/widget';
import { transferValue } from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util';
import { getDatePickerConfigs, isEmptyValue } from 'src/utils/controlCommon';
import type { FormControl } from 'src/utils/controlTypes';
import { getDynamicValue } from './formUtils';
import { getAttachmentData } from './formUtils/helper';
import {
  dateValue,
  defaultSources,
  parsedArray,
  parsedRecord,
  parsedRecords,
  parsedStrings,
  parseValue,
  stringValue,
  valueRecord,
} from './formUtils/valueBoundary';
import { decodeApiResponseMap } from './searchTypes';
import type { ApiKeywords, ApiRequestMapping, ApiUpdateProps } from './searchTypes';

function isStoreReader(value: unknown): value is { getState: () => unknown } {
  return typeof valueRecord(value)?.['getState'] === 'function';
}

const getRelateValue = (control: FormControl = {}, controlState: Record<string, unknown>, recordId?: string) => {
  if (!_.isEmpty(controlState)) {
    const records = parsedRecords(controlState['records'] || []);

    if (recordId) {
      return records.concat(parsedRecords(valueRecord(controlState['changes'])?.['addedRecords'] || []));
    }

    return records;
  }

  const value = parsedRecords(control.value || '[]');
  if (_.isEmpty(value)) return [];
  return value.map(i => {
    return { ...i, ...parsedRecord(i['sourcevalue']) };
  });
};

const getValue = (control: FormControl = {}, type?: number) => {
  if (!control.value) return '';
  const value: unknown = control.value;
  const effectiveType = control.type === 30 ? control.sourceControlType : control.type;

  switch (effectiveType) {
    case 2:
      if (type === 10000007) {
        return (stringValue(value) || '').replace(/，/g, ',').split(',');
      }

      return value;
    // 单选、多选
    case 9:
    case 10:
    case 11:
      const ids = parsedStrings(value || '[]');
      if (!ids.length) return '';
      const noDelControls = (control.options || []).filter(item => _.includes(ids, item.key) && !item.isDeleted);

      if (type === 6) {
        return noDelControls
          .map(i => i.score)
          .reduce<number | string>((total, cur) => {
            const score: unknown = cur;
            if (score !== null && score !== undefined && !['string', 'number', 'boolean'].includes(typeof score))
              return NaN;
            if (typeof total === 'string' || typeof score === 'string') return `${total}${score}`;
            return total + Number(score);
          }, 0);
      }

      if (type === 10000007) {
        return noDelControls.map(i => i.value);
      }

      return noDelControls.map(i => i.value).join('、');
    case 14:
      const attachmentData = getAttachmentData(control);
      return attachmentData.map(att => {
        const fileId = _.get(att, 'fileID');
        return /\w{8}(-\w{4}){3}-\w{12}/.test(fileId || '') ? fileId : JSON.stringify(att);
      });
    case 15:
    case 16:
      const { formatMode } = getDatePickerConfigs(control);
      return control.value ? moment(dateValue(value)).format(formatMode) : '';
    // 成员
    case 26:
      if (type === 2) {
        return parsedRecords(value || '[]')
          .map(i => (i['accountId'] === md.global.Account.accountId ? md.global.Account.fullname : i['fullname']))
          .join('、');
      }

      return parsedRecords(value || '[]').map(i => i['accountId']);
    // 部门
    case 27:
      if (type === 2) {
        return parsedRecords(value || '[]')
          .map(i => i['departmentName'])
          .join('、');
      }

      return parsedRecords(value || '[]').map(i => i['departmentId']);
    //地区
    case 19:
    case 23:
    case 24:
      return parsedRecord(value)['name'];
    //关联记录
    case 29:
      const names = parsedRecords(value || '[]').map(i => i['name']);
      return type === 2 ? names.join('') : names;
    case 48:
      return parsedRecords(value || '[]')
        .map(i => i['organizeName'])
        .join('、');
    default:
      return value;
  }
};

const getApiDynamicValue = (item: ApiRequestMapping, formData: FormControl[], keywords: ApiKeywords, recordId = '') => {
  const tempValues = defaultSources(item.defsource || '[]').map(source => {
    // 动态值
    if (source.cid) {
      if (source.cid === 'search-keyword') return keywords;
      if (source.cid === 'rowid') return recordId;

      if (source.cid === 'ocr-file-url' && item.type === 2) {
        return keywords ? `${_.get(keywords, 'url')}` : '';
      }

      if (source.cid === 'ocr-file' && item.type === 14) {
        const fileId = typeof keywords === 'string' ? undefined : keywords.fileId;
        return keywords ? (/\w{8}(-\w{4}){3}-\w{12}/.test(fileId || '') ? [fileId] : [JSON.stringify(keywords)]) : '';
      }

      const control = _.find(formData, i => i.controlId === source.cid);
      return getValue(control, item.type);
    }

    // 静态值
    if (source.staticValue) {
      // 文本 | 数值
      if (_.includes([2, 6, 9, 36], item.type)) {
        return source.staticValue;
      }

      // 日期时间
      if (item.type === 16) {
        const { formatMode } = getDatePickerConfigs(item);
        if (!source.staticValue) return '';
        return source.staticValue === '2' ? moment().format(formatMode) : moment(source.staticValue).format(formatMode);
      }

      // 人员
      if (item.type === 26) {
        return _.includes(['user-self'], parsedRecord(source.staticValue)['accountId'])
          ? md.global.Account.accountId
          : parsedRecord(source.staticValue)['accountId'];
      }

      // 部门
      if (item.type === 27) {
        return parsedRecord(source.staticValue)['departmentId'];
      }

      // 组织角色
      if (item.type === 48) {
        return parsedRecord(source.staticValue)['organizeId'];
      }

      //普通数组
      if (item.type === 10000007) {
        return (typeof source.staticValue === 'string' ? source.staticValue : '').replace(/，/g, ',').split(',');
      }
    }
    return undefined;
  });

  if (_.includes([2, 6, 9, 16, 36], item.type)) {
    return tempValues.join('');
  }

  const dealValue = _.flatten(tempValues).filter(i => !isEmptyValue(i));
  return _.isEmpty(dealValue) ? '' : dealValue;
};

export const getParamsByConfigs = (
  recordId: string | undefined,
  requestMap: ApiRequestMapping[] = [],
  formData: FormControl[] = [],
  keywords: ApiKeywords = '',
) => {
  const params: Record<string, unknown> = {};
  requestMap.forEach(item => {
    if (item.pid || !item.id) return;
    // 对象数组
    if (item.type === 10000008) {
      // 对象数组或子表控件
      const curControl = _.find(formData, i => i.controlId === defaultSources(item.defsource || '[]')[0]?.cid) || {};
      // 对象数组或子表值
      const store: unknown = curControl.store;
      const controlState = valueRecord(isStoreReader(store) ? store.getState() : undefined) || {};
      const rows = (
        curControl.type === 29
          ? getRelateValue(curControl, controlState, recordId)
          : parsedRecords(controlState['rows'] || [])
      ).filter(r => !(stringValue(r['rowid']) || '').includes('empty'));

      params[item.id] = '';

      if (rows.length) {
        // 对象数组内部配置
        const childMap = requestMap.filter(r => r.pid === item.id);

        params[item.id] = rows.map((row = {}) => {
          const rowItem: Record<string, unknown> = {};
          const rowRecordId = stringValue(row['rowid']) || '';
          childMap.forEach(c => {
            if (!c.id) return;
            const { cid, rcid } = defaultSources(c.defsource || '[]')[0] || {};
            const dynamicRecordId = cid === 'rowid' && rcid ? rowRecordId : recordId;
            const totalRelations = (curControl.relationControls || [])
              .concat(WORKFLOW_SYSTEM_CONTROL)
              .concat(SYSTEM_CONTROL);
            const childControl = _.find(rcid ? totalRelations : formData, r => r.controlId === cid);
            const controlValues = rcid
              ? totalRelations.map(i => {
                  if (i.controlId === cid) {
                    return {
                      ...i,
                      value: cid ? row[cid] || '' : '',
                    };
                  }

                  return i;
                })
              : formData;
            rowItem[c.id] =
              cid === 'rowid' || childControl || !cid
                ? getApiDynamicValue(c, controlValues, keywords, dynamicRecordId)
                : '';
          });
          return rowItem;
        });
      }
    } else {
      params[item.id] = getApiDynamicValue(item, formData, keywords, recordId);
    }
  });
  return params;
};

export const getShowValue = (control: FormControl | undefined, value: unknown = '') => {
  if (control) {
    let curValue: unknown[] = [];

    if (_.includes([9, 10, 11], control.type)) {
      curValue = parsedStrings(value || '[]').map(
        i =>
          _.get(
            _.find(control.options || [], op => op.key === i),
            'value',
          ) || '',
      );
    } else if (control.type === 26) {
      curValue = parsedRecords(value || '[]').map(i => i['fullname']);
    } else if (control.type === 27) {
      curValue = parsedRecords(value || '[]').map(i => i['departmentName']);
    } else if (control.type === 48) {
      curValue = parsedRecords(value || '[]').map(i => i['organizeName']);
    } else {
      return clearValue(value);
    }

    return curValue.length > 0 ? curValue.join('') : '';
  }

  return clearValue(value);
};

export const clearValue = (value: unknown = ''): string => {
  let curValue = typeof value === 'string' ? value : `${value}`;

  if (_.includes(['{}', '[]', 'null'], curValue)) {
    curValue = '';
  }

  return curValue;
};

// api查询数据处理
export const handleUpdateApi = (
  props: ApiUpdateProps,
  sourceData: unknown = {},
  isDefault = false,
  callback?: (() => void) | undefined,
) => {
  const { advancedSetting: { ['responsemap']: responsemap } = {}, formData = [], onChange } = props;
  const itemData = valueRecord(sourceData) || {};
  const responseMap = decodeApiResponseMap(responsemap || '[]');
  responseMap.map(item => {
    if (!item.cid) return;
    const control = _.find(formData, i => i.controlId === item.cid);

    if (control && !_.isUndefined(itemData[item.cid])) {
      // 子表直接赋值
      if (control.type === 34 && _.includes([10000007, 10000008], item.type)) {
        onChange(
          {
            action: 'clearAndSet',
            isDefault,
            rows: parsedRecords(itemData[item.cid] || '[]').map(i => {
              return {
                ...i,
                rowid: `temprowid-${uuidv4()}`,
                allowedit: true,
                addTime: new Date().getTime(),
              };
            }),
          },
          control.controlId,
        );
      } else if (!item.subid) {
        // 普通数组特殊处理
        let itemVal = itemData[item.cid];

        if (item.type === 10000007 && itemData[item.cid] && Array.isArray(parseValue(itemData[item.cid]))) {
          if (!_.includes([26], control.type)) {
            itemVal = parsedArray(itemData[item.cid]).join(',');
          }
        }

        onChange(itemVal, control.controlId, false);
      }

      if (_.isFunction(callback)) {
        callback();
      }
    }
  });
};

// authAccount处理
export const dealAuthAccount = (authaccount = '', formData: FormControl[] = []) => {
  const parseAccount = parsedRecord(authaccount);

  if (parseAccount['authIdAccounts']) {
    const authIdAccounts = parsedRecords(parseAccount['authIdAccounts'] || []);
    const authIdKeywords = stringValue(parseAccount['authIdKeywords']) || '';
    return JSON.stringify({
      accountId: authIdAccounts[0]?.['roleId'],
      keywords: getDynamicValue(formData, {
        type: 2,
        advancedSetting: { defsource: JSON.stringify(transferValue(authIdKeywords)) },
      }),
    });
  }

  return authaccount || '';
};
