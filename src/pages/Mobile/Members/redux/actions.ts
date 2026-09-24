import ajaxRequest from 'src/api/appManagement';
import homeAppAjax from 'src/api/homeApp';
import { APP_ROLE_TYPE } from 'src/pages/worksheet/constants/enum.js';
import type { AppDispatch, GetState } from 'src/redux/types';
import { getTranslateInfo } from 'src/utils/app';

// 申请状况
const getAppApplyInfo = (appId: string) => (dispatch: AppDispatch, getState: GetState) => {
  const { memberData } = getState().mobile;
  ajaxRequest.getAppApplyInfo({ appId }).then(res => {
    dispatch({
      type: 'UPDATE_MEMBER_DATA',
      data: {
        ...memberData,
        applyList: res,
      },
    });
    dispatch({ type: 'MOBILE_FETCH_MEMBER_SUCCESS' });
  });
};

export const getMembers = (appId: string) => dispatch => {
  dispatch({ type: 'MOBILE_FETCH_MEMBER_START' });
  Promise.all([
    homeAppAjax.getApp({ appId }).then(),
    // 根据应用获取角色
    ajaxRequest.getRolesWithUsers({ appId }).then(),
    // 获取成员是否可角色见列表状态
    window.isPublicApp ? undefined : ajaxRequest.getAppRoleSetting({ appId }).then(),
  ]).then(result => {
    // 公开应用不取角色可见设置（第三项是 undefined）
    const [detail, list, rolesVisibleConfig] = result;
    const isAdmin =
      detail.permissionType === APP_ROLE_TYPE.POSSESS_ROLE || detail.permissionType === APP_ROLE_TYPE.ADMIN_ROLE;
    const listData = list.map(
      ({
        roleType,
        roleId,
        name,
        users,
        description,
        permissionWay,
        departmentTreesInfos = [],
        jobInfos = [],
        projectOrganizeInfos = [],
      }) => {
        const translateInfo = getTranslateInfo(appId, null, roleId);
        return {
          users,
          roleId,
          roleType,
          label: translateInfo.name || name,
          description: translateInfo.description || description,
          permissionWay,
          count: users.length + departmentTreesInfos.length + jobInfos.length + projectOrganizeInfos.length,
        };
      },
    );

    dispatch({
      type: 'UPDATE_MEMBER_DATA',
      data: {
        detail,
        listData,
        rolesVisibleConfig: rolesVisibleConfig?.appSettingsEnum,
      },
    });
    if (isAdmin) {
      dispatch(getAppApplyInfo(appId));
      return;
    }

    dispatch({ type: 'MOBILE_FETCH_MEMBER_SUCCESS' });
  });
};

// 删除应用
export const deleteApp =
  ({ projectId, appId }: { projectId?: string; appId?: string; [key: string]: any }, cb) =>
  dispatch => {
    dispatch({
      type: 'MOBILE_ACTION_ING',
    });
    homeAppAjax
      .deleteApp({
        appId,
        projectId,
        isHomePage: true,
      })
      .then(res => {
        cb && cb(res);
      });
  };

// 退出应用
export const quitApp =
  ({ appId, projectId }: { appId?: string; projectId?: string; [key: string]: any }, cb) =>
  dispatch => {
    dispatch({
      type: 'MOBILE_ACTION_ING',
    });
    ajaxRequest
      .quitRole({
        appId,
        projectId,
      })
      .then(res => {
        cb && cb(res);
      });
  };
