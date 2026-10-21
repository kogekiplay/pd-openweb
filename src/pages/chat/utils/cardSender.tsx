import { createRoot } from 'react-dom/client';
import moment from 'moment';
import createCalendar from 'src/components/createCalendar/load';
import createTask from 'src/components/createTask/load';
import RelationControl from 'src/components/relationControl/relationControl';
import createFeed from 'src/pages/feed/components/createFeed/load';
import { pathCompletion } from 'src/utils/common';
import createLinksForMessage from 'src/utils/createLinksForMessage';
import Constant from './constant';
import type { ChatCardDraftMessage } from '../redux/types';
import type { MessageArgs } from 'src/utils/messageLinkTypes';

/** 卡片发送方（与 `CardToolbar` 构造的会话描述同构） */
interface CardAcceptor {
  avatar?: string | undefined;
  id?: string | undefined;
  /** 从动态发起时受理人默认填成会话对象 */
  isPost?: boolean | undefined;
  projectId?: string | undefined;
  isGroup?: boolean | undefined;
  /** 会话/群名称（`newTask`/`newSchedule` 用作成员名；群聊时为 undefined，原实现同样透传） */
  name?: string | undefined;
  /** `Constant.SESSIONTYPE_USER` / `SESSIONTYPE_GROUP` */
  type: number;
}

/** 组装的出站卡片草稿（字段总是由字面量提供，故实体键为必填） */
type CardMessageDraft = {
  type: number;
  card: {
    md: string;
    entityid: string;
    url: string;
    title?: string | undefined;
    text: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** `createFeed` 的入参里本模块真正填写的字段 */
interface InitPostOptions {
  defaultType?: number | undefined;
  showType?: number | string[] | undefined;
  showSuccessTip?: boolean | undefined;
  postMsg?: string | undefined;
  isPost?: boolean | undefined;
}

/** 新建动态/投票时 `_initPost` 组装后的回调 */
type DraftCallback = (message: CardMessageDraft) => void;

/**
 * 三个真实回调载荷的**有限形状**。
 *
 * 【为什么不能用全局 `ApiPayload`】`types/global.d.ts` 里
 * `ApiPayload = Awaited<ApiResult>` 而 `ApiResult = Promise<any>` ——
 * 所以 `ApiPayload` **实际就是 `any`**，回调参数写它等于没有类型（lead 2026-10-21 反例 2）。
 * 这里改为按每个回调**真实读取的字段**声明；未读字段不开放宽索引，拼错字段名会被拒。
 */
/** 动态（Post）选择回调：`_initPost` 读 postType/postID/message/rUserList/rGroupList/categories */
interface PostSelectPayload {
  postType?: string | number | undefined;
  postID?: string | undefined;
  message?: string | undefined;
  rUserList?: MessageArgs['rUserList'];
  rGroupList?: MessageArgs['rGroupList'];
  categories?: MessageArgs['categories'];
}
/** 任务创建回调：读 status/data.data.taskID/taskName */
interface TaskCreatePayload {
  status?: boolean | undefined;
  data?:
    | {
        taskID?: string | undefined;
        taskName?: string | undefined;
      }
    | undefined;
}
/** 日程创建回调：读 calendarID/name */
interface CalendarCreatePayload {
  calendarID?: string | undefined;
  name?: string | undefined;
}

const _initPost = function (acceptor: CardAcceptor, options: InitPostOptions, callback: DraftCallback) {
  createFeed({
    defaultPostType: options.defaultType,
    showType: options.showType,
    createShare: options.showSuccessTip || false,
    postMsg: options.postMsg,
    selectGroupOptions: {
      defaultValue: options.isPost ? acceptor.id : '',
      defaultValueAllowChange: false,
    },
    callback(post: PostSelectPayload) {
      const message: CardMessageDraft = {
        type: Constant.MSGTYPE_CARD,
        card: {
          md: post.postType === '7' ? 'vote' : 'post',
          // 擦除标记：原 `ApiPayload` 实为 any，`postID` 缺失时此处得 undefined（不改行为）。
          entityid: post.postID as string,
          url: pathCompletion('/feeddetail?itemID=' + post.postID),
          title: createLinksForMessage({
            // 擦除标记：原 any 下 message 可为 undefined（createLinksForMessage 内部按假值处理，不改行为）。
            message: post.message as string,
            rUserList: post.rUserList,
            rGroupList: post.rGroupList,
            categories: post.categories,
            noLink: true,
            filterFace: true,
            filterTask: true,
          }).slice(0, 300),
          text: '',
        },
      };
      callback(message);
    },
  });
};

/**
 * 创建任务
 * @param {*} acceptor
 * @param {*} options
 */
/** 从聊天里发起「新建任务 / 新建日程」卡片时的可选参数 */
interface CardSenderOptions {
  /** 发完弹一下成功提示 */
  showSuccessTip?: boolean;
  /** 一起发出去的附言 */
  postMsg?: string;
  description?: string;
  defaultType?: number;
  showType?: number;
  /** 从动态发起时为 true，受理人默认填成会话对象 */
  isPost?: boolean;
}

export const newTask = (acceptor: CardAcceptor, options: CardSenderOptions = {}): Promise<ChatCardDraftMessage> => {
  return new Promise<ChatCardDraftMessage>((resolve, reject) => {
    let members: Array<{ accountId?: string; fullname?: string; avatar?: string }> = [];

    if (acceptor.type === Constant.SESSIONTYPE_USER && acceptor.id !== Constant.FILE_TRANSFER.id) {
      // 擦除标记：单聊受理人来自会话对象（id/name/avatar 均有值，原 any 直接透传）。
      members = [
        {
          accountId: acceptor.id as string,
          fullname: acceptor.name as string,
          avatar: acceptor.avatar as string,
        },
      ];
    }

    createTask({
      MemberArray: members,
      // 擦除标记：群聊取项目 id、单聊填空串（原 any 直接透传；缺省项目时原实现同样传 undefined）。
      ProjectID: (acceptor.isGroup ? acceptor.projectId : '') as string,
      Description: options.description || '',
      // 擦除标记：undefined 与 createTask 默认值 null 在其内部只做真值判断（原 any 直接透传）。
      createShare: options.showSuccessTip as boolean,
      callback(res: TaskCreatePayload) {
        if (res.status !== true) {
          reject(res);
          return false;
        }

        const task = res.data;
        const message: CardMessageDraft = {
          type: Constant.MSGTYPE_CARD,
          card: {
            md: 'task',
            // 擦除标记：原 any 下 `task`/`taskID`/`taskName` 缺失时得 undefined（不改行为）。
            entityid: task!.taskID as string,
            url: pathCompletion('/apps/task/task_' + task!.taskID),
            title: task!.taskName,
            text: '',
          },
        };
        resolve(message);
        return undefined;
      },
    }).catch(reject);
  });
};

/**
 * 选择任务
 * @param {*} acceptor
 * @param {*} options
 */
/**
 * 选择任务卡片。
 * 【为什么收一个不用的参数】真实调用方 `CardToolbar.onSelectTask` 传 `this.acceptor`——这是 **getter 读取**，
 * 求值本身有副作用（lead 2026-10-21 反例：抛异常 getter 必须仍抛）。函数体不读该参数，但签名必须接受它，
 * 否则调用方只能删掉实参、从而丢掉 getter 求值。参数类型宽松为 `unknown`：内部完全不用。
 */
export const selectTask: (_acceptor?: unknown) => Promise<ChatCardDraftMessage> = () => {
  return new Promise<ChatCardDraftMessage>(resolve => {
    const onSubmit = (task: { sid?: string; name?: string }) => {
      const { sid, name } = task;
      const message: CardMessageDraft = {
        type: Constant.MSGTYPE_CARD,
        card: {
          md: 'task',
          // 擦除标记：选择器回传的 sid 用于拼实体 id（原 any 直接拼接）。
          entityid: sid as string,
          url: pathCompletion('/apps/task/task_' + sid),
          title: name,
          text: '',
        },
      };
      resolve(message);
    };

    const root = createRoot(document.createElement('div'));

    root.render(<RelationControl types={[1]} onSubmit={onSubmit} />);
  });
};

/**
 * 创建日程
 * @param {*} acceptor
 * @param {*} options
 */
export const newSchedule = (acceptor: CardAcceptor, options: CardSenderOptions = {}): Promise<ChatCardDraftMessage> => {
  return new Promise<ChatCardDraftMessage>((resolve, reject) => {
    let members: Array<{ accountId?: string; fullname?: string; avatar?: string }> = [];

    if (acceptor.type === Constant.SESSIONTYPE_USER && acceptor.id !== Constant.FILE_TRANSFER.id) {
      // 擦除标记：单聊受理人来自会话对象（id/name/avatar 均有值，原 any 直接透传）。
      members = [
        {
          accountId: acceptor.id as string,
          fullname: acceptor.name as string,
          avatar: acceptor.avatar as string,
        },
      ];
    }

    createCalendar({
      MemberArray: members,
      createShare: options.showSuccessTip as boolean,
      Message: options.description || '',
      callback(calendar: CalendarCreatePayload) {
        const message: CardMessageDraft = {
          type: Constant.MSGTYPE_CARD,
          card: {
            md: 'calendar',
            // 擦除标记：原 any 下缺失时得 undefined（不改行为）。
            entityid: calendar.calendarID as string,
            url: pathCompletion('/apps/calendar/detail_' + calendar.calendarID),
            title: calendar.name,
            text: '',
          },
        };
        resolve(message);
      },
    }).catch(reject);
  });
};

/**
 * 选择日程
 * @param {*} acceptor
 */
/**
 * 选择日程卡片。
 * 同上：`_acceptor` 只用于让调用方的 `this.acceptor` 实参保持被求值（getter 副作用），函数体不读它。
 */
export const selectSchedule: (_acceptor?: unknown) => Promise<ChatCardDraftMessage> = () => {
  return new Promise<ChatCardDraftMessage>(resolve => {
    const onSubmit = (item: { sid?: string; name?: string; sidext?: string }) => {
      const { sid, name, sidext } = item;
      const message: CardMessageDraft = {
        type: Constant.MSGTYPE_CARD,
        card: {
          md: 'calendar',
          // 擦除标记：选择器回传的 sid 用于拼实体 id（原 any 直接拼接）。
          entityid: sid as string,
          url: pathCompletion('/apps/calendar/detail_' + sid),
          title: name,
          text: '',
        },
      };

      if (sidext) {
        message.card.url += '_' + moment(sidext).format('YYYYMMDDHHmmss');
        message.card.entityid += '_' + moment(sidext).format('YYYYMMDDHHmmss');
      }

      resolve(message);
    };

    const root = createRoot(document.createElement('div'));

    root.render(<RelationControl types={[3]} onSubmit={onSubmit} />);
  });
};

/**
 * 投票
 * @param {*} acceptor
 * @param {*} options
 */
export const newVote = (
  acceptor: CardAcceptor,
  options: { showSuccessTip: boolean },
): Promise<ChatCardDraftMessage> => {
  return new Promise<ChatCardDraftMessage>(resolve => {
    _initPost(
      acceptor,
      {
        defaultType: 7,
        isPost: acceptor.isPost,
        showSuccessTip: options.showSuccessTip,
        showType: ['post', 'vote'],
      },
      message => {
        resolve(message);
      },
    );
  });
};

/**
 * 动态
 * @param {*} acceptor
 * @param {*} options
 */
export const newFeed = (
  acceptor: CardAcceptor,
  options: { postMsg?: string | undefined; showSuccessTip?: boolean | undefined },
): Promise<ChatCardDraftMessage> => {
  return new Promise<ChatCardDraftMessage>(resolve => {
    _initPost(
      acceptor,
      {
        defaultType: 0,
        isPost: acceptor.isPost,
        postMsg: options.postMsg || '',
        showSuccessTip: options.showSuccessTip,
        showType: ['post', 'attachment'],
      },
      message => {
        resolve(message);
      },
    );
  });
};
