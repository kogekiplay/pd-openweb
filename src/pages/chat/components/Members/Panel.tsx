import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import { ScrollView } from 'ming-ui';
import Dropdown from 'ming-ui/components/Dropdown';
import LoadDiv from 'ming-ui/components/LoadDiv';
import GroupController from 'src/api/group';
import type { ChatSession } from '../../redux/types';
import InviteOrAddUsers from './InviteOrAddUsers';

/** The actual Group API supplies the shared flat member view. */
export type MemberItem = import('src/api/groupTypes').GroupMember;

export interface MemberProps {
  item: MemberItem;
  /** 打开与某成员的会话（父级 `ChatPanelSessionInfo.handleOpenSession`） */
  onOpenSession: (item: MemberItem) => void;
}

export class Member extends Component<MemberProps> {
  constructor(props: MemberProps) {
    super(props);
  }
  override render() {
    const { item } = this.props;
    const { accountId } = md.global.Account;
    return (
      <div className="ChatPanel-Member-item">
        <div className="userAvatar">
          <img src={item.avatar} />
        </div>
        <div className="userInfo">
          <div className="name" title={item.fullname}>
            {item.fullname}
          </div>
          {item.groupUserRole === 1 ? <i className="icon-crown" /> : undefined}
          <div className="memberInfo">
            {item.companyName ? <span>{item.companyName}</span> : undefined}
            {item.job ? <span>{item.job}</span> : undefined}
          </div>
        </div>
        {accountId === item.accountId ? undefined : (
          <div className="userAction" onClick={this.props.onOpenSession.bind(this, item)}>
            <i className="colorPrimary icon-chat-session" />
          </div>
        )}
      </div>
    );
  }
}

export interface MembersPanelProps {
  session: ChatSession;
  /** 面板显隐（父级 `handleSetPanelVisible.bind(this, 'members')`） */
  onSetPanelVisible: (visible: boolean) => void;
  /** 打开与某成员的会话（与 `Member` 的同一回调） */
  onOpenSession: (item: MemberItem) => void;
}

export interface MembersPanelState {
  pageIndex: number;
  loading: boolean;
  members: MemberItem[];
  dropdownData: { text: string; value: number }[];
  /** `Dropdown.onChange` 的真实实参含 `undefined`，如实保持 */
  dropdownValue: number | undefined;
  /** 服务端成员总数；响应缺省时如实保持 `undefined` */
  groupMemberCount?: number | undefined;
}

export default class MembersPanel extends Component<MembersPanelProps, MembersPanelState> {
  constructor(props: MembersPanelProps) {
    super(props);
    this.state = {
      pageIndex: 1,
      loading: false,
      members: [],
      dropdownData: [
        { text: _l('全部'), value: 1 },
        { text: _l('仅显示其他协作关系'), value: 4 },
      ],
      dropdownValue: 1,
      groupMemberCount: 0,
    };
  }

  override componentDidUpdate(prevProps: MembersPanelProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { session } = this.props;

      if (session.groupMemberCount !== this.state.groupMemberCount) {
        this.setState(
          {
            pageIndex: 1,
            loading: false,
            members: [],
          },
          () => {
            this.getGroupUsers();
          },
        );
      }
    }
  }
  override componentDidMount() {
    this.getGroupUsers();
  }
  getGroupUsers() {
    const { session } = this.props;
    const { members, loading, pageIndex, dropdownValue } = this.state;

    if (loading || !pageIndex) {
      return;
    }

    this.setState({
      loading: true,
    });
    GroupController.getGroupUsers({
      groupId: session.id,
      pageIndex,
      pageSize: 15,
      type: dropdownValue,
    }).then(result => {
      const { groupUsers, groupMemberCount } = result;
      this.setState({
        pageIndex: groupUsers.length >= 15 ? pageIndex + 1 : 0,
        loading: false,
        members: members.concat(groupUsers),
        groupMemberCount,
      });
    });
  }
  handleDropdownChange(value: number | undefined) {
    this.setState(
      {
        pageIndex: 1,
        loading: false,
        dropdownValue: value,
        members: [],
      },
      () => {
        this.getGroupUsers();
      },
    );
  }
  handleScrollEnd() {
    this.getGroupUsers();
  }

  override render() {
    const { dropdownValue, dropdownData, loading, members } = this.state;
    const { session } = this.props;
    const { groupMemberCount } = session;
    const hideChat = md.global.SysSettings.forbidSuites.includes('6');
    return (
      <div className="ChatPanel-MembersPanel">
        <div className="header">
          <span className="slideInfoBar colorPrimary" onClick={this.props.onSetPanelVisible.bind(this, false)}>
            <i className="icon-arrow-left-border" />
            {_l('返回')}
          </span>
          <span className="title">{`${_l('成员')} (${groupMemberCount})`}</span>
          {!hideChat && <InviteOrAddUsers {...session} />}
        </div>
        <div className="filter">
          <Dropdown
            className="dropdown"
            value={dropdownValue}
            data={dropdownData}
            onChange={this.handleDropdownChange.bind(this)}
          />
        </div>
        <div className="content">
          <ScrollView onScrollEnd={this.handleScrollEnd.bind(this)} className="flex">
            {members.map((item: MemberItem) => (
              <Member item={item} key={item.accountId} onOpenSession={this.props.onOpenSession} />
            ))}
            <LoadDiv className={cx({ Hidden: !loading })} size="small" />
          </ScrollView>
        </div>
      </div>
    );
  }
}
