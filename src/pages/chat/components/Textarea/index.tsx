import { Component } from 'react';
import type { KeyboardEvent } from 'react';
import Textarea from 'ming-ui/components/Textarea';
import type { ChatMessage, ChatSession } from '../../redux/types';
import { present } from '../../utils/present';
import { getCaretPosition, setCaretPosition } from 'src/utils/common';
import * as utils from '../../utils/';
import config from '../../utils/config';
import Constant from '../../utils/constant';
import './index.less';

/** 唯一真实 producer 是 `containers/ChatPanelSession/index.tsx:552-562` 的 `<Textarea …/>`：
 *  `disabled={!isContact}`、`value`（会话草稿字符串）、`session`、`placeholder`（三目得到 string）、
 *  `referMessage={referMessage[id]}`（字典取值为 `ChatMessage | undefined`）、以及四个绑定方法。 */
export interface TextareaBoxProps {
  value: string;
  session: ChatSession;
  /** producer 传 `isContact ? _l(…) : hideChat ? _l(…) : ''`，恒为 string */
  placeholder?: string | undefined;
  /** producer 传 `!isContact`（`isContact` 是 `boolean | undefined`） */
  disabled?: boolean | undefined;
  /** `ChatReferMessageState[sessionId]` 的真实取值域 */
  referMessage?: ChatMessage | undefined;
  /** producer: `handleSendMsg(value?: string)` */
  onSendMsg: (value?: string | undefined) => void;
  /** producer: `handleBlur(value: string)` */
  onBlur: (value: string) => void;
  /** producer: `handleChange = (value: string) => void` */
  onChange: (value: string) => void;
  /** producer: `handleRemoveReferMessage()` */
  onRemoveReferMessage: () => void;
}

/** state 仍保持原 `any`（未新增）：`handleChange` 的 `$().val()` 宽重载写入、
 *  `handleBlur` 的 fallback 都使 `value` 的真实域无法在未改运行时前提下收紧；
 *  故本片只交付 Props 与已证 events/renderIcon，不claim state 闭环。 */
export default class TextareaBox extends Component<TextareaBoxProps, any> {
  declare lastHeight: number | undefined;
  declare currentHeight: number | undefined;
  declare isComposing: boolean;
  declare compositionEndTime: number;
  declare textareaWrapper: HTMLDivElement | null | undefined;
  declare messageRefer: HTMLDivElement | null | undefined;

  constructor(props: TextareaBoxProps) {
    super(props);
    this.state = {
      value: this.props.value,
      propValue: this.props.value,
    };
    this.lastHeight = 50;
    this.currentHeight = 50;
    this.isComposing = false;
    this.compositionEndTime = 0;
  }

  static getDerivedStateFromProps(nextProps: TextareaBoxProps, prevState) {
    if (nextProps.value !== prevState.propValue) {
      return {
        value: nextProps.value,
        propValue: nextProps.value,
      };
    }

    return null;
  }
  isInputComposing(event: KeyboardEvent<HTMLTextAreaElement>) {
    return (
      this.isComposing ||
      event.nativeEvent?.isComposing ||
      event.keyCode === 229 ||
      Date.now() - this.compositionEndTime < 50
    );
  }
  handleCompositionStart() {
    this.isComposing = true;
  }
  handleCompositionEnd() {
    this.compositionEndTime = Date.now();
    this.isComposing = false;
  }
  handleKeyDown(event) {
    if (event.which === 13) {
      if (this.isInputComposing(event)) return undefined;

      const { value } = this.state;
      const isSendMsg =
        (config.inputMode === Constant.INPUT_MODE_ENTER && !event.ctrlKey) ||
        (config.inputMode === Constant.INPUT_MODE_CTRLENTER && event.ctrlKey);
      const isEnter = config.inputMode === Constant.INPUT_MODE_ENTER;

      if (isSendMsg) {
        if (value.length > config.msgMaxSize) {
          alert(_l('您最多可输入%0个字符', config.msgMaxSize), 3);
        } else {
          value.trim() && this.props.onSendMsg(value);
        }

        event.preventDefault();
      } else {
        const pos = Number(getCaretPosition(event.target));
        const start = value.slice(0, pos);
        const end = value.slice(pos);
        const nextValue = isEnter ? start + '\r\n' + end : start + end;

        if (isEnter) {
          this.setState({ value: nextValue }, () => {
            setCaretPosition(event.target, pos + 1);
          });
          this.props.onChange(nextValue);
          event.preventDefault();
        } else {
          this.setState({ value: nextValue });
        }
      }

      return false;
    }
    return undefined;
  }
  handleBlur() {
    const { value } = this.state;
    this.props.onBlur(value || $(this.textareaWrapper).find('textarea').val());
  }
  handleChange(value) {
    const { session } = this.props;
    const height = $(this.textareaWrapper).height();
    const nextValue = value === undefined ? $(this.textareaWrapper).find('textarea').val() : value;
    this.currentHeight = height;
    if (this.lastHeight !== this.currentHeight) {
      this.lastHeight = height;
      utils.scrollEnd(session.id);
    }

    this.setState({ value: nextValue });
    this.props.onChange(nextValue);

    if (!this.isComposing && Date.now() - this.compositionEndTime > 100) {
      this.compositionEndTime = 0;
    }
  }
  handleKeyUp(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.which === 37 || event.which === 38 || event.which === 39 || event.which === 40) {
      const { session } = this.props;
      utils.recordCursortPosition(session.id);
    }
  }
  renderIcon(type: number | undefined) {
    if (type === Constant.MSGTYPE_FILE) {
      return <i className="icon-defaultFile" />;
    } else if (type === Constant.MSGTYPE_PIC) {
      return <i className="icon-picture" />;
    } else {
      return undefined;
    }
  }
  renderMessageRefer() {
    const { referMessage } = this.props;
    const { msg, fromAccount, type } = present(referMessage, 'msg');
    const text = `“ ${present(fromAccount, 'name').name}：${present(msg, 'con').con} ”`;
    return (
      <div
        className="ChatPanel-MessageRefer"
        ref={messageRefer => {
          this.messageRefer = messageRefer;
        }}
      >
        <div className="text" title={text}>
          “ {this.renderIcon(type)} {present(fromAccount, 'name').name}：{present(msg, 'con').con} ”
        </div>
        <i onClick={this.props.onRemoveReferMessage.bind(this)} className="icon-delete" />
      </div>
    );
  }
  override render() {
    const { value } = this.state;
    const { referMessage, disabled, placeholder } = this.props;
    return (
      <div
        className="ChatPanel-Textarea inputWrapper"
        ref={textareaWrapper => {
          this.textareaWrapper = textareaWrapper;
        }}
      >
        {referMessage ? this.renderMessageRefer() : undefined}
        <div>
          <Textarea
            chat={true}
            disabled={disabled}
            isFocus
            value={value}
            placeholder={placeholder}
            onChange={this.handleChange.bind(this)}
            onCompositionStart={this.handleCompositionStart.bind(this)}
            onCompositionEnd={this.handleCompositionEnd.bind(this)}
            onKeyDown={this.handleKeyDown.bind(this)}
            onKeyUp={this.handleKeyUp.bind(this)}
            onBlur={this.handleBlur.bind(this)}
            maxHeight={110}
            minHeight={50}
          />
        </div>
      </div>
    );
  }
}
