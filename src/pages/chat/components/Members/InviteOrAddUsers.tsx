import { Component } from 'react';
import { Dropdown, Menu } from 'antd';
import addFriends from 'src/components/addFriends';
import Constant from '../../utils/constant';
import { addGroupMembers } from '../../utils/group';

const ITEMS = [
  {
    value: 'addUsers',
    text: _l('从通讯录添加'),
  },
  {
    value: 'inviteUsers',
    text: _l('更多邀请'),
  },
];

import type { ChatSession } from '../../redux/types';

export type InviteOrAddUsersProps = Pick<ChatSession, 'isAdmin' | 'isForbidInvite' | 'id' | 'groupId' | 'name' | 'project'>;

export default class InviteOrAddUsers extends Component<InviteOrAddUsersProps, Record<string, never>> {
  declare $wrap: HTMLSpanElement | null | undefined;

  constructor(props: InviteOrAddUsersProps) {
    super(props);
    this.state = {};
  }

  handleClick = ({ key }: { key: string }) => {
    const { isAdmin, isForbidInvite, id, groupId, name, project = {} } = this.props;

    if (key === 'addUsers') {
      if (isAdmin || !isForbidInvite) {
        addGroupMembers({
          id: id,
          type: Constant.SESSIONTYPE_GROUP,
          projectId: project?.projectId,
        });
      } else {
        alert(_l('当前仅允许群主及管理员邀请新成员'), 2);
        return false;
      }
    } else {
      addFriends({
        projectId: groupId,
        fromType: 1,
        fromText: name,
      });
    }
    return undefined;
  };

  override render() {
    return (
      <Dropdown
        trigger={['click']}
        placement="bottom"
        classNames={{ root: "addMembersMoreAction" }}
        popupRender={() => <Menu onClick={this.handleClick}>
            {ITEMS.map(i => (
              <Menu.Item key={i.value}>
                <span>{i.text}</span>
              </Menu.Item>
            ))}
          </Menu>}
      >
        <span className="Hand textTertiary hoverColorPrimary icon-invite Font18" ref={con => { this.$wrap = con; }}></span>
      </Dropdown>
    );
  }
}
