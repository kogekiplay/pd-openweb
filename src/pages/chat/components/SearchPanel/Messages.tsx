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

const format = (keyword, messages) => {
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

const highlightMessageText = (keyword, message) => {
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

export default class Messages extends Component<any, any> {
  constructor(props) {
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

  override componentDidUpdate(prevProps) {
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
  updateMessages(searchText) {
    const { session } = this.props;
    const type = session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER;
    const { loading, pageIndex, messages } = this.state;

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
          messages: format(searchText, messages.concat(res || [])),
        });
      });
  }
  handleScrollEnd() {
    const { searchText } = this.props;
    this.updateMessages(searchText);
  }
  renderMessage(message) {
    const { id, fromAccount, time, content } = message;
    return (
      <div className="search-message" key={id} onClick={this.props.onGotoMessage.bind(this, message)}>
        <div className="search-message-info">
          <div className="userAvatar">
            <img src={fromAccount?.logo} />
          </div>
          <div className="userName overflow_ellipsis">{fromAccount?.name}</div>
          <div className="time">{time}</div>
        </div>
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
