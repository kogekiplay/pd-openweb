import type { ReactNode } from 'react';
import styled from 'styled-components';
import { Switch } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';

/**
 * 公开合同只按真实消费方与 ming-ui Switch 的真实实现收窄（PublicConfig 下 14 处调用）：
 * - checked 是受控值。真实调用方有三类来源：布尔 state、`x === true`、`_.get(...)`，
 *   Switch 自己对 `undefined` 有内部 state 语义（componentDidUpdate 只在 checked !== undefined
 *   时才写回），所以这里保留可选，不猜"必传"。
 * - onClick 的首参由 Switch.handleClick() 决定：checked !== undefined 时传
 *   `this.props.checked`，否则传内部取反后的值 —— 两个分支都是 boolean，**不是 Event**。
 *   Switch 还会传第二参 value，但本组件从不向 Switch 传 value，它恒为 undefined，
 *   所以合同不声明第二参，不给消费方一个实际无意义的类型。
 * - name 进 `<span>`；tip 走 `typeof === 'string'` 的字符串分支或包进 `<span>` 的节点分支，
 *   真实调用方两处分别传 `_l(...)` 字符串与 `<Fragment>`，所以两者都是 ReactNode。
 * - disabled 原样转给 Switch 的 disabled。
 */
export interface CommonSwitchProps {
  checked?: boolean | undefined;
  onClick?: ((checked: boolean) => void) | undefined;
  name?: ReactNode | undefined;
  tip?: ReactNode | undefined;
  disabled?: boolean | undefined;
}

const CommonSwitchContainer = styled.div`
  height: 18px;
  .smallSwitch {
    transform: scale(0.67) translate(-6px, -3px);
    margin-left: -4px;
  }
`;

export default function CommonSwitch(props: CommonSwitchProps) {
  const { checked, onClick, name, tip, disabled } = props;
  return (
    <CommonSwitchContainer>
      <Switch className="smallSwitch" checked={checked} onClick={onClick} disabled={disabled} />
      <span>{name}</span>
      {!!tip && (
        <Tooltip placement="bottom" title={typeof tip === 'string' ? tip : <span>{tip}</span>}>
          <i className="icon icon-help Font16 textTertiary mLeft10"></i>
        </Tooltip>
      )}
    </CommonSwitchContainer>
  );
}
