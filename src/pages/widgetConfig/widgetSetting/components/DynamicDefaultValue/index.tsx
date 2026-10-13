import cx from 'classnames';
import _ from 'lodash';
import { Tooltip } from 'ming-ui/antd-components';
import { DYNAMIC_FROM_MODE } from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/config.js';
import type { FormControl } from 'src/utils/controlTypes';
import { SettingItem } from '../../../styled';
import type { SettingFunction } from '../../../util/advancedSettingBoundary';
import { functionSetting } from '../../../util/advancedSettingBoundary';
import { getAdvanceSetting, handleAdvancedSettingChange } from '../../../util/setting';
import { DEFAULT_TYPES } from './config';
import type { DynamicValueSource, SelectOtherFieldProps } from './dynamicTypes';
import { readDynamicValueSources } from './dynamicTypes';
import { isDynamicInputType, TYPE_TO_COMP } from './inputTypes';
import { dealIds, getControlType } from './util';

export interface DynamicDefaultValueProps extends Omit<
  SelectOtherFieldProps,
  'onDynamicValueChange' | 'dynamicValue' | 'dynamicData' | 'defaultType' | 'controls'
> {
  className?: string | undefined;
  hideOtherFields?: boolean | undefined;
  placeholder?: string | undefined;
  totalWidth?: boolean | undefined;
  defaultType?: boolean | string | undefined;
  data: FormControl;
  allControls?: FormControl[] | undefined;
  onChange?: ((next: FormControl) => void) | undefined;
  from?: number | string | undefined;
  hideTitle?: boolean | undefined;
}
export default function DynamicDefaultValue(props: DynamicDefaultValueProps) {
  const { data, allControls = [], onChange = () => {}, from, hideTitle } = props;
  const type = getControlType(data);

  if (!type || !isDynamicInputType(type)) return null;

  const Comp = TYPE_TO_COMP[type];

  const dynamicValue = dealIds(data.type, readDynamicValueSources(data));
  //工作表或函数
  const { defaulttype = '' } = getAdvanceSetting(data);
  let defaultType = DEFAULT_TYPES[defaulttype] || '';
  let dynamicData: SettingFunction | DynamicValueSource = defaultType
    ? functionSetting(getAdvanceSetting(data, defaultType))
    : {};

  //子表自定义类型异化
  if (dynamicValue.length > 0 && type === 'subList' && defaultType === 'dynamiccustom') {
    dynamicData = dynamicValue[0] || {};
  }

  // 更新data
  const handleDynamicValueChange = (value: DynamicValueSource[]) => {
    let tempValue = value;

    if (_.isArray(value) && _.get(_.last(value), 'cid') === 'empty') {
      tempValue = [{ rcid: '', cid: 'empty', staticValue: '' }];
    } else {
      tempValue = value.filter(i => i.cid !== 'empty');
    }

    onChange(
      handleAdvancedSettingChange(data, {
        defsource: JSON.stringify(tempValue),
        defaulttype: '',
        defaultfunc: '',
        dynamicsrc: '',
      }),
    );
  };

  const clearOldDefault = (para: FormControl = { default: '' }) => {
    onChange(para);
  };

  const isDYForFaster = dynamicValue.some(o => o.rcid === 'url' || o.rcid === 'dateRange');
  return (
    <SettingItem className={cx({ mTop0: hideTitle })}>
      {!hideTitle && (
        <div className="settingItemTitle">
          {_l('默认值')}
          {type === 'department' && from !== DYNAMIC_FROM_MODE.FAST_FILTER && (
            <Tooltip title={_l('单选选择方式时，使用成员字段设置默认值，将取成员所在主部门')}>
              <span className="textTertiary pointer Font15">
                <i className="icon-help"></i>
              </span>
            </Tooltip>
          )}
        </div>
      )}
      <Comp
        {...props}
        data={data}
        controls={allControls}
        allControls={allControls}
        onChange={onChange}
        dynamicValue={dynamicValue}
        defaultType={defaultType || isDYForFaster}
        dynamicData={dynamicData}
        clearOldDefault={clearOldDefault}
        onDynamicValueChange={handleDynamicValueChange}
        {...(from === 'subList' ? { fromCondition: 'relateSheet' } : {})}
      />
    </SettingItem>
  );
}
