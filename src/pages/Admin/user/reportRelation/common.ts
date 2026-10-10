import { dialogSelectUser } from 'ming-ui/functions';
import projectSettingController from 'src/api/projectSetting';
import structureController from 'src/api/structure';

export function setStructureForAll(params: { projectId: string; forAll: boolean }) {
  return projectSettingController
    .setStructureForAll({
      ...params,
    })
    .then(
      res => {
        return res;
      },
      () => {
        alert(_l('操作失败'), 2);
      },
    );
}

export function setStructureSelfEdit(params: { projectId: string; isAllowStructureSelfEdit: boolean }) {
  return projectSettingController
    .setStructureSelfEdit({
      ...params,
    })
    .then(
      res => {
        return res;
      },
      () => {
        alert(_l('操作失败'), 2);
      },
    );
}

export function selectUser({
  accountId,
  unique,
  isSetParent,
  projectId,
  callback,
}: {
  accountId?: string;
  unique?: boolean;
  isSetParent?: boolean;
  projectId: string;
  title?: string;
  callback?: (accounts: Array<{ accountId?: string; fullname?: string | undefined }>) => void;
}) {
  dialogSelectUser({
    fromAdmin: true,
    SelectUserSettings: {
      projectId,
      filterAll: true,
      filterFriend: true,
      filterOthers: true,
      filterOtherProject: true,
      filterResigned: false,
      hideResignedTab: true,
      unique: !!unique,
      showTabs: ['structureUsers'],
      extraTabs: [
        {
          id: 'structureUsers',
          name: _l('所有人'),
          type: 4,
          page: true,
          actions: {
            getUsers: function (args) {
              args = $.extend({}, args, {
                accountId,
                projectId,
                isSetParent,
              });
              return structureController.getAllowChooseUsers(args);
            },
          },
        },
      ],
      callback: function (accounts) {
        if (typeof callback === 'function') {
          callback(accounts);
        }
      },
    },
  });
}
