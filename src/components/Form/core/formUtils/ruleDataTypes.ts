import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';
import type { FormQueryConfig } from '../queryTypes';
import type { FilterEvaluation } from './filterTypes';
import type { getAvailableFilters } from './ruleUtils';
import type { FormConditionRule, FormRuleAction, PermissionUpdate } from './types';

export interface RuleTarget {
  controlId?: string | undefined;
  childControlIds?: string[] | undefined;
  permission?: string[] | undefined;
  isCustom?: boolean | undefined;
  /** RuleChildItem uses a string default-value mode, independent of FormControl.type. */
  type?: string | undefined;
  value?: string | undefined;
}
export interface DynamicRuleSetting {
  type?: string | undefined;
  value?: string | undefined;
}
export interface StyleRuleSetting extends DynamicRuleSetting {
  message?: string | undefined;
}
export interface RuleBuckets {
  parent: Record<string, FormRuleAction[]>;
  child: Record<string, FormRuleAction[]>;
  errorMsg: Record<string, Array<string | undefined>>;
  dynamic: Record<string, DynamicRuleSetting[]>;
  style: Record<string, StyleRuleSetting[]>;
}
export type RuleChange = (
  value?: unknown,
  cid?: string,
  item?: FormControl,
  searchByChange?: boolean,
  complete?: boolean,
) => void;
export type RuleValidator = (
  controlId: string | undefined,
  errorType: string,
  errorText: string | undefined,
  rule?: FormConditionRule,
) => void;
export type RuleSearchConfig = FormQueryConfig;
export interface RuleDataProps {
  rules?: FormConditionRule[] | undefined;
  data?: FormControl[] | undefined;
  recordId?: string | undefined;
  from?: number | undefined;
  checkAllUpdate?: boolean | undefined;
  updateControlIds?: string[] | undefined;
  currentRuleControlIds?: string[] | undefined;
  searchConfig?: RuleSearchConfig[] | undefined;
  ignoreHideControl?: boolean | undefined;
  verifyAllControls?: boolean | undefined;
  handleChange?: RuleChange | undefined;
  checkRuleValidator?: RuleValidator | undefined;
  disabledRuleSet?: boolean | undefined;
}
export interface DynamicRulesInput {
  relateRuleType: RuleBuckets;
  formatData: FormControl[];
  from?: number | undefined;
  recordId?: string | undefined;
  searchConfig: RuleSearchConfig[];
  handleChange: RuleChange;
}
export interface RuleDataDependencies {
  getAvailableFilters: typeof getAvailableFilters;
  checkValueAvailable: (
    rule: FormConditionRule,
    data: FormControl[],
    recordId?: string,
    from?: number,
  ) => {
    isAvailable: FilterEvaluation;
    filterControlIds: Array<string | undefined>;
    availableControlIds: Array<string | undefined>;
  };
  updateDataPermission: (args: PermissionUpdate) => void;
  handleDynamicRules?: ((args: DynamicRulesInput) => void) | undefined;
  parseStyleSetting?: ((value?: string) => ControlAdvancedSetting) | undefined;
}
