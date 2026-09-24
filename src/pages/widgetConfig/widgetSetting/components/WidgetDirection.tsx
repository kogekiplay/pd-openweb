import _ from 'lodash';
import { Dropdown } from 'ming-ui';
import { getAdvanceSetting, handleAdvancedSettingChange } from '../../util/setting';

export default ({ data, onChange }) => (
  <div className="settingItem">
    <div className="settingItemTitle">{_l('排列方式')}</div>
    <Dropdown
      style={{ width: '100%', backgroundColor: 'var(--color-background-primary)' }}
      data={[
        // Dropdown 显示的是 text；原来写成 name，选项文字是空的（这个组件目前没人引用）
        { value: '0', text: _l('横向排列') },
        { value: '1', text: _l('纵向排列') },
      ]}
      value={_.get(getAdvanceSetting(data), 'direction') || '0'}
      onChange={direction => onChange(handleAdvancedSettingChange(data, { direction }))}
    />
  </div>
);
