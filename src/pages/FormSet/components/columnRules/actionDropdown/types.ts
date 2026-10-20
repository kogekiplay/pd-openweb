import type { ControlAdvancedSetting } from 'src/utils/controlTypes';
import type { RuleDropdownControl, RuleSelection } from '../config';

export type RuleControlsChange = (key: 'controls', values: RuleSelection[]) => void;

interface DropdownCommonProps {
  dropDownData?: RuleDropdownControl[] | undefined;
  originData?: RuleDropdownControl[] | undefined;
  onChange: RuleControlsChange;
  className?: string | undefined;
  actionError?: boolean | undefined;
  from?: string | undefined;
  showSelectAll?: boolean | undefined;
  activeTab?: number | undefined;
  disabled?: boolean | undefined;
}

export interface RuleActionDropdownProps extends DropdownCommonProps {
  actionType?: number | undefined;
  values: RuleSelection[];
}

export interface RuleActionDropdownState {
  visible: boolean;
  extendId: Array<string | undefined>;
  keyword: string;
  dropDownData: RuleDropdownControl[];
  originData: RuleDropdownControl[];
}

export interface RuleSettingDialogProps {
  data: RuleDropdownControl[];
  values: RuleSelection[];
  id: string | undefined;
  onChange: RuleControlsChange;
  actionType?: number | undefined;
}

export interface RuleStyleData {
  type?: number | undefined;
  controlId?: string | undefined;
  controlName?: string | undefined;
  advancedSetting?: ControlAdvancedSetting | undefined;
}

export interface RuleStyleDialogProps {
  data?: RuleDropdownControl[] | undefined;
  values: RuleSelection[];
  id: string | undefined;
  onChange: RuleControlsChange;
  onClose?: (() => void) | undefined;
}
