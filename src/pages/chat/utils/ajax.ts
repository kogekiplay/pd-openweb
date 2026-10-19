import type { ChatMessage } from '../redux/types';
import _ from 'lodash';
import CommonAjax from 'src/api/addressBook';
import ChatController from 'src/api/chat';
import GroupController from 'src/api/group';
import CommonAjaxInvitation from 'src/api/invitation';
import PostController from 'src/api/post';
import UserController from 'src/api/user';
import { getPssId } from 'src/utils/pssId';
import chatConfig from './config';
import Constant from './constant';

const isDevelopment = process.env.NODE_ENV === 'development';

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
export const chatSessionItem = param => {
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
  type?: number;
  id?: string;
  /**
   * 【为何是 `number | string` 而不是 `unknown`】真实调用点只有 `MessageView` 的
   * 两处，传的是 `const { time } = messageList[...] || {}` —— 即 `ChatMessage['time']`
   * 的 `number | string | undefined`。用 `unknown` 会让"传个对象进去"也编译通过，
   * 收紧后能挡住这类误用；`MessageQueryParams.sincetime` 仍是 wire 侧的 `unknown`。
   */
  sincetime?: number | string;
  page?: number;
  num?: number;
  keyword?: string;
  /** 真实调用点既传字符串方向（'up'/'down'）也传数字（`MessageView` 里有 `direction: 1`） */
  direction?: string | number;
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
  type?: number;
  id?: string;
  msgid?: string | number;
  size?: number;
  /** 真实调用点传的是 `config.MSG_LENGTH_MORE`（`MessageView:232`） */
  num?: number;
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
export const getImageContext = conf => {
  const param: Record<string, any> = {};
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
    .then(res => {
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
export const getFeed = param => {
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
export const getFileList = param => {
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
export const getCountByTabName = param => {
  if (param.groupId) {
    param.loadTabType = 7;
    return ChatController.getGroupCountByTabName(param);
  } else {
    param.loadTabType = 6;
    return ChatController.getUserCountByTabName(param);
  }
};

export const getAllAddressbookByKeywords = keyword => {
  return CommonAjax.getAllChatAddressbookByKeywords({
    keywords: keyword,
  });
};

/**
 * 添加群组成员
 * @param {*} param
 */
export const addMembers = param => {
  return new Promise((resolve, reject) => {
    const obj = {
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
export const createGroup = param => {
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
export const createDiscussion = param => {
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
