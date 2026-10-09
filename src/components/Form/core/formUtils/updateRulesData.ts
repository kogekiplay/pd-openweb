import _ from 'lodash';
import type { FormControl } from 'src/utils/controlTypes';
import { getAvailableFilters } from './helper';
import { checkValueAvailable, updateDataPermission } from './index';
import { updateRulesDataByRule } from './ruleDataCore';
import type { DynamicRulesInput, RuleDataProps } from './ruleDataTypes';

// 字段显示规则计算
export const updateRulesData = (props: RuleDataProps): FormControl[] => {
  return updateRulesDataByRule(props, {
    getAvailableFilters,
    checkValueAvailable,
    updateDataPermission,
    handleDynamicRules: ({
      relateRuleType,
      formatData,
      from,
      recordId,
      searchConfig,
      handleChange,
    }: DynamicRulesInput) => {
      const dynamicKeys = Object.keys(relateRuleType.dynamic);

      Promise.all(
        dynamicKeys.map(async key => {
          const dynamicSettings = relateRuleType.dynamic[key];
          // 同个id赋值逻辑，取最后一个
          const lastSetting = _.last(dynamicSettings);

          if (lastSetting) {
            try {
              const { handleSetValueActions } = await import('../customEvent');
              await handleSetValueActions([{ ...lastSetting, controlId: key }], {
                formData: formatData,
                from,
                recordId,
                searchConfig,
                isSetValueFromRule: true,
                handleChange: (value: unknown, cid?: string, item?: FormControl, searchByChange?: boolean) => {
                  handleChange(value, cid, item, searchByChange);
                },
              });
            } catch (error) {
              console.log(error);
            }
          }
        }),
      ).then(() => {
        handleChange(undefined, undefined, undefined, false, true);
      });
    },
  });
};
