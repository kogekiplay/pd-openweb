import { dialogSelectDept, dialogSelectOrgRole, dialogSelectUser } from 'ming-ui/functions';
import actionLogAjax from 'src/api/actionLog';
import appManagementAjax from 'src/api/appManagement';
import attachmentAjax from 'src/api/attachment';
import fixedDataAjax from 'src/api/fixedData';
import homeAppAjax from 'src/api/homeApp';
import pluginAjax from 'src/api/plugin';
import qiniuAjax from 'src/api/qiniu';
import userAjax from 'src/api/user';
import worksheetAjax from 'src/api/worksheet';
import delegationAjax from 'src/pages/workflow/api/delegation';
import instanceAjax from 'src/pages/workflow/api/instance';
import instanceVersionAjax from 'src/pages/workflow/api/instanceVersion';
import processAjax from 'src/pages/workflow/api/process';
import processVersionAjax from 'src/pages/workflow/api/processVersion';
import { mobileSelectRecord } from 'mobile/components/RecordCardListDialog';
import { selectOrgRole as mobileSelectOrgRole } from 'mobile/components/SelectOrgRole';
import { selectUser } from 'mobile/components/SelectUser';
import { openAddRecord as mobileAddRecord } from 'mobile/Record/addRecord';
import exportSheet from 'worksheet/common/ExportSheet';
import addRecord from 'worksheet/common/newRecord/addRecord';
import { openRecordInfo } from 'worksheet/common/recordInfo';
import { importDataFromExcel } from 'worksheet/common/WorksheetBody/ImportDataFromExcel';
import previewAttachments from 'src/components/previewAttachments/previewAttachments';
import { selectRecords } from 'src/components/SelectRecords';
import { openMobileRecordInfo } from 'src/pages/Mobile/Record';
import { browserIsMobile, getDefaultThemeMode, getFilledRequestParams } from 'src/utils/common';
import { emitter } from 'src/utils/common';
import { renderText } from 'src/utils/control';
import { addBehaviorLog, compatibleMDJS, mdAppResponse } from 'src/utils/project';
import selectLocation from './selectLocation';
import {
  firstNativeRecord,
  nativeDepartments,
  nativeLocation,
  nativeOrgRoles,
  nativeUsers,
  parsedObjects,
} from './valueBoundary';
import type {
  WidgetDepartment,
  WidgetLocation,
  WidgetLocationOptions,
  WidgetNewRecordOptions,
  WidgetOrgRole,
  WidgetRecordOptions,
  WidgetRecordSelectorOptions,
  WidgetSelectorOptions,
  WidgetUser,
} from './widgetFunctionTypes';

export const api = {
  getFilterRowsTotalNum: (data: Record<string, unknown>) =>
    window.mdyAPI('Worksheet', 'GetFilterRowsTotalNum', getFilledRequestParams(data)),
  getFilterRows: (data: Record<string, unknown>) =>
    window.mdyAPI('Worksheet', 'GetFilterRows', getFilledRequestParams(data)),
  getRowRelationRows: (data: Record<string, unknown>) => window.mdyAPI('Worksheet', 'GetRowRelationRows', data),
  getRowDetail: (data: Record<string, unknown>) => window.mdyAPI('Worksheet', 'GetRowDetail', data),
  addWorksheetRow: (data: Record<string, unknown>) => window.mdyAPI('Worksheet', 'AddWorksheetRow', data),
  deleteWorksheetRow: (data: Record<string, unknown>) => window.mdyAPI('Worksheet', 'DeleteWorksheetRows', data),
  updateWorksheetRow: (data: Record<string, unknown>) => window.mdyAPI('Worksheet', 'UpdateWorksheetRow', data),
  getWorksheetInfo: (data: Record<string, unknown>) => window.mdyAPI('Worksheet', 'GetWorksheetInfo', data),
};

function getMainWebApi() {
  const mainWebApi: Record<string, object> = {};
  [
    {
      controller: 'worksheet',
      ajax: worksheetAjax,
    },
    {
      controller: 'appManagement',
      ajax: appManagementAjax,
    },
    {
      controller: 'homeApp',
      ajax: homeAppAjax,
    },
    {
      controller: 'actionLog',
      ajax: actionLogAjax,
    },
    {
      controller: 'instance',
      ajax: instanceAjax,
    },
    {
      controller: 'instanceVersion',
      ajax: instanceVersionAjax,
    },
    {
      controller: 'process',
      ajax: processAjax,
    },
    {
      controller: 'processVersion',
      ajax: processVersionAjax,
    },
    {
      controller: 'delegation',
      ajax: delegationAjax,
    },
    {
      controller: 'qiniu',
      ajax: qiniuAjax,
    },
    {
      controller: 'attachment',
      ajax: attachmentAjax,
    },
    {
      controller: 'plugin',
      ajax: pluginAjax,
    },
    {
      controller: 'fixedData',
      ajax: fixedDataAjax,
    },
    {
      controller: 'user',
      ajax: userAjax,
    },
  ].forEach(item => {
    mainWebApi[item.controller] = item.ajax;
  });
  return mainWebApi;
}

export const mainWebApi = getMainWebApi();

const isMobile = browserIsMobile();

function emitWidgetAction(action: string, value: unknown) {
  emitter.emit('POST_MESSAGE_TO_CUSTOM_WIDGET', {
    action,
    value,
  });
}

export const utils = {
  alert: window.alert,
  previewAttachments,
  openRecordInfo: (args: WidgetRecordOptions) => {
    addBehaviorLog('worksheetRecord', args.worksheetId, { rowId: args.recordId }); // 浏览记录埋点
    if (window.isMingDaoApp) {
      const sessionId = Math.random().toString(32).slice(2);
      return mdAppResponse({
        sessionId,
        type: 'native',
        settings: {
          action: 'row',
          appId: args.appId,
          worksheetId: args.worksheetId,
          viewId: args.viewId,
          rowId: args.recordId,
        },
      }).then(res => {
        if (res.action === 'close') {
          return { action: 'close' };
        } else if (res.action === 'row') {
          return { action: 'update', value: firstNativeRecord(res.value) };
        }
        return undefined;
      });
    }

    return new Promise<{ action: string; value: unknown }>(resolve => {
      (isMobile ? openMobileRecordInfo : openRecordInfo)({
        projectId: args.projectId,
        allowAdd: args.worksheetInfo && args.worksheetInfo.allowAdd,
        ...args,
        ...(isMobile
          ? {
              appId: args.appId || (args.worksheetInfo && args.worksheetInfo.appId),
              rowId: args.recordId,
              className: 'full',
              updateSuccess: (_rowIds: string[], newRow: unknown) => {
                resolve({ action: 'update', value: newRow });
              },
            }
          : {
              updateRows: (_rowIds: string[], newRow: unknown) => {
                resolve({ action: 'update', value: newRow });
              },
            }),
      });
    });
  },
  openNewRecord: (args: WidgetNewRecordOptions) => {
    if (window.isMingDaoApp) {
      const sessionId = Math.random().toString(32).slice(2);
      return mdAppResponse({
        sessionId,
        type: 'native',
        settings: {
          action: 'addRow',
          appId: args.appId,
          worksheetId: args.worksheetId,
          viewId: args.viewId,
        },
      }).then(res => {
        if (res.action === 'close') {
          return undefined;
        } else if (res.action === 'addRow') {
          return firstNativeRecord(res.value);
        }
        return undefined;
      });
    }

    return new Promise(resolve => {
      (isMobile ? mobileAddRecord : addRecord)({
        ...args,
        onAdd: resolve,
      });
    });
  },
  selectUsers: ({ unique, ...rest }: WidgetSelectorOptions = {}) => {
    if (window.isMingDaoApp) {
      const sessionId = Math.random().toString(32).slice(2);
      return mdAppResponse({
        sessionId,
        type: 'native',
        settings: {
          action: 'selectUsers',
          projectId: rest.projectId,
          unique: unique,
        },
      }).then(res => {
        if (res.action === 'close') {
          return [];
        } else if (res.action === 'selectUsers') {
          const users = nativeUsers(res.value);
          emitWidgetAction('select-users', users);
          return users;
        }
        return undefined;
      });
    }

    return new Promise<WidgetUser[]>(resolve => {
      function handleSelect(users: WidgetUser[]) {
        emitWidgetAction('select-users', users);
        resolve(users);
      }

      if (isMobile) {
        selectUser({
          type: 'user',
          projectId: rest.projectId,
          onlyOne: unique,
          onSave: handleSelect,
          ...rest,
        });
      } else {
        dialogSelectUser({
          SelectUserSettings: {
            projectId: rest.projectId,
            callback: handleSelect,
            unique,
            ...rest,
          },
        });
      }
    });
  },
  selectDepartments: ({ unique, ...rest }: WidgetSelectorOptions = {}) => {
    if (window.isMingDaoApp) {
      const sessionId = Math.random().toString(32).slice(2);
      return mdAppResponse({
        sessionId,
        type: 'native',
        settings: {
          action: 'selectDepartments',
          projectId: rest.projectId,
          unique: unique,
        },
      }).then(res => {
        if (res.action === 'close') {
          return undefined;
        } else if (res.action === 'selectDepartments') {
          const departments = nativeDepartments(res.value);
          emitWidgetAction('select-departments', departments);
          return departments;
        }
        return undefined;
      });
    }

    return new Promise<WidgetDepartment[] | undefined>(resolve => {
      function handleSelect(departments: WidgetDepartment[]) {
        emitWidgetAction('select-departments', departments);
        resolve(departments);
      }

      if (isMobile) {
        selectUser({
          type: 'department',
          projectId: rest.projectId,
          onlyOne: unique,
          onSave: handleSelect,
          ...rest,
        });
      } else {
        dialogSelectDept({
          projectId: rest.projectId,
          isIncludeRoot: rest.isIncludeRoot,
          unique: unique,
          showCreateBtn: rest.showCreateBtn,
          allPath: rest.allPath,
          selectFn: handleSelect,
          onClose: () => resolve(undefined),
          ...rest,
        });
      }
    });
  },
  selectOrgRole: ({ unique, ...rest }: WidgetSelectorOptions = {}) => {
    if (window.isMingDaoApp) {
      const sessionId = Math.random().toString(32).slice(2);
      return mdAppResponse({
        sessionId,
        type: 'native',
        settings: {
          action: 'selectOrgRole',
          projectId: rest.projectId,
          unique: unique,
        },
      }).then(res => {
        if (res.action === 'close') {
          return undefined;
        } else if (res.action === 'selectOrgRole') {
          const orgs = nativeOrgRoles(res.value);
          emitWidgetAction('select-org-roles', orgs);
          return orgs;
        }
        return undefined;
      });
    }

    return new Promise<WidgetOrgRole[]>(resolve => {
      function handleSelect(orgs: WidgetOrgRole[]) {
        emitWidgetAction('select-org-roles', orgs);
        resolve(orgs);
      }

      if (isMobile) {
        mobileSelectOrgRole({
          projectId: rest.projectId,
          onlyOne: unique,
          onSave: handleSelect,
          ...rest,
        });
      } else {
        return dialogSelectOrgRole({
          projectId: rest.projectId,
          unique: unique,
          onSave: handleSelect,
          ...rest,
        });
      }
    });
  },
  selectRecord: ({ relateSheetId, multiple, ...rest }: WidgetRecordSelectorOptions = {}) => {
    if (window.isMingDaoApp) {
      const sessionId = Math.random().toString(32).slice(2);
      return mdAppResponse({
        sessionId,
        type: 'native',
        settings: {
          action: 'selectRecord',
          projectId: rest.projectId,
          relateSheetId,
          multiple,
        },
      }).then(res => {
        if (res.action === 'close') {
          return undefined;
        } else if (res.action === 'selectRecord') {
          const records = parsedObjects(res.value);
          emitWidgetAction('select-records', records);
          return records;
        }
        return undefined;
      });
    }

    return new Promise(resolve => {
      (isMobile ? mobileSelectRecord : selectRecords)({
        projectId: rest.projectId,
        canSelectAll: false,
        pageSize: rest.pageSize,
        multiple: multiple,
        singleConfirm: true,
        relateSheetId,
        worksheetId: relateSheetId,
        onOk: (records: unknown[]) => {
          emitWidgetAction('select-records', records);
          resolve(records);
        },
        ...rest,
      });
    });
  },
  selectLocation: (options: WidgetLocationOptions = {}) => {
    const { distance } = options;

    if (window.isMingDaoApp) {
      const sessionId = Math.random().toString(32).slice(2);
      return mdAppResponse({
        sessionId,
        type: 'map',
        settings: {
          action: 'map',
          range: distance,
        },
      }).then(res => {
        if (res.action === 'close') {
          return undefined;
        } else if (res.action === 'map') {
          const location = nativeLocation(res.value);
          emitWidgetAction('select-location', [location]);
          return location;
        }
        return undefined;
      });
    }

    return new Promise(resolve => {
      selectLocation({
        ...options,
        onSelect: (location: WidgetLocation) => {
          resolve(location);
          emitWidgetAction('select-location', [location]);
        },
      });
    });
  },
  getLocation: () => {
    if (window.isMingDaoApp) {
      return new Promise((resolve, reject) => {
        compatibleMDJS('getLocation', {
          success: (res: unknown) => {
            resolve(res);
          },
          cancel: (res: unknown) => {
            reject(res);
          },
        });
      });
    }

    return Promise.resolve({});
  },
  getThemeMode: () => {
    return localStorage.getItem('themeMode') || getDefaultThemeMode();
  },
  importDataFromExcel: async (options = {}) => {
    const isDisabled = location.pathname.indexOf('public') > -1 || window.isPublicApp || md.global.Account.isPortal;

    if (isDisabled) {
      return Promise.resolve({});
    }

    return importDataFromExcel(options);
  },
  exportSheet: async (options = {}) => {
    const isDisabled = location.pathname.indexOf('public') > -1 || window.isPublicApp || md.global.Account.isPortal;

    if (isDisabled) {
      return Promise.resolve({});
    }

    return exportSheet(options);
  },
  renderText,
};
