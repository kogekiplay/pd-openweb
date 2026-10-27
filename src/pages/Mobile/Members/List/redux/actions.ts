import { Dialog } from 'antd-mobile';
import _ from 'lodash';
import ajaxRequest from 'src/api/appManagement';
import homeAppAjax from 'src/api/homeApp';
import type { AppDispatch } from 'src/redux/types';
import { getTranslateInfo } from 'src/utils/app';

/**
 * 真实调用点是 `getMembersList(appId, roleId)`（Members/List/index.tsx 51/266/283 行）：
 * 第二个实参一直存在，但 body 从未读过它。签名里保留这个 type-only 的 opaque 槽位，
 * 运行期仍是单形参箭头（.length 不变），也不删调用点实参。
 */
type GetMembersList = (appId: string, roleId?: unknown) => (dispatch: AppDispatch) => void;

export const getMembersList: GetMembersList = (appId: string) => (dispatch: AppDispatch) => {
  dispatch({ type: 'MOBILE_LIST_FETCH_START' });
  Promise.all([
    homeAppAjax.getApp({ appId }).then(),
    // ajaxRequest.getRoleDetail({ appId, roleId }).then(),
    ajaxRequest.getRolesWithUsers({ appId }).then(),
  ]).then(res => {
    const [detail, list] = res;
    const roleList = _.cloneDeep(list).map(item => ({
      ...item,
      name: getTranslateInfo(appId, null, item.roleId).name || item.name,
    }));

    dispatch({
      type: 'UPDATE_MEMBER_LIST',
      data: {
        detail,
        list: roleList,
      },
    });
    dispatch({ type: 'MOBILE_LIST_FETCH_SUCCESS' });
  });
};

/**
 * 删除成员：入参字段逐项对应 AppManagement.RemoveRoleMembers 的 swagger 参数文档
 * （src/api/appManagement.ts:86-104）。五个 id 数组在文档里只写 `array`、没有元素 schema，
 * 所以保持 opaque 的 unknown[]：不猜 string/ID，也不用宽索引。
 */
interface RemoveUserFromRoleParams {
  projectId?: string | undefined;
  appId: string;
  roleId: string;
  userIds: unknown[];
  departmentIds: unknown[];
  departmentTreeIds: unknown[];
  projectOrganizeIds: unknown[];
  jobIds: unknown[];
}

export const removeUserFromRole =
  ({
    projectId,
    appId,
    roleId,
    userIds,
    departmentIds,
    departmentTreeIds,
    projectOrganizeIds,
    jobIds,
  }: RemoveUserFromRoleParams) =>
  (dispatch: AppDispatch) => {
    dispatch({ type: 'MOBILE_UPDATELIST_FETCH_START' });
    ajaxRequest
      .removeRoleMembers({
        projectId,
        appId,
        roleId,
        userIds,
        departmentIds,
        departmentTreeIds,
        projectOrganizeIds,
        jobIds,
      })
      .then(data => {
        dispatch({ type: 'MOBILE_UPDATELIST_FETCH_OVER' });
        if (data.result) {
          dispatch(getMembersList(appId));
        } else {
          Dialog.alert({
            content: _l('移除失败'),
          });
        }
      });
  };

/**
 * 退出角色：唯一调用点（Members/List/index.tsx:319-327）总提供 callback，body 在
 * “非部门角色” 分支无条件调用 callback()，所以按真实生产者写成必填的 () => void。
 */
interface ExitRoleParams {
  roleId: string;
  appId: string;
  callback: () => void;
}

export const exitRole =
  ({ roleId, appId, callback }: ExitRoleParams) =>
  (dispatch: AppDispatch) => {
    dispatch({ type: 'MOBILE_UPDATELIST_FETCH_START' });
    ajaxRequest
      .quitAppForRole({
        appId,
        roleId,
      })
      .then(res => {
        dispatch({ type: 'MOBILE_UPDATELIST_FETCH_OVER' });
        if (res.isRoleForUser) {
          if (res.isRoleDepartment) {
            callback();
          } else {
            Dialog.alert({
              title: _l('无法退出非“人员”类型成员加入的角色'),
              content: _l('非“人员”类型的成员，只能由管理员或运营者操作'),
            });
          }
        } else {
          Dialog.alert({
            content: _l('退出失败'),
          });
        }
      });
  };

/**
 * 添加成员提交：入参字段逐项对应 AppManagement.AddRoleMembers 的 swagger 参数文档
 * （src/api/appManagement.ts:60-85）；四个 id 数组保留原默认值 []。
 * users 是人员选择器给出的账号对象，body 只读它的 accountId（转发为 userIds），
 * 所以只声明这个被真实读取的字段，类型复用 md.global.Account.accountId 的既有域声明
 * （可缺：SelectUser 里 currentAccount 允许是 Partial<Account>）。
 */
interface AddRoleMembersParams {
  projectId?: string | undefined;
  appId: string;
  roleId: string;
  users: Array<Partial<Pick<typeof md.global.Account, 'accountId'>>>;
  departmentIds?: unknown[] | undefined;
  departmentTreeIds?: unknown[] | undefined;
  jobIds?: unknown[] | undefined;
  projectOrganizeIds?: unknown[] | undefined;
}

export const addRoleMembers =
  ({
    projectId,
    appId,
    roleId,
    users,
    departmentIds = [],
    departmentTreeIds = [],
    jobIds = [],
    projectOrganizeIds = [],
  }: AddRoleMembersParams) =>
  (dispatch: AppDispatch) => {
    dispatch({ type: 'MOBILE_UPDATELIST_FETCH_START' });
    ajaxRequest
      .addRoleMembers({
        projectId,
        appId,
        roleId,
        userIds: _.map(users, ({ accountId }) => accountId),
        departmentIds,
        departmentTreeIds,
        jobIds,
        projectOrganizeIds,
      })
      .then(res => {
        dispatch({ type: 'MOBILE_UPDATELIST_FETCH_OVER' });
        if (res) {
          dispatch(getMembersList(appId));
        } else {
          Dialog.alert({
            content: _l('添加失败'),
          });
        }
      });
  };

/**
 * 转交他人：唯一调用点（Members/List/index.tsx:431-435）传 params.appId 与 users[0].accountId；
 * AppManagement.UpdateAppOwner 的 swagger 文档里两字段都是 string，所以按真实端点契约写成必填
 * string（原来的 appId?: string 让下面 dispatch(getMembersList(appId)) 拿到 string | undefined）。
 */
interface TransferAppParams {
  appId: string;
  memberId: string;
}

export const transferApp =
  ({ appId, memberId }: TransferAppParams) =>
  (dispatch: AppDispatch) => {
    dispatch({ type: 'MOBILE_UPDATELIST_FETCH_START' });
    ajaxRequest
      .updateAppOwner({
        appId,
        memberId,
      })
      .then(res => {
        dispatch({ type: 'MOBILE_UPDATELIST_FETCH_OVER' });
        if (res) {
          dispatch(getMembersList(appId));
        } else {
          Dialog.alert({
            content: _l('托付失败'),
          });
        }
      });
  };
