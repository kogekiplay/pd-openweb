import { Component } from 'react';
import { Tooltip } from 'ming-ui/antd-components';
import config from '../../utils/config';
import Constant from '../../utils/constant';

export interface MessageSendTextState {
  type: number;
}

/**
 * 组件真实入参：唯一 caller 是 `ChatPanelSession/index.tsx:575`
 * `<MessageSendText value={value} socketState={socketState} onSendMsg={this.handleSendMsg.bind(this)} />`。
 * - `value` = `ChatPanelSessionState.value: string`（:515 解构 / :72 声明）；本组件只做真值判断
 *   （:37 `visibility`），缺值语义按原样允许缺省，不补默认值。
 * - `socketState` = `ChatPanelSessionProps.socketState: number`（:68）；组件内 `= 0` 默认保持。
 * - `onSendMsg` = `handleSendMsg(value?: string)`（:303）的 bound 形态 → 原样取该域，不另造回调 DTO。
 */
export interface MessageSendTextProps {
  value?: string | undefined;
  socketState?: number | undefined;
  onSendMsg: (value?: string) => void;
}

export default class MessageSendText extends Component<MessageSendTextProps, MessageSendTextState> {
  constructor(props: MessageSendTextProps) {
    super(props);
    this.state = {
      type: config.inputMode,
    };
  }
  handleSwitchSendWay() {
    const { type } = this.state;
    const newType = type === Constant.INPUT_MODE_ENTER ? Constant.INPUT_MODE_CTRLENTER : Constant.INPUT_MODE_ENTER;
    this.setState({
      type: newType,
    });
    config.inputMode = newType;
    safeLocalStorageSetItem('im_input_mode', String(newType));
  }
  override render() {
    const { type } = this.state;
    const { value, socketState = 0 } = this.props;
    return (
      <div className="chatPanel-message-send-text flexRow Font12 textTertiary">
        <div className="flexRow alignItemsCenter" style={{ flex: 2 }}>
          {socketState === 1 && _l('正在尝试重新连接，暂时无法发送消息。')}
          {socketState === 2 && _l('连接失败，暂时无法发送消息，请刷新页面重试。')}
        </div>
        <div
          className="flex flexRow alignItemsCenter justifyContentRight pointer"
          style={{ visibility: value ? 'initial' : 'hidden' }}
        >
          <Tooltip title={_l('点击切换输入方式')}>
            <div onClick={this.handleSwitchSendWay.bind(this)}>
              {type === Constant.INPUT_MODE_CTRLENTER ? _l('Enter换行，') : _l('Ctrl+Enter换行，')}
            </div>
          </Tooltip>
          <Tooltip title={_l('点击发送')}>
            <div onClick={this.props.onSendMsg.bind(this, '')}>
              {type === Constant.INPUT_MODE_CTRLENTER ? _l('Ctrl+Enter发送') : _l('Enter发送')}
            </div>
          </Tooltip>
        </div>
      </div>
    );
  }
}
