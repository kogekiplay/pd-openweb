import _ from 'lodash';
import { controlState, isSheetDisplay } from 'src/utils/controlCommon';
import type { FormControl } from 'src/utils/controlTypes';
import { FORM_ERROR_TYPE, FORM_ERROR_TYPE_TEXT } from '../config';
import filterFn from './filterFn';
import type { FilterEvaluation } from './filterTypes';
import { checkRequired as checkRequiredValue } from './index';
import { decodeRuleStyleSetting, updateRulesDataByRule } from './ruleDataCore';
import type { RuleDataProps } from './ruleDataTypes';
import { flattenArr, getAvailableFilters, getResult, isRelateMoreList, replaceStr } from './ruleUtils';
import type {
  FormConditionRule,
  FormRuleCheckResult,
  PermissionUpdate,
  FormFilterGroup as RuleFilterGroup,
  FormComparisonCondition as RuleFilterItem,
} from './types';

const getFieldIds = (filter: RuleFilterItem = {}) => {
  const isDynamic = filter.dynamicSource && filter.dynamicSource.length > 0;
  return isDynamic ? [filter.controlId, ...(filter.dynamicSource || []).map(dy => dy.cid)] : [filter.controlId];
};

const getIds = (filterGroup: RuleFilterGroup = {}) => {
  return (filterGroup.groupFilters || []).reduce<Array<string | undefined>>(
    (total, filter) => total.concat(getFieldIds(filter)),
    [],
  );
};

const getItemGroupFilters = (
  filterGroup: RuleFilterGroup = {},
  data: FormControl[] = [],
  recordId: string | undefined,
  from: number | undefined,
) => {
  const isOrCondition = (filterGroup.groupFilters || []).findIndex(filter => filter.spliceType === 2) > -1;
  let groupFilters = [filterGroup.groupFilters || []];

  if (isOrCondition) {
    groupFilters = (filterGroup.groupFilters || []).map(filter => [filter]);
  }

  groupFilters = groupFilters.filter(filters => {
    const ids = getIds({ groupFilters: filters });
    return _.some(ids, id => {
      const control = _.find(data, item => item.controlId === id);
      return (
        (recordId && id === 'rowid') ||
        _.includes(['currenttime', 'user-self'], id) ||
        (control && controlState(control, from).visible && !control.hidden)
      );
    });
  });

  return { ...filterGroup, groupFilters: _.flatten(groupFilters) };
};

const checkValueAvailable = (
  rule: FormConditionRule = {},
  data: FormControl[] = [],
  recordId?: string,
  from?: number,
): FormRuleCheckResult => {
  let isAvailable: FilterEvaluation = false;
  //不满足条件的id,过滤错误
  const filterControlIds: Record<number, Array<Array<string | undefined>>> = {};
  //满足条件的错误id合集
  const availableControlIds: Record<number, Array<Array<string | undefined>>> = {};
  let transFilters = rule.filters || [{}]; //条件二维数组

  //条件字段或字段值都隐藏
  // 记录id存在才参与业务规则
  if (from) {
    transFilters = transFilters
      .map(arrItem => {
        return getItemGroupFilters(arrItem, data, recordId, from);
      })
      .filter(i => !_.isEmpty(i.groupFilters));
  }

  transFilters.forEach((arr, pIdx) => {
    if (!filterControlIds[pIdx]) {
      filterControlIds[pIdx] = [];
    }

    if (!availableControlIds[pIdx]) {
      availableControlIds[pIdx] = [];
    }

    const filters = arr.groupFilters;
    if (filters && filters.length) {
      const failedIds = filterControlIds[pIdx] || [];
      const availableIds = availableControlIds[pIdx] || [];
      let childItemAvailable: FilterEvaluation = true;
      filters.forEach((its, index: number) => {
        let filterControl = data.find(a => a.controlId === its.controlId);

        if (filterControl && !isRelateMoreList(filterControl, its)) {
          const result = filterFn({
            filterData: its,
            originControl: filterControl,
            data,
            ...(recordId === undefined ? {} : { recordId }),
            appTimeZone: rule.appTimeZone,
          });
          childItemAvailable = getResult(filters, index, result, childItemAvailable);

          const ids = getFieldIds(its);

          if (!result) {
            failedIds[index] = ids;
            availableIds[index] = [];
          } else {
            failedIds[index] = [];
            availableIds[index] = ids;
          }
        }
      });
      isAvailable = getResult(transFilters, pIdx, childItemAvailable, isAvailable);
    }
  });

  const ids = transFilters.map(i => getIds(i));

  return {
    isAvailable,
    filterControlIds: flattenArr(isAvailable ? [] : ids),
    availableControlIds: flattenArr(isAvailable ? ids : []),
  };
};

const checkRequired = (item: FormControl): string => checkRequiredValue(item);

const getRequiredErrorText = (item: FormControl): string => {
  const errorType = checkRequired(item);
  if (!errorType) return '';
  return FORM_ERROR_TYPE_TEXT.REQUIRED(item);
};

const updateDataPermission = ({ attrs = [], it, checkRuleValidator, item = {} }: PermissionUpdate): void => {
  const isSubList = _.includes([29, 34], item.type);
  let fieldPermission = it.fieldPermission || '111';
  let required = it.required || false;
  let disabled = it.disabled || false;
  const eventPermissions = it.eventPermissions || '';
  const types = attrs.map(i => i.type);

  if (_.includes(types, 2) || eventPermissions[0] === '0') {
    fieldPermission = replaceStr(fieldPermission, 0, '0');
    if (isSubList && _.includes(item.showControls || [], it.controlId)) {
      item.showControls = (item.showControls || []).filter((controlId: string) => controlId !== it.controlId);
    }
  } else if (_.includes(types, 1) || eventPermissions[0] === '1') {
    fieldPermission = replaceStr(fieldPermission, 0, '1');
  }

  if (_.includes(types, 4) || eventPermissions[1] === '0') {
    fieldPermission = replaceStr(fieldPermission, 1, '0');
  } else {
    const permission = _.last(attrs.map(i => i.permission).filter(_.identity));

    if (!_.isUndefined(permission)) {
      if (it.type === 34) {
        it.advancedSetting = {
          ...it.advancedSetting,
          allowcancel: _.includes(permission, 'delete') ? '1' : '0',
          allowedit: _.includes(permission, 'edit') ? '1' : '0',
          ...(_.includes(permission, 'add')
            ? _.get(item, 'advancedSetting.allowadd') !== '1'
              ? { allowadd: '1', allowsingle: '1' }
              : {}
            : { allowadd: '0', allowsingle: '0', batchcids: JSON.stringify([]), allowimport: '0', allowcopy: '0' }),
        };
      } else if (isSheetDisplay(it)) {
        if (_.includes(permission, 'add')) {
          if (!_.includes([0, 1], it.enumDefault2)) {
            it.enumDefault2 = it.enumDefault2 === 10 ? 0 : 1;
            it.advancedSetting = {
              ...it.advancedSetting,
              searchrange: '1',
            };
          }
        } else {
          it.enumDefault2 = it.enumDefault2 === 0 ? 10 : 11;
          it.advancedSetting = {
            ...it.advancedSetting,
            searchrange: '',
          };
        }

        it.advancedSetting = {
          ...it.advancedSetting,
          allowcancel: _.includes(permission, 'delete') ? '1' : '0',
          ...(_.get(it, 'advancedSetting.allowbatch') === '1'
            ? { batchcancel: _.includes(permission, 'delete') ? '1' : '0' }
            : {}),
        };
      }
    }

    if (_.includes(types, 5)) {
      required = true;
      fieldPermission = replaceStr(fieldPermission, 1, '1');
      const errorText = getRequiredErrorText({ ...it, required, fieldPermission });
      item.type !== 34 && checkRuleValidator(it.controlId, FORM_ERROR_TYPE.RULE_REQUIRED, errorText);
    } else if (_.includes(types, 3) || eventPermissions[1] === '1') {
      fieldPermission = replaceStr(fieldPermission, 1, '1');
      checkRuleValidator(it.controlId, '', '');
    }
  }

  if (_.includes(types, 8)) {
    disabled = false;
  }

  it.fieldPermission = fieldPermission;
  it.required = required;
  it.disabled = disabled;
};

export const updateRulesDataOfRow = (props: RuleDataProps): FormControl[] =>
  updateRulesDataByRule(props, {
    getAvailableFilters,
    checkValueAvailable,
    updateDataPermission,
    parseStyleSetting: value => {
      const parsed: unknown = safeParse(value || '{}');
      return decodeRuleStyleSetting(parsed);
    },
  });
