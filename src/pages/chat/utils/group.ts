import { dialogSelectUser } from 'ming-ui/functions';
import { existAccountHint } from 'src/utils/inviteCommon';
import * as ajax from './ajax';
import Constant from './constant';

/** 选择用户弹层回调的用户行（`dialogSelectUser` 的真实载荷；accountId 必有，其余可选） */
interface SelectedUser {
  accountId: string;
  fullname?: string | undefined;
  avatar?: string | undefined;
  job?: string | undefined;
  department?: string | undefined;
  egroup?: string | undefined;
}

/**
 * 未创建讨论组时返回实际选中用户；创建后原样转发回执，当前三个调用方不读取回执内部。
 * 用第二个实参区分两条真实路径，不把不透明回执断言成用户数组。
 */
export type DiscussionCallbackArgs = [users: [SelectedUser], isCreated: false] | [receipt: unknown, isCreated: true];

/** `showInviteBox` 的入参（调用方真实传入的字段并集） */
interface InviteBoxOptions {
  sourceId?: string | undefined;
  fromType?: number | undefined;
  projectId?: string | undefined;
  /** 预过滤的账号 id（默认过滤当前登录账号） */
  filterList?: string[] | undefined;
  /** 个人聊天里预过滤的用户 id（`addGroupMembers` 个人分支） */
  filterUserIDs?: (string | undefined)[] | undefined;
  /** 选择完成回调；返回 `false` 可中断（`createDiscussion` 单人选自己） */
  callback?: (data: SelectedUser[]) => boolean | void;
}

/** `addGroupMembers` 的会话入参（父级传 ChatSession 的这三个字段） */
interface GroupSessionParam {
  id?: string | undefined;
  type?: number | undefined;
  projectId?: string | undefined;
}

const showInviteBox = (options: InviteBoxOptions) => {
  let param = {
    sourceId: options.sourceId,
    fromType: options.fromType,
    isChat: true,
    SelectUserSettings: {
      projectId: options.projectId,
      filterAccountIds: options.filterList || [md.global.Account.accountId],
      callback(data: SelectedUser[]) {
        if (typeof options.callback === 'function') {
          options.callback(data);
        }
      },
    },
  };

  dialogSelectUser(param);
};

export const addGroupMembers = (session: GroupSessionParam) => {
  const current = md.global.Account;
  const { id, type, projectId } = session;

  const callback = (userlist: SelectedUser[]) => {
    const accountIds: string[] = [];
    const users: {
      id: string;
      name?: string | undefined;
      avatar?: string | undefined;
      job?: string | undefined;
      department?: string | undefined;
      egroup?: string | undefined;
    }[] = [];

    for (let i = 0; i < userlist.length; i++) {
      // 擦除标记：循环变量 i 在 length 范围内（原 any 直接索引）。
      const accountId = userlist[i]!.accountId;

      // 过滤自己和当前用户
      if (accountId !== current.accountId || accountId !== id) {
        // id数组，ajax请求的参数
        accountIds.push(userlist[i]!.accountId);
        // Object，插入DOM
        users.push({
          id: userlist[i]!.accountId,
          name: userlist[i]!.fullname,
          avatar: userlist[i]!.avatar,
          job: userlist[i]!.job,
          department: userlist[i]!.department,
          egroup: userlist[i]!.egroup,
        });
      }
    }

    if (type == Constant.SESSIONTYPE_GROUP) {
      // 添加群组成员
      ajax
        .addMembers({
          groupId: id,
          accountIds,
        })
        .then(data => {
          existAccountHint(data);
        });
    } else if (type === Constant.SESSIONTYPE_USER) {
      ajax
        .createGroup({
          groupname: '',
          accountIds,
        })
        .then(() => {
          // console.log('createGroup', group);
          // // 聊天不添加到群组列表
          // ChatPubSubHelper.publish(ACTIONS.OPEN_CHAT_WINDOW, {
          //   id: group.groupId,
          //   type: Constant.USERTYPE_GROUP,
          // });
        });
    }
  };

  if (type == Constant.SESSIONTYPE_GROUP) {
    showInviteBox({
      sourceId: id,
      fromType: 1,
      projectId,
      callback,
    });
  } else {
    // 个人聊天中创建聊天
    showInviteBox({
      sourceId: current.accountId,
      fromType: 0,
      callback,
      filterUserIDs: [id, current.accountId],
    });
  }
};

/**
 * 创建讨论组
 * @param {*} accountid
 */
export const createDiscussion = (
  accountid?: string,
  cb?: (...result: DiscussionCallbackArgs) => void,
) => {
  const current = md.global.Account;
  const filterList = [current.accountId];

  if (accountid) {
    filterList.push(accountid);
  }

  showInviteBox({
    sourceId: current.accountId,
    fromType: 0,
    filterList,
    callback(accounts) {
      if (accounts.length === 1 && !accountid) {
        // 当前分支已验证恰好一个用户；只窄化数组长度，不重新解释行字段。
        cb && cb(accounts as [SelectedUser], false);
        return false;
      }

      const accountIds = [];
      accounts.map(account => {
        if (account.accountId !== md.global.Account.accountId || account.accountId !== accountid) {
          accountIds.push(account.accountId);
        }
      });
      if (accountid) {
        accountIds.push(accountid);
      }

      ajax
        .createDiscussion({
          accountIds,
        })
        .then(data => {
          cb && cb(data, true);
        });
      return undefined;
    },
  });
};
