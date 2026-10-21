import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { browserIsMobile } from 'src/utils/common';
import { DROPDOWN_GROUPLIST, INBOXTYPES, TYPENAMES } from '../constants';
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
  inboxType: string | undefined;
  count?: number | undefined;
  weak_count?: number | undefined;
  clearUnread?: boolean | undefined;
  callback?: () => void;
  /** 外部请求信号（`updateInoxRequestNow` 写入的时间戳） */
  requestNow?: number | undefined;
}

interface InboxState {
  type: string;
  inboxFavorite: boolean;
  filter: InboxFilterValue | null;
  updateNow?: number | undefined;
}

const getInitialLoadType = (inboxType: string | undefined): string => {
  // 擦除标记：常量表按 INBOXTYPES 字面量键声明，入参是普通 string；真实调用只在已知键上命中。
  if (inboxType && (DROPDOWN_GROUPLIST as Record<string, string[] | undefined>)[inboxType]) {
    return (DROPDOWN_GROUPLIST as Record<string, string[] | undefined>)[inboxType]![0] as string;
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

  changeType = (type: string) => {
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
    const { inboxType } = this.props;
    const { type, inboxFavorite, filter } = this.state;

    const props = {
      type,
      inboxFavorite,
      inboxType,
      filter,
      title:
        INBOXTYPES.WORKSHEET === inboxType && md.global.Account.isPortal
          ? _l('消息')
          : (TYPENAMES as Record<string, string>)[inboxType as string],
      dropdownData: (DROPDOWN_GROUPLIST as Record<string, string[] | undefined>)[inboxType as string],
      changeType: this.changeType,
      changeFaviorite: this.changeFaviorite,
      // 擦除标记：筛选弹层回传的是 handleSave 产物（与 InboxFilterValue 同构；原 any 直接透传）。
      changeInboxFilter: this.changeInboxFilter as (filter: unknown) => void,
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
