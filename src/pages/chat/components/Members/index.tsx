import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import { LoadDiv, UserCard } from 'ming-ui';
import GroupController from 'src/api/group';
import InviteOrAddUsers from './InviteOrAddUsers';
import type { ChatSession } from '../../redux/types';
import './index.less';

import type { GroupMember } from 'src/api/groupTypes';

export interface AvatarProps {
  id?: string | undefined;
  avatar?: string | undefined;
  projectId?: string | undefined;
}

export interface MembersProps {
  session: ChatSession;
  /** 父级切换右侧面板可见性（本组件在「所有成员」处 bind(true) 调用） */
  onSetPanelVisible: (visible: boolean) => void;
}

export interface MembersState {
  members: GroupMember[] | null | undefined;
  loading: boolean;
  groupMemberCount?: number | undefined;
}

class Avatar extends Component<AvatarProps> {
  declare avatar: HTMLImageElement | null | undefined;

  constructor(props: AvatarProps) {
    super(props);
  }

  override render() {
    const { id, avatar, projectId } = this.props;

    return (
      <UserCard sourceId={id || ''} disabled={!id} projectId={projectId}>
        <img
          ref={avatar => {
            this.avatar = avatar;
          }}
          src={avatar}
        />
      </UserCard>
    );
  }
}

export default class Members extends Component<MembersProps, MembersState> {
  constructor(props: MembersProps) {
    super(props);
    this.state = {
      members: [],
      loading: true,
      groupMemberCount: 0,
    };
  }

  override componentDidUpdate(prevProps: MembersProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { session } = this.props;

      if (session.groupMemberCount !== this.state.groupMemberCount) {
        this.getGroupUsers();
      }
    }
  }
  override componentDidMount() {
    const { groupMemberCount, groupUsers } = this.props.session;
    this.setState({
      loading: false,
      // Keep the session producer array/missing value unchanged.
      members: groupUsers,
      groupMemberCount: groupMemberCount,
    });
  }
  getGroupUsers() {
    const { session } = this.props;
    GroupController.getGroupUsers({
      groupId: session.id,
      pageSize: 8,
      type: 1,
    }).then(result => {
      const { groupUsers } = result;
      this.setState({
        loading: false,
        members: groupUsers,
        groupMemberCount: session.groupMemberCount,
      });
    });
  }

  override render() {
    const { session } = this.props;
    const { groupMemberCount, isPost } = session;
    const { loading, members } = this.state;
    const hideChat = md.global.SysSettings.forbidSuites.includes('6');

    return (
      <div className="ChatPanel-Members ChatPanel-sessionInfo-item">
        <div className="ChatPanel-Members-hander ChatPanel-sessionInfo-hander">
          <span>
            {isPost ? _l('群成员') : _l('成员')} ({groupMemberCount}){!hideChat && <InviteOrAddUsers {...session} />}
          </span>
          <span
            onClick={this.props.onSetPanelVisible.bind(this, true)}
            className="ChatPanel-sessionInfo-hander-entry colorPrimary"
          >
            {' '}
            {_l('所有成员')}
            <i className="icon-arrow-right-border" />{' '}
          </span>
        </div>
        <div className="ChatPanel-Members-body">
          <div className="ChatPanel-Members-list">
            {members?.map((item, index: number) => (
              <div
                key={item.accountId}
                className={cx('ChatPanel-Members-item', { 'ChatPanel-Members-creator': index === 0 })}
              >
                <Avatar
                  id={item.accountId}
                  avatar={item.avatar}
                  // The session project uses the shared finite GroupProject model.
                  projectId={_.get<Pick<ChatSession, 'project'>, 'project.projectId'>(session, 'project.projectId')}
                />
              </div>
            ))}
            {loading ? <LoadDiv size="small" /> : undefined}
          </div>
        </div>
      </div>
    );
  }
}
