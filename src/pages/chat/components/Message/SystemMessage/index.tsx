import { Component } from 'react';
import type { ChatMessage, ChatSession } from '../../../redux/types';
import cx from 'classnames';
import _ from 'lodash';
import { addFriendConfirm } from 'ming-ui/functions';
import addFriends from 'src/components/addFriends';
import Constant from '../../../utils/constant';
import { present } from '../../../utils/present';
import './index.less';

/** 唯一渲染点：containers/Message 的 `sysType || iswd` 分支只传 message 与 session。 */
export interface SystemMessageProps {
  message: ChatMessage;
  session: ChatSession;
}

export default class SystemMessage extends Component<SystemMessageProps, {}> {
  constructor(props: SystemMessageProps) {
    super(props);
  }
  addFriend() {
    const { session } = this.props;
    addFriendConfirm({
      accountId: session.id,
    });
  }
  invite() {
    addFriends({
      selectProject: true,
      friendVisible: false,
    });
  }
  // 事件 target 的真实类型（EventTarget 上的 tagName/classList）在 React 类型里无法不加断言闭环，
  // 保留隐式 any 作为本切片未闭环债务（不引入 as/instanceof 伪装）。
  handleClick(event) {
    const { target } = event;

    if (target.tagName === 'SPAN') {
      target.classList.contains('addFriend') && this.addFriend();
      target.classList.contains('invite') && this.invite();
    }
  }
  handleResetEdit = () => {
    const { message, session } = this.props;
    const textarea = $(`#ChatPanel-${session.id}`).find('.ChatPanel-Textarea .Textarea');
    const currentValue = textarea.val();
    // window 上按会话 id 注册的回调由 ChatPanelSession 写入；未注册时为 _.noop（保持原 any 债务）。
    const onChangeChatValue = window[`onChangeChatValue-${session.id}`] || _.noop;

    if (currentValue) {
      onChangeChatValue(`${currentValue} ${present(message.msg, 'oldCon').oldCon}`);
    } else {
      onChangeChatValue(present(message.msg, 'oldCon').oldCon);
    }

    setTimeout(() => {
      textarea.focus();
    }, 0);
  };
  override render() {
    const { message, session } = this.props;
    const isFileTransfer = session.id === 'file-transfer';
    return (
      <div className="Message-sysType">
        <div
          className={cx('Message-sysType-icon', {
            'Message-sysType-reduceIcon': message.sysType === Constant.MSGTYPE_SYSTEM_ERROR,
          })}
        >
          <i className="icon-error_outline" />
        </div>
        {'isContact' in message ? (
          <div
            onClick={this.handleClick.bind(this)}
            className="Message-sysType-text"
            dangerouslySetInnerHTML={{
              __html: _l(
                `对方不是您的联系人，可以%0或%1成为组织成员`,
                `<span class="colorPrimary Font13 pointer addFriend">${_l('添加好友')}</span>`,
                `<span class="colorPrimary Font13 pointer invite">${_l('邀请')}</span>`,
              ),
            }}
          />
        ) : (
          <div onClick={this.handleClick.bind(this)} className="Message-sysType-text">
            {present(message.msg, 'con').con}
          </div>
        )}
        {_.get(message.msg, 'oldCon') && message.type === Constant.MSGTYPE_TEXT && !isFileTransfer && (
          <div className="Font13 pointer colorPrimary mLeft8" onClick={this.handleResetEdit}>
            {_l('重新编辑')}
          </div>
        )}
      </div>
    );
  }
}
