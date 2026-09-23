import { getControlIcon } from '../../../../core/utils';
import Dropdown from '../../../Dropdown';
import type { FormControl } from 'src/utils/controlTypes';

const SelectFieldDropdown = props => {
  const { controls, selectedFields, addSelectedField }: { controls: FormControl[]; [key: string]: any } = props;
  const selectedIdSet = new Set((selectedFields || []).map(item => item.controlId));
  // 剩余字段
  const remainingControls = (controls || []).filter(control => !selectedIdSet.has(control.controlId));

  return (
    <Dropdown
      disabled={!remainingControls.length}
      data={remainingControls}
      getKey={item => item.controlId}
      getIcon={item => getControlIcon(item)}
      getSubIcon={item => (item.attribute === 1 ? 'ic_title' : null)}
      getLabel={item => item.controlName}
      onSelect={addSelectedField}
      triggerText={_l('添加')}
      searchPlaceholder={_l('搜索字段')}
      emptyText={_l('没有可选的字段')}
    />
  );
};

export default SelectFieldDropdown;
