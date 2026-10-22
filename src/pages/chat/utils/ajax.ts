import type { ChatFileQuery, ChatCountQuery } from 'src/api/chatTypes';
import type { ChatSessionLookupRequest } from 'src/api/chatTypes';
import type { AddressBookRequest, AddressBookSearchResult } from 'src/api/addressBookTypes';
import _ from 'lodash';
import CommonAjax from 'src/api/addressBook';
import ChatController from 'src/api/chat';
import GroupController from 'src/api/group';
import CommonAjaxInvitation from 'src/api/invitation';
import PostController from 'src/api/post';
import UserController from 'src/api/user';
import { getPssId } from 'src/utils/pssId';
import type { ChatMessage } from '../redux/types';
import chatConfig from './config';
import Constant from './constant';

// `process.env` 带索引签名（noPropertyAccessFromIndexSignature），需用下标访问；运行时等价。
const isDevelopment = process.env['NODE_ENV'] === 'development';

/**
 * 获取会话列表
 * @param {*} param
 */
export const chatSessionList = (param: { pageIndex: number; pageSize: number }) => {
  return window.mdyAPI('', '', param, {
    customParseResponse: true,
    ajaxOptions: {
      type: 'GET',
      url: _.get(window, 'config.HTTP_SERVER') + '/chat_list',
    },
  });
};

/**
 * 获取当前的会话信息，包含个人和群组
 * @param {*} param
 */
/** `chatSessionItem` 的入参：只按 `type`/`value` 分流（调用方传完整会话或最小对象） */
/** `type` 来自 `SessionList.addSession` 的 `number | string`（订阅消息里两形态都出现过） */
interface ChatSessionItemParam {
  type?: number | string | undefined;
  value?: string | undefined;
}

/** `getImageContext` 的入参：图片定位/上下文翻页 */
interface ImageContextParams {
  isGroup?: boolean | undefined;
  id?: string | undefined;
  msgid?: string | number | undefined;
  size?: number | undefined;
  /** 0 全部 / 1 上文 / 2 下文 */
  type?: number | undefined;
}

/** `getFeed` 的入参（动态列表分页；函数自身还会补 postType/fType/lType/_） */
interface FeedQueryParams {
  gID?: string | undefined;
  pIndex?: number | undefined;
  pSize?: number | undefined;
  /** 两个 Feeds 调用点首屏传 null，翻页传上一条的 autoID。 */
  lastPostAutoID?: string | number | null | undefined;
  fType?: string | undefined;
  lType?: string | undefined;
  postType?: number | undefined;
  _?: number | undefined;
}

/**
 * `Files` / `Files.Panel` / `SearchPanel.Files` 构造的群/个人文件查询。
 * 字段依据同时来自真实生产点与 ChatController 两个接口的参数说明；原对象仍直接传给接口。
 */
type FileListParams = ChatFileQuery;

/** SearchPanel 按会话类型构造的计数查询，原地补入 loadTabType 后原样传递。 */
type CountByTabNameParams = ChatCountQuery;

/** `addMembers` 的入参 */
interface AddMembersParams {
  groupId?: string | undefined;
  accountIds?: string[] | undefined;
  /** Invitation.InviteUser 规定的「账号 → 姓名」字典。 */
  accounts?: Record<string, string> | undefined;
}

/** `createGroup` 的入参（历史调用方两种字段名都出现过，如实并列） */
interface CreateGroupParams {
  groupname?: string | undefined;
  useridlist?: string[] | undefined;
  /** group.addGroupMembers 当前传这个字段，但原实现仅序列化 useridlist；此处不修业务错配。 */
  accountIds?: string[] | undefined;
}

/** `createDiscussion` 的入参 */
interface CreateDiscussionParams {
  accountIds?: string[] | undefined;
}

export const chatSessionItem = (param: ChatSessionItemParam): ChatSessionLookupRequest | undefined => {
  const timeout = 3000;
  const ajaxOptions = {
    timeout,
  };

  if (param.type == Constant.SESSIONTYPE_GROUP) {
    return ChatController.getGroupInfo(
      {
        groupId: param.value,
      },
      {
        ajaxOptions,
        silent: true,
      },
    );
  } else if (param.type == Constant.SESSIONTYPE_USER) {
    return UserController.getAccountBaseInfo(
      {
        accountId: param.value,
      },
      {
        ajaxOptions,
        silent: true,
      },
    );
  }

  return undefined;
};

/**
 * 获取消息
 * @param {*} conf
 */
/**
 * `getMessage` 的查询参数。
 * 【为何不用 `Record<string, any>`】`noPropertyAccessFromIndexSignature` 下
 * 对索引签名类型只能 `obj['k']` 访问；而这里各字段是**逐个写出的**，
 * 用类型别名（对象字面量类型有隐式索引签名）既可以点访问，也仍是逐字段建模。
 */
type MessageQueryParams = {
  sincetime?: unknown;
  page?: number;
  num?: number;
  keyword?: string;
  direction?: string | number;
  /** `getPssId()` 的返回是 `string | null`（见其签名），故允许 null */
  pss_id?: string | null | undefined;
  groupid?: string | undefined;
  accountid?: string | undefined;
};

type MessageQueryByIdParams = {
  groupid?: string | undefined;
  accountId?: string | undefined;
  msgid?: string | number | undefined;
  size?: number | undefined;
};

/**
 * 拉取一页消息。
 * 【有限返回声明依据】`MessageView` 的 3 处（71/261/340）把它 `.then(res => ...)`
 * 之后直接交给 `utils.formatMessages(res)`，再作为 `setMessage`/`addPageMessage`/
 * `resetMessage` 的载荷。因此返回 `ApiResultOf<ChatMessage[]>`（仓库既有的带类型
 * 信封返回类型），只声明这一个方法的返回，不改请求/错误处理/其他接口。
 */
export const getMessage = (conf: {
  type?: number | undefined;
  id?: string | undefined;
  /**
   * 【为何是 `number | string` 而不是 `unknown`】真实调用点只有 `MessageView` 的
   * 两处，传的是 `const { time } = messageList[...] || {}` —— 即 `ChatMessage['time']`
   * 的 `number | string | undefined`。用 `unknown` 会让"传个对象进去"也编译通过，
   * 收紧后能挡住这类误用；`MessageQueryParams.sincetime` 仍是 wire 侧的 `unknown`。
   */
  sincetime?: number | string | undefined;
  page?: number | undefined;
  num?: number | undefined;
  keyword?: string | undefined;
  /** 真实调用点既传字符串方向（'up'/'down'）也传数字（`MessageView` 里有 `direction: 1`） */
  direction?: string | number | undefined;
}): ApiResultOf<ChatMessage[]> | undefined => {
  // 【返回值含 undefined 的依据】只有 `SESSIONTYPE_GROUP` / `SESSIONTYPE_USER` 两个分支
  // 会 return；其他 `conf.type` 会**落到函数末尾返回 undefined**。如实声明，不假保证。
  const param: MessageQueryParams = {};
  param.sincetime = conf.sincetime || '';
  param.page = conf.page || 1;
  // param.num = (conf.num ? conf.num : ) || chatConfig.MSG_LENGTH_MORE;
  param.num = conf.num ? conf.num + chatConfig.MSG_LENGTH_MORE : chatConfig.MSG_LENGTH_MORE;
  param.keyword = conf.keyword || '';
  param.direction = conf.direction || '';
  if (isDevelopment) {
    param.pss_id = getPssId();
  }

  if (conf.type === Constant.SESSIONTYPE_GROUP) {
    param.groupid = conf.id;
    return window.mdyAPI('', '', param, {
      customParseResponse: true,
      ajaxOptions: {
        type: 'GET',
        url: _.get(window, 'config.HTTP_SERVER') + '/group_messages',
      },
    });
  } else if (conf.type === Constant.SESSIONTYPE_USER) {
    param.accountid = conf.id;
    return window.mdyAPI('', '', param, {
      customParseResponse: true,
      ajaxOptions: {
        type: 'GET',
        url: _.get(window, 'config.HTTP_SERVER') + '/messages',
      },
    });
  }

  // 【显式返回 undefined】与原先"落到函数末尾隐式返回 undefined"**运行行为完全相同**，
  // 只是让声明了 `| undefined` 的返回类型不触发 TS7030（并非新增分支/默认值）。
  return undefined;
};

/**
 * 获取某一个消息的上下文
 * @param {*} conf
 */
export const getMessageById = (conf: {
  type?: number | undefined;
  id?: string | undefined;
  msgid?: string | number | undefined;
  size?: number | undefined;
  /** 真实调用点传的是 `config.MSG_LENGTH_MORE`（`MessageView:232`） */
  num?: number | undefined;
}) => {
  const param: MessageQueryByIdParams = {};
  let url = '';

  if (conf.type === Constant.SESSIONTYPE_GROUP) {
    param.groupid = conf.id || '';
    url = '/group_messages_byid';
  } else if (conf.type === Constant.SESSIONTYPE_USER) {
    param.accountId = conf.id || '';
    url = '/messages_byid';
  }

  param.msgid = conf.msgid || '';
  param.size = conf.size || 21;
  return window.mdyAPI('', '', param, {
    customParseResponse: true,
    ajaxOptions: {
      type: 'GET',
      url: _.get(window, 'config.HTTP_SERVER') + url,
    },
  });
};

/**
 * 获取消息流中的文件
 * @param {*} conf
 */
export const getImageContext = (conf: ImageContextParams) => {
  const param: {
    groupid?: string | number;
    accountid?: string | number;
    msgid?: string | number;
    size?: number;
    /** 0 全部 / 1 上文 / 2 下文 */
    type?: number;
  } = {};
  let url = '';

  if (conf.isGroup) {
    param.groupid = conf.id || 0;
    url = '/group_files_byid';
  } else {
    param.accountid = conf.id || 0;
    url = '/user_files_byid';
  }

  param.msgid = conf.msgid || '';
  param.size = conf.size || 20;
  param.type = conf.type || 0; // 0：表示全部上下文图片消息；1：表示上文图片消息；2：表示下文图片消息
  return window
    .mdyAPI('', '', param, {
      customParseResponse: true,
      ajaxOptions: {
        type: 'GET',
        url: _.get(window, 'config.HTTP_SERVER') + url,
      },
    })
    .then((res: unknown) => {
      if (!_.isArray(res)) {
        res = [];
      }

      return res;
    });
};

/**
 * 获取动态列表
 * @param {*} param
 */
export const getFeed = (param: FeedQueryParams) => {
  param.postType = -1;
  param.fType = param.fType ? param.fType : 'feed';
  param.lType = param.lType ? param.lType : 'group';
  param._ = new Date().getTime();

  return PostController.getPostListByLegacyPara(param);
};

/**
 * 获取文件列表
 * @param {*} param
 */
export const getFileList = (param: FileListParams) => {
  param.fileType = param.fileType || -1;
  if (param.groupId) {
    return ChatController.getGroupFileList(param);
  } else {
    return ChatController.getUserFileList(param);
  }
};

/**
 * 获取搜索数
 * @param {*} param
 */
export const getCountByTabName = (param: CountByTabNameParams) => {
  if (param.groupId) {
    param.loadTabType = 7;
    return ChatController.getGroupCountByTabName(param);
  } else {
    param.loadTabType = 6;
    return ChatController.getUserCountByTabName(param);
  }
};

export const getAllAddressbookByKeywords = (keyword: string): AddressBookRequest<AddressBookSearchResult> => {
  return CommonAjax.getAllChatAddressbookByKeywords({
    keywords: keyword,
  });
};

/**
 * 添加群组成员
 * @param {*} param
 */
export const addMembers = (param: AddMembersParams) => {
  return new Promise((resolve, reject) => {
    const obj: {
      sourceId?: string | undefined;
      fromType: number;
      accountIds?: AddMembersParams['accountIds'];
      accounts?: AddMembersParams['accounts'];
    } = {
      sourceId: param.groupId,
      fromType: 1,
    };

    if (param.accountIds) {
      obj.accountIds = param.accountIds;
    }

    if (param.accounts) {
      obj.accounts = param.accounts;
    }

    CommonAjaxInvitation.inviteUser(obj)
      .then(data => {
        resolve(data);
      })
      .catch(xhr => {
        reject(xhr);
      });
  });
};

/**
 * 创建群组
 * @param {*} param
 */
export const createGroup = (param: CreateGroupParams) => {
  return new Promise((resolve, reject) => {
    GroupController.addGroup({
      groupName: param.groupname,
      accountIds: JSON.stringify(param.useridlist),
    })
      .then(res => {
        if (res.msg == 1) {
          resolve(res.data);
        } else {
          reject(res.msg);
        }
      })
      .catch(xhr => {
        reject(xhr);
      });
  });
};

/**
 * 创建讨论组
 * @param {*} param
 */
export const createDiscussion = (param: CreateDiscussionParams) => {
  return new Promise((resolve, reject) => {
    GroupController.addDiscussionGroup({
      accountIds: param.accountIds,
    })
      .then(res => {
        resolve(res);
      })
      .catch(xhr => {
        reject(xhr);
      });
  });
};
