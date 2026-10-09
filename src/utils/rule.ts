import _ from 'lodash';
import { updateRulesDataOfRow } from 'src/components/Form/core/formUtils/rowRuleAdapter';
import type { FormConditionRule } from 'src/components/Form/core/formUtils/types';
import type { FormControl, RecordRow } from './controlTypes';

interface RowRulesProps {
  from?: number | undefined;
  rules?: FormConditionRule[] | undefined;
  controls: FormControl[];
  control?: FormControl | undefined;
  row: RecordRow;
}
interface RowRuleError {
  controlId: string;
  errorType: string;
  errorMessage: string;
  ignoreErrorMessage: boolean;
}

/**
 * 获取记录字段规则错误
 */
export function checkRulesErrorOfRow({ from, rules, controls, control, row }: RowRulesProps): {
  formData: FormControl[];
  errors: RowRuleError[];
} {
  let errors: RowRuleError[] = [];
  const formData = updateRulesDataOfRow({
    from,
    rules,
    recordId: row.rowid,
    data: controls.map(c => ({ ...c, value: row[c.controlId === undefined ? 'undefined' : c.controlId] })),
    updateControlIds: control?.controlId ? [control.controlId] : [],
    checkAllUpdate: !control,
    // rule 只有 checkType 被读到（3 = 这条错误不弹提示，只标红）
    checkRuleValidator: (
      controlId: string | undefined,
      errorType,
      errorMessage,
      rule: { checkType?: number | undefined } = {},
    ) => {
      if (controlId === undefined) return;
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
export function checkRulesErrorOfRowControl({
  from,
  rules,
  controls,
  control,
  row,
}: RowRulesProps & { control: FormControl }) {
  const errors = checkRulesErrorOfRow({ from, rules, controls, control, row }).errors;
  return _.find(errors, e => e.controlId === control.controlId);
}
