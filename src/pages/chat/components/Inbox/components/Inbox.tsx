import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { browserIsMobile } from 'src/utils/common';
import { DROPDOWN_GROUPLIST, INBOXTYPES, TYPENAMES } from '../constants';
import type { InboxType, InboxLoadType } from '../constants';
import { requireInboxType } from '../identity';
import InboxHeader from './inboxHeader';
import InboxList from './inboxList';
import '../style.less';
import type { InboxFilterValue } from '../util';

/** 筛选器回传值（与 `inboxList` 的筛选条件结构一致；本组件只透传） */
interface InboxProps {
  /**
   * `INBOXTYPES` 的键（'post'/'calendar'/…）。
   * 【为何可缺省】父级 `ChatPanel.renderInbox(item: ChatSession)` 传的是 `item.id`，
   * 而 `ChatSession.id` 类型上可缺省（运行期收件箱项必有 id）。这里如实承接，不补默认值。
   */
  inboxType: InboxType | undefined;
  count?: number | undefined;
  weak_count?: number | undefined;
  clearUnread?: boolean | undefined;
  callback?: () => void;
  /** 外部请求信号（`updateInoxRequestNow` 写入的时间戳） */
  requestNow?: number | undefined;
}

interface InboxState {
  type: InboxLoadType | undefined;
  inboxFavorite: boolean;
  filter: InboxFilterValue | null;
  updateNow?: number | undefined;
}

const getInitialLoadType = (inboxType: InboxType | undefined): InboxLoadType | undefined => {
  if (inboxType && Object.hasOwn(DROPDOWN_GROUPLIST, inboxType) && DROPDOWN_GROUPLIST[inboxType]) {
    return DROPDOWN_GROUPLIST[inboxType][0];
  } else {
    throw new Error('type in options not recognized!');
  }
};

export default class Inbox extends React.Component<InboxProps, InboxState> {
  static INBOXTYPES = INBOXTYPES;

  static override propTypes = {
    inboxType: PropTypes.oneOf(_.values(INBOXTYPES)).isRequired,
    clearUnread: PropTypes.bool,
    callback: PropTypes.func,
  };

  static defaultProps = {
    clearUnread: false,
    callback: () => {},
  };

  override state: InboxState = {
    type: getInitialLoadType(this.props.inboxType),
    inboxFavorite: false,
    filter: null,
    updateNow: undefined,
  };

  override componentDidUpdate(prevProps: InboxProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.inboxType !== prevProps.inboxType || this.props.count !== prevProps.count) {
        this.setState({
          filter: null,
          type: getInitialLoadType(this.props.inboxType),
        });
      }
    }
  }

  changeType = (type: InboxLoadType | undefined) => {
    this.setState({
      type,
    });
  };

  changeUpdateNow = () => {
    this.setState({
      updateNow: Date.now(),
    });
  };

  changeFaviorite = (inboxFavorite: boolean) => {
    this.setState({
      inboxFavorite,
    });
  };

  changeInboxFilter = (filter: InboxFilterValue | null) => {
    this.setState({
      filter,
    });
  };

  renderHeader() {
    const inboxType = requireInboxType(this.props.inboxType);
    const { type, inboxFavorite, filter } = this.state;

    const props = {
      type,
      inboxFavorite,
      inboxType,
      filter,
      title:
        INBOXTYPES.WORKSHEET === inboxType && md.global.Account.isPortal
          ? _l('消息')
          : TYPENAMES[inboxType],
      dropdownData: DROPDOWN_GROUPLIST[inboxType],
      changeType: this.changeType,
      changeFaviorite: this.changeFaviorite,
      changeInboxFilter: this.changeInboxFilter,
      changeUpdateNow: this.changeUpdateNow,
    };
    return <InboxHeader {...props} />;
  }

  renderList() {
    const { type, inboxFavorite, filter, updateNow } = this.state;
    const { clearUnread, inboxType, count, weak_count, requestNow } = this.props;
    return (
      <InboxList
        {...{
          type,
          inboxFavorite,
          clearUnread,
          inboxType,
          count,
          // 擦除标记：inboxType 类型上可缺省；原实现直接 includes(undefined) → false，运行不变。
          weak_count: ['calendar'].includes(inboxType as string) ? weak_count : undefined,
          filter,
          updateNow,
          requestNow,
        }}
      />
    );
  }

  override render() {
    return (
      <div className="flexColumn h100">
        {md.global.Account.isPortal && browserIsMobile() ? null : this.renderHeader()}
        {this.renderList()}
      </div>
    );
  }
}
