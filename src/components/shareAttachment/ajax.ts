import { dialogSelectUser } from 'ming-ui/functions';
import chatController from 'src/api/chat';
import groupController from 'src/api/group';
import taskCenterController from 'src/api/taskCenter';
import createTask from 'src/components/createTask/load';

export function _getMyTaskList(params) {
  return new Promise<ApiPayload>((resolve, reject) => {
    taskCenterController
      .getMyTaskList(params)
      .then(function (res) {
        if (!res.status) {
          reject(_l('获取数据失败'));
        } else {
          // 一个任务都没有（或搜不到）时接口只回 { status: true }、不带 data。原先把 undefined 原样交出去，
          // 列表格式化时 .map 抛错，「发任务」的选择列表就报「获取数据失败」、一直转圈，而不是显示「无搜索结果」
          resolve(res.data || []);
        }
      })
      .catch(function (err) {
        reject(err);
      });
  });
}

export function _getChatList(params) {
  return new Promise<ApiPayload>((resolve, reject) => {
    chatController
      .getChatList(params)
      .then(function (res) {
        resolve(res);
      })
      .catch(function (err) {
        console.log(err);
        reject(_l('获取数据失败'));
      });
  });
}

/** 七牛附件换成可分享的地址：本来就在图片空间的原样返回，否则让服务端转存。结果包在 { data } 里 */
export function _convertToOtherAttachment(params: { qiniuUrl: string | undefined }) {
  return new Promise<{ data: string }>((resolve, reject) => {
    if (params.qiniuUrl && params.qiniuUrl.indexOf(md.global.FileStoreConfig.pictureHost) > -1) {
      resolve({
        data: params.qiniuUrl,
      });
      return;
    }

    chatController
      .convertToOtherAttachment(params)
      .then(function (res) {
        resolve({ data: res });
      })
      .catch(function (err) {
        console.log(err);
        reject(_l('获取数据失败'));
      });
  });
}

export function createNewTask() {
  return new Promise<{ taskID: string; taskName: string }>((resolve, reject) => {
    createTask({
      relationCallback: function (result) {
        resolve({
          taskID: result.taskID,
          taskName: result.taskName,
        });
      },
    }).catch(reject);
  });
}

/** type 1 是单聊（value 为 accountId）、2 是新建的群组（value 为 groupId） */
export function createNewChat() {
  return new Promise<{ type: number; logo: string; name: string; value: string }>((resolve, reject) => {
    dialogSelectUser({
      sourceId: 0,
      fromType: 0,
      showMoreInvite: false,
      SelectUserSettings: {
        filterAccountIds: [md.global.Account.accountId],
        callback: function (data) {
          if (data.length > 1) {
            groupController
              .addDiscussionGroup({
                accountIds: data.map(function (account) {
                  return account.accountId;
                }),
              })
              .then(function (result) {
                resolve({
                  type: 2,
                  logo: result.avatar,
                  name: result.name,
                  value: result.groupId,
                });
              })
              .catch(function () {
                reject(_l('创建新聊天失败'));
              });
          } else {
            resolve({
              type: 1,
              logo: data[0].avatar,
              name: data[0].fullname,
              value: data[0].accountId,
            });
          }
        },
      },
    });
  });
}
