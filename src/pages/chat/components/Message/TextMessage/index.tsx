import { Component } from 'react';
import type { ChatMessage } from '../../../redux/types';
import * as utils from '../../../utils';
import { present } from '../../../utils/present';
import './index.less';

/** 文本消息的真实消费面：父组件 containers/Message 按 Constant.MSGTYPE_TEXT 只传 message。 */
export interface TextMessageProps {
  message: ChatMessage;
}

export default class TextMessage extends Component<TextMessageProps, {}> {
  constructor(props: TextMessageProps) {
    super(props);
  }
  override render() {
    const { message } = this.props;
    // present 只证明 msg 非空；con 缺失仍原样传给 parser（真实 parser 对 undefined 原生失败），
    // 不用默认值/可选链改变行为，也不做 DTO 断言。
    return (
      <span
        className="Message-text"
        dangerouslySetInnerHTML={{ __html: utils.messageContentParser(present(message.msg, 'con').con) }}
      />
    );
  }
}
