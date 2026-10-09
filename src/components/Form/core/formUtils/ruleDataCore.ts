import _ from 'lodash';
import { controlState } from 'src/utils/controlCommon';
import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';
import { FORM_ERROR_TYPE } from '../config';
import type { RuleBuckets, RuleDataDependencies, RuleDataProps, RuleTarget, RuleValidator } from './ruleDataTypes';
import { valueRecord } from './valueBoundary';

export function parseRuleStyleSetting(value?: string): ControlAdvancedSetting {
  const parsed: unknown = JSON.parse(value || '{}');
  return decodeRuleStyleSetting(parsed);
}
export function decodeRuleStyleSetting(parsed: unknown): ControlAdvancedSetting {
  const record = valueRecord(parsed);
  if (!record) return {};
  const result: ControlAdvancedSetting = {};
  Object.entries(record).forEach(([key, setting]) => {
    if (typeof setting === 'string') result[key] = setting;
  });
  return result;
}

const removeRequireError = (controls: RuleTarget[] = [], checkRuleValidator: RuleValidator = () => {}) => {
  controls.forEach(control => {
    const { controlId = '', childControlIds = [] } = control;

    if (!childControlIds.length) {
      checkRuleValidator(controlId, FORM_ERROR_TYPE.RULE_REQUIRED, '');
    } else {
      childControlIds.forEach(childControlId => checkRuleValidator(childControlId, FORM_ERROR_TYPE.RULE_REQUIRED, ''));
    }
  });
};

export const updateRulesDataByRule = (
  props: RuleDataProps,
  {
    getAvailableFilters,
    checkValueAvailable,
    updateDataPermission,
    handleDynamicRules,
    parseStyleSetting = parseRuleStyleSetting,
  }: RuleDataDependencies,
): FormControl[] => {
  const {
    rules = [],
    data = [],
    recordId,
    from,
    checkAllUpdate = false,
    updateControlIds = [],
    currentRuleControlIds = [],
    searchConfig = [],
    ignoreHideControl = false,
    verifyAllControls = false,
    handleChange,
    checkRuleValidator = () => {},
    disabledRuleSet = false,
  } = props;
  let formatData = data.map(item => {
    return {
      ...item,
      ...item.defaultState,
      relationControls: (item.relationControls || []).map(relationControl => ({
        ...relationControl,
        ...relationControl.defaultState,
      })),
    };
  });

  if (ignoreHideControl) {
    formatData = formatData.filter(control => controlState(control, from).visible);
  }

  const formatDataMap = formatData.reduce<Record<string, FormControl>>((map, item) => {
    map[item.controlId === undefined ? 'undefined' : item.controlId] = item;
    return map;
  }, {});
  const relateRuleType: RuleBuckets = {
    parent: {},
    child: {},
    errorMsg: {},
    dynamic: {},
    style: {},
  };

  function pushType<T>(bucket: Record<string, T[]>, id: string | undefined, value: T): void {
    const key = id === undefined ? 'undefined' : id;
    const values = bucket[key];
    values ? values.push(value) : (bucket[key] = [value]);
  }

  const { defaultRules = [], errorOrStyleRules = [] } = getAvailableFilters(rules, formatData, recordId);

  if (defaultRules.length > 0) {
    defaultRules.forEach(rule => {
      const { isAvailable, availableControlIds = [] } = checkValueAvailable(rule, formatData, recordId);

      (rule.ruleItems || []).forEach(({ type, controls = [] }) => {
        let currentType = type;

        if (currentType === 1) {
          currentType = isAvailable ? 1 : 2;
        } else if (currentType === 2) {
          currentType = isAvailable ? 2 : 1;
        }

        if (currentType === 5 && !isAvailable) {
          removeRequireError(controls, checkRuleValidator);
        }

        if (!_.includes([1, 2], currentType) && !isAvailable) return;

        const attrObj = { type: currentType };

        if (_.includes([7, 8], currentType)) {
          formatData.forEach(item => pushType(relateRuleType.parent, item.controlId, attrObj));
        } else {
          controls.forEach(control => {
            if (currentType === 9) {
              if (
                _.some(availableControlIds, availableControlId => _.includes(currentRuleControlIds, availableControlId))
              ) {
                pushType(relateRuleType.dynamic, control.controlId, { ..._.pick(control, ['type', 'value']) });
              }
            } else {
              const { controlId = '', childControlIds = [], permission, isCustom } = control;

              if (!childControlIds.length) {
                pushType(relateRuleType.parent, controlId, { ...attrObj, ...(isCustom ? { permission } : {}) });
              } else {
                childControlIds.forEach(childControlId =>
                  pushType(relateRuleType.child, `${controlId}-${childControlId}`, attrObj),
                );
              }
            }
          });
        }
      });
    });
  }

  formatData.forEach(item => {
    item.relationControls.forEach((relationControl: FormControl) => {
      const id = `${item.controlId}-${relationControl.controlId}`;
      updateDataPermission({
        attrs: relateRuleType.child[id],
        it: relationControl,
        checkRuleValidator,
        item,
        verifyAllControls,
      });
    });
    updateDataPermission({
      attrs: relateRuleType.parent[item.controlId === undefined ? 'undefined' : item.controlId],
      it: item,
      checkRuleValidator,
      verifyAllControls,
    });
  });

  if (errorOrStyleRules.length > 0) {
    errorOrStyleRules.forEach(rule => {
      if (rule.checkType !== 2 || rule.type === 3) {
        const {
          filterControlIds = [],
          availableControlIds = [],
          isAvailable,
        } = checkValueAvailable(rule, formatData, recordId, from);

        (rule.ruleItems || []).forEach(({ type, message, controls = [] }) => {
          if (rule.type === 3 && isAvailable) {
            controls.forEach(control => {
              pushType(relateRuleType.style, control.controlId, { ..._.pick(control, ['type', 'value']), message });
            });
          } else if (_.includes([6], type)) {
            const errorIds = controls.map(control => control.controlId);
            const curErrorIds = rule.type === 1 && errorIds.length > 0 ? errorIds : filterControlIds;
            (rule.type === 1 ? curErrorIds : filterControlIds).forEach(id =>
              checkRuleValidator(id, FORM_ERROR_TYPE.RULE_ERROR, '', rule),
            );

            if (isAvailable) {
              availableControlIds.forEach(controlId => {
                const idKey = controlId === undefined ? 'undefined' : controlId;
                if (!relateRuleType.errorMsg[idKey]) {
                  const pushError = (id: string | undefined, msg: string | undefined): void => {
                    const key = id === undefined ? 'undefined' : id;
                    pushType(relateRuleType.errorMsg, id, msg);
                    if (formatDataMap[key]) {
                      const errorMsg = relateRuleType.errorMsg[key] || [];
                      checkRuleValidator(id, FORM_ERROR_TYPE.RULE_ERROR, errorMsg[0], rule);
                    }
                  };

                  if (
                    checkAllUpdate ||
                    (updateControlIds.length > 0 && (rule.type === 1 || _.includes(updateControlIds, controlId)))
                  ) {
                    if (rule.type === 1 && errorIds.length > 0) {
                      errorIds.forEach(errorId => pushError(errorId, message));
                    } else {
                      pushError(controlId, message);
                    }
                  }
                }
              });
            }
          }
        });
      }
    });
  }

  if (!_.isEmpty(relateRuleType.dynamic) && !disabledRuleSet && _.isFunction(handleChange) && handleDynamicRules) {
    handleDynamicRules({
      relateRuleType,
      formatData,
      from,
      recordId,
      searchConfig,
      handleChange,
    });
  }

  if (!_.isEmpty(relateRuleType.style)) {
    Object.keys(relateRuleType.style).forEach(key => {
      if (relateRuleType.style[key]) {
        const styleSettings = _.last(relateRuleType.style[key] || []);

        if (styleSettings && !_.isEmpty(styleSettings)) {
          const item = formatDataMap[key];

          if (item) {
            item.advancedSetting = {
              ...item.advancedSetting,
              ...parseStyleSetting(styleSettings.message),
              ...parseStyleSetting(styleSettings.value),
            };
          }
        }
      }
    });
  }

  return formatData;
};
