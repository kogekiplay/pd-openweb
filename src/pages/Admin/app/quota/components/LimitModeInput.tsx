import { Fragment } from 'react';
import { Icon } from 'ming-ui';
import { Dropdown, InputNumber } from 'ming-ui/antd-components';
import { getLimitMode, getSizeByLimitMode } from '../utils';

/** 带“不限/限制上限”切换的数值输入，批量弹层和添加弹层复用同一交互。 */
export default function LimitModeInput({
  businessType,
  value,
  min,
  max,
  unit,
  className,
  onChange,
}: {
  businessType: number;
  value?: number | undefined;
  min: number;
  max?: number | undefined;
  unit?: string | undefined;
  className?: string;
  onChange: (value: number) => void;
}) {
  const limitMode = getLimitMode(value);
  const limitModeMenu = {
    items: [
      { key: 'unlimited', label: _l('不限'), disabled: limitMode === 'unlimited' },
      { key: 'limited', label: _l('限制上限'), disabled: limitMode === 'limited' },
    ],
    style: { minWidth: 180 },
    onClick: ({ key }: { key: string }) => onChange(getSizeByLimitMode({ mode: key, size: value, businessType })),
  };

  if (limitMode === 'unlimited') {
    return (
      <Dropdown trigger={['click']} menu={limitModeMenu}>
        <div className={`${className || ''} limitModeTrigger unlimited`}>
          {_l('不限')}
          <Icon icon="arrow-down-border" className="Font12" />
        </div>
      </Dropdown>
    );
  }

  return (
    <Fragment>
      <InputNumber<number>
        className={className || ''}
        value={value ?? null}
        min={min}
        {...(typeof max === 'number' ? { max } : {})}
        precision={0}
        onChange={next => onChange(next ?? min)}
      />
      <Dropdown trigger={['click']} menu={limitModeMenu}>
        <div className="limitModeTrigger mLeft8">
          {unit}
          <Icon icon="arrow-down-border" className="Font12" />
        </div>
      </Dropdown>
    </Fragment>
  );
}
