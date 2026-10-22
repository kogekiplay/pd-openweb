import type { GroupUserAction, GroupMutationAction } from './types';
export interface GroupInfoItem {
  label: string;
  key: 'name' | 'project.companyName' | 'adminUsers' | 'about' | 'users' | 'others';
  type: 'text';
  isPost?: boolean;
  require?: boolean;
}
/** Preserve native numeric/undefined property lookup without claiming a missing wire role exists. */
export function rolePropertyKey(value: number | undefined): number | 'undefined' {
  return value === undefined ? 'undefined' : value;
}

export const GROUP_INFOS: GroupInfoItem[] = [
  {
    label: _l('群名称'),
    key: 'name',
    type: 'text',
  },
  {
    label: _l('所属组织'),
    key: 'project.companyName',
    type: 'text',
    isPost: true,
    require: true,
  },
  {
    label: _l('群主/管理员'),
    key: 'adminUsers',
    type: 'text',
    isPost: true,
  },
  {
    label: _l('群公告'),
    key: 'about',
    type: 'text',
    isPost: true,
  },
  {
    label: _l('群成员'),
    key: 'users',
    type: 'text',
  },
  {
    label: _l('其他'),
    key: 'others',
    type: 'text',
  },
];

export const USER_ACTIONS: { text: string; value: GroupUserAction }[] = [
  {
    text: _l('管理员'),
    value: 1,
  },
  {
    text: _l('成员'),
    value: 0,
  },
  {
    text: _l('移出群组'),
    value: 3,
  },
];

export const USER_ACTIONS_MAP: Partial<Record<number | 'undefined', string>> = {
  0: _l('成员'),
  1: _l('管理员'),
};

type ActionMethod = 'removeAdmin' | 'addAdmin' | 'removeUser' | 'updateGroupHidden' | 'updateGroupForbidInvite' | 'updateGroupVerified' | 'updateGroupApproval' | 'closeGroup' | 'removeGroup' | 'exitGroup' | 'updateGroupPushNotice' | 'updateGroupToPost';
export const USER_ACTION_AJAX: Record<GroupUserAction | GroupMutationAction, ActionMethod> & Partial<Record<number | 'undefined', ActionMethod>> = {
  0: 'removeAdmin',
  1: 'addAdmin',
  3: 'removeUser',
  4: 'updateGroupHidden',
  5: 'updateGroupForbidInvite',
  6: 'updateGroupVerified',
  7: 'updateGroupApproval',
  8: 'closeGroup',
  9: 'removeGroup',
  10: 'exitGroup',
  11: 'updateGroupPushNotice',
  12: 'updateGroupToPost',
} as const;

export const USER_ACTION_MAP: Record<GroupUserAction | GroupMutationAction, string> & Partial<Record<number | 'undefined', string>> = {
  1: 'ADD_ADMIN',
  0: 'REMOVE_ADMIN',
  3: 'REMOVE_USER',
  4: 'ADD_IN_COMPANY',
  5: 'FORBID_INVITE',
  6: 'VERIFY',
  7: 'APPROVE',
  8: 'CLOSE_GROUP',
  9: 'DELETE',
  10: 'EXIT_GROUP',
  11: 'TROUBLE_FREE',
  12: 'UPDATE_POST',
} as const;

export const BUTTONS = [
  {
    label: _l('关闭群组'),
    chatLabel: _l('关闭聊天'),
    key: 0,
    desc: _l('关闭群组后，群组将不能被访问。您可以在 组织管理-群组 中找到并重新开启这个群组'),
    chatDesc: undefined,
    isPost: true,
    isAdmin: true,
  },
  {
    label: _l('解散群组'),
    chatLabel: _l('解散聊天'),
    key: 1,
    chatDesc: _l('聊天解散后，将永久删除该聊天。不可恢复'),
    isAdmin: true,
    red: true,
    splintLine: true,
  },
  {
    label: _l('退出群组'),
    chatLabel: _l('退出聊天'),
    key: 2,
    red: true,
  },
];
