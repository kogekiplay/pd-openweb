import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import { ScrollView } from 'ming-ui';
import LoadDiv from 'ming-ui/components/LoadDiv';
import { htmlDecodeReg, htmlEncodeReg } from 'src/utils/common';
import * as ajax from '../../utils/ajax';
import Constant from '../../utils/constant';
import { formatMsgDate } from '../../utils';
import type { ChatMessage, ChatSession } from '../../redux/types';

/** Search consumes raw HTTP rows; missing text/sender fields remain visible as absent data. */
export interface SearchMessageInput extends Pick<ChatMessage, 'id' | 'time'> {
  msg?: Pick<NonNullable<ChatMessage['msg']>, 'con'> | null | undefined;
  fromAccount?: Pick<NonNullable<ChatMessage['fromAccount']>, 'logo' | 'name'> | null | undefined;
}
export type SearchMessageRow = SearchMessageInput & { content: string };

export interface SearchMessagesProps {
  session: ChatSession;
  /** 搜索关键词（父级 `ChatPanelSessionInfo` 的 `searchText: string` 透传） */
  searchText: string;
  /** 跳到某条消息（父级 `ChatPanelSessionInfo.handleGotoMessage`，只取 `id`） */
  onGotoMessage: (message: Pick<ChatMessage, 'id'>) => void;
}

export interface SearchMessagesState {
  loading: boolean;
  pageIndex: number;
  messages: SearchMessageRow[];
}

const format = (keyword: string, messages: SearchMessageInput[]): SearchMessageRow[] => {
  return messages.map(item => {
    const time = item.time;
    if (typeof time === 'number') {
      item.time = formatMsgDate(time);
    } else if (time !== undefined) {
      item.time = time.replace(/(^.*)(:\d\d\..*$)/, '$1');
    }
    return Object.assign(item, { content: highlightMessageText(keyword, item.msg?.con) });
  });
};

const highlightMessageText = (keyword: string, message: unknown): string => {
  let text = htmlDecodeReg(message);
  const ellipsisIndex = 25;
  const firstIndex = text.indexOf(keyword);

  if (firstIndex > ellipsisIndex) {
    text = '...' + text.slice(firstIndex - ellipsisIndex);
  }

  const reg = new RegExp(_.escapeRegExp(keyword), 'g');
  text = htmlEncodeReg(text.replace(reg, '*#span1#*' + keyword + '*#span2#*'));
  text = text.replace(/\*#span1#\*/g, '<span class="colorPrimary">').replace(/\*#span2#\*/g, '</span>');
  return text;
};

export default class Messages extends Component<SearchMessagesProps, SearchMessagesState> {
  constructor(props: SearchMessagesProps) {
    super(props);
    this.state = {
      loading: false,
      pageIndex: 1,
      messages: [],
    };
  }
  override componentDidMount() {
    const { searchText } = this.props;
    this.updateMessages(searchText);
  }

  override componentDidUpdate(prevProps: SearchMessagesProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.searchText !== prevProps.searchText) {
        this.setState(
          {
            loading: false,
            pageIndex: 1,
            messages: [],
          },
          () => {
            this.updateMessages(this.props.searchText);
          },
        );
      }
    }
  }
    updateMessages(searchText: string) {
    const { session } = this.props;
    const type = session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
    const { loading, pageIndex, messages } = this.state;
    const input: SearchMessageInput[] = messages;

    if (loading || !pageIndex) {
      return;
    }

    this.setState({
      loading: true,
    });
    ajax
      .getMessage({
        id: session.id,
        type,
        page: pageIndex,
        keyword: searchText,
      })! // 擦除标记（零运行时）：`getMessage` 在其它 `conf.type` 分支会落空返回 undefined；
      // 这里保留基线的原生行为（若真落空，随后 `.then` 仍抛 TypeError），不新增守卫/默认值。
      .then(res => {
        // res = res.reverse();
        this.setState({
          pageIndex: res && res.length >= 10 ? pageIndex + 1 : 0,
          loading: false,
          messages: format(searchText, input.concat(res || [])),
        });
      });
  }
  handleScrollEnd() {
    const { searchText } = this.props;
    this.updateMessages(searchText);
  }
    renderMessage(message: SearchMessageRow) {
    const { id, fromAccount, time, content } = message;
    return (
      <div className="search-message" key={id} onClick={this.props.onGotoMessage.bind(this, message)}>
        <div className="search-message-info">
          <div className="userAvatar">
              {/* 缺失发送者只保留空字段，不伪造身份。 */}
              <img src={fromAccount?.logo} />
          </div>
              <div className="userName overflow_ellipsis">{fromAccount?.name}</div>
          <div className="time">{time}</div>
        </div>
              {/* 擦除标记：`content` 由 format 写入；既有行为直接交给 dangerouslySetInnerHTML */}
              <div className="search-message-content" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }
  override render() {
    const { messages, loading } = this.state;
    return (
      <ScrollView
        className="ChatPanel-SearchPanelContent ChatPanel-SearchPanel-Message"
        onScrollEnd={this.handleScrollEnd.bind(this)}
      >
        {messages.map(item => this.renderMessage(item))}
        <LoadDiv className={cx('loading', { Hidden: !loading })} size="small" />
        {!loading && !messages.length ? (
          <div className="nodata-wrapper">
            <div className="nodata-img" />
            <p>{_l('无匹配结果')}</p>
          </div>
        ) : undefined}
      </ScrollView>
    );
  }
}
