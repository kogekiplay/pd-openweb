import _ from 'lodash';
import { updateRulesDataOfRow } from 'src/components/Form/core/formUtils/rowRuleAdapter';

/**
 * 获取记录字段规则错误
 */
export function checkRulesErrorOfRow({ from, rules, controls, control, row }) {
  let errors = [];
  const formData = updateRulesDataOfRow({
    from,
    rules,
    recordId: row.rowid,
    data: controls.map(c => ({ ...c, value: row[c.controlId] })),
    updateControlIds: control ? [control.controlId] : [],
    checkAllUpdate: !control,
    // rule 只有 checkType 被读到（3 = 这条错误不弹提示，只标红）
    checkRuleValidator: (controlId: string, errorType, errorMessage, rule: { checkType?: number } = {}) => {
      if (errorMessage) {
        errors.push({ controlId, errorType, errorMessage, ignoreErrorMessage: rule.checkType === 3 });
      }
    },
  });
  return { formData, errors };
}

/**
 * 获取字段字段规则错误
 */
export function checkRulesErrorOfRowControl({ from, rules, controls, control, row }) {
  const errors = checkRulesErrorOfRow({ from, rules, controls, control, row }).errors;
  return _.find(errors, e => e.controlId === control.controlId);
}
