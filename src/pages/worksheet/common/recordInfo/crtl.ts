import _, { isEmpty } from 'lodash';
import { quickSelectUser } from 'ming-ui/functions';
import appManagement from 'src/api/appManagement';
import publicWorksheetApi from 'src/api/publicWorksheet';
import worksheetAjax from 'src/api/worksheet';
import { getRowDetail, type RecordDetail } from 'worksheet/api';
import { exportSheet } from 'worksheet/components/ChildTable/redux/actions';
import { getRuleErrorInfo } from 'src/components/Form/core/formUtils';
import type { FormRule, RuleFilterItem } from 'src/components/Form/core/types';
import { formatControlToServer } from 'src/components/Form/core/utils';
import { getCustomWidgetUri } from 'src/pages/worksheet/constants/common';
import { postWithToken } from 'src/utils/common';
import type { FormControl, RecordRow, WorksheetCustomBtn } from 'src/utils/controlTypes';
import { getRecordLandUrl, handleRecordError } from 'src/utils/record';
import { replaceBtnsTranslateInfo, replaceRulesTranslateInfo } from 'src/utils/translate';

/**
 * 提交失败时后端回传的「坏数据」。形状随 resultCode 变（11 唯一值冲突 / 22 子表唯一值 /
 * 31 服务异常 / 32 业务规则），每个调用方各自解析自己那一种，这里不强行统一。
 */
type BadData = any;

/**
 * updateRecord / handleSubmitDraft 的收尾回调。
 * 实参形态是历史约定的几种：`('empty')`、`(null, data, logId)`、`(true)`、`(err)`。
 * 写成 (...args: any[]) 是为了如实描述它，而不是假装它只有一种签名。
 */
type RecordCallback = (...args: any[]) => void;

// RecordDetail 定义在 worksheet/api（记录详情就是在那儿拼出来的），这里转出去方便调用方取用
export type { RecordDetail };

// RecordRow 和 FormControl 同属控件领域类型，定义在 src/utils/controlTypes，这里转出去
export type { RecordRow };

/** updateWorksheetRow / saveDraftRow 的返回 */
interface UpdateRowResult {
  resultCode?: number;
  /** 成功时是更新后的记录行 */
  data?: RecordRow;
  badData?: BadData;
  requestLogId?: string;
}

interface LoadRecordOptions {
  appId?: string;
  viewId?: string;
  worksheetId?: string;
  relationWorksheetId?: string;
  recordId?: string;
  /** 取数方式；instanceId + workId 同时存在时会被强制改成 9（工作流节点） */
  getType?: number;
  instanceId?: string;
  workId?: string;
  /** 是否顺带拉字段显隐规则 */
  getRules?: boolean;
  controls?: FormControl[];
  discussId?: string;
}

export function getWorksheetInfo(...args: Parameters<typeof worksheetAjax.getWorksheetInfo>) {
  return worksheetAjax.getWorksheetInfo(...args);
}

export function loadRecord({
  appId,
  viewId,
  worksheetId,
  relationWorksheetId,
  recordId,
  getType = 1,
  instanceId,
  workId,
  getRules,
  controls,
  discussId,
}: LoadRecordOptions) {
  return new Promise<RecordDetail>((resolve, reject) => {
    // 标 ApiArgs（types/global.d.ts 的 ambient 声明）而不是靠推断：
    // 下面会按条件往上挂 instanceId / workId / shareId / discussId，
    // 推断出来的是闭合对象类型，挂一个报一个 TS2339。
    const apiargs: ApiArgs = {
      worksheetId,
      rowId: recordId,
      getType,
      appId,
      viewId,
      relationWorksheetId,
      checkView: !!viewId,
      langType: window.shareState.shareId ? getCurrentLangCode() : undefined,
    };

    if (instanceId && workId) {
      apiargs.getType = 9;
      apiargs.instanceId = instanceId;
      apiargs.workId = workId;
    }

    if (_.get(window, 'shareState.isPublicWorkflowRecord') && _.get(window, 'shareState.shareId')) {
      apiargs.shareId = _.get(window, 'shareState.shareId');
    }

    if (discussId) {
      apiargs.discussId = discussId;
    }

    // 两支都解构成 [row, rules]；不取规则那支只有一个元素，所以 rules 是可选项
    let promise: Promise<[RecordDetail, any[]?]>;

    if (!getRules) {
      promise = Promise.all([getRowDetail(apiargs, controls)]);
    } else {
      promise = Promise.all([
        getRowDetail(apiargs, controls),
        worksheetAjax.getControlRules({
          worksheetId,
          type: 1, // 1字段显隐
          instanceId,
          workId,
        }),
      ]);
    }

    promise
      .then(([row, rules]) => {
        if (row.resultCode === 1 || row.resultCode === 71) {
          if (row.roleType !== 0) {
            row.resultCode = 1;
          }

          resolve(rules ? { ...row, rules: replaceRulesTranslateInfo(appId, worksheetId, rules) } : row);
        } else {
          reject(row);
        }
      })
      .catch(reject);
  });
}

/**
 * 这几个错误回调都要收 badData / 账号数组，但它们在解构里写了 `= () => {}` 默认值。
 * 光靠推断，TS 会把它们定成 `() => void`，于是调用方传
 * `badData => this.xxx(badData)` 就报 TS2322 —— 所以必须把签名写出来。
 */
interface UpdateRecordOptions {
  appId?: string;
  viewId?: string;
  getType?: number;
  worksheetId?: string;
  recordId?: string;
  projectId?: string;
  instanceId?: string;
  workId?: string;
  rowIds?: string[];
  /** 当前表单的全部字段；配合 updateControlIds 挑出要提交的那些 */
  data?: FormControl[];
  updateControlIds?: string[];
  /** 41 = 锁定记录，42 = 解锁 */
  updateType?: number;
  isDraft?: boolean;
  /** 本函数不用它，但移动端记录详情会一起传下来，留着以免触发多余属性检查 */
  draftType?: 'save' | 'submit';
  /** 没有任何字段变更时也照常发请求（锁定/解锁走这条路） */
  allowEmptySubmit?: boolean;
  triggerUniqueError?: (badData: BadData) => void;
  updateSuccess?: (recordIds: string[], changedValues: { [controlId: string]: any }, record: RecordRow) => void;
  setSubListUniqueError?: (badData: BadData) => void;
  setRuleError?: (badData: BadData) => void;
  setServiceError?: (badData: BadData) => void;
  alertLockError?: () => void;
}

export function updateRecord(
  {
    appId,
    viewId,
    getType,
    worksheetId,
    recordId,
    projectId,
    instanceId,
    workId,
    rowIds,
    data,
    updateControlIds,
    updateType,
    isDraft,
    triggerUniqueError,
    updateSuccess,
    allowEmptySubmit,
    setSubListUniqueError = () => {},
    setRuleError = () => {},
    setServiceError = () => {},
    alertLockError = () => {},
  }: UpdateRecordOptions,
  callback: RecordCallback = () => {},
) {
  const handleCallback: RecordCallback = (...args) => {
    try {
      callback(...args);
    } catch (err) {
      console.error(err);
    }
  };

  // FormControl.controlId 本身就可能缺失，所以这里如实标成 (string | undefined)[]，
  // 这样下面 indexOf(control.controlId) 不用加断言，运行时也和原来完全一样。
  const changedIds: (string | undefined)[] = updateControlIds || [];
  // 有些只读控件不在updateControlIds范围内，也需要传给后端做业务规则校验
  const updatedControls =
    isEmpty(updateControlIds) || !data
      ? []
      : data
          .filter(
            control =>
              (changedIds.indexOf(control.controlId) > -1 && control.type !== 30) || _.includes([31], control.type),
          )
          .map(control => formatControlToServer(control));
  let apiargs: ApiArgs = {
    appId,
    viewId,
    getType,
    worksheetId,
    rowId: recordId,
    rowIds,
    newOldControl: updatedControls,
    projectID: projectId,
    pushUniqueId: md.global.Config.pushUniqueId,
    ...(updateType ? { updateType } : {}),
  };

  if (instanceId && workId) {
    apiargs.getType = 9;
    apiargs.instanceId = instanceId;
    apiargs.workId = workId;
  }

  if (isDraft) {
    apiargs.rowStatus = 21;
  }

  const isPublicForm = _.get(window, 'shareState.isPublicForm') && window.shareState.shareId;

  if (isPublicForm) {
    apiargs = {
      rowId: recordId,
      newOldControl: updatedControls,
    };
  }

  // 处理工作流的暂存直接点击的情况
  if (!updatedControls.length && !allowEmptySubmit) {
    if (!(instanceId && workId)) {
      alert(_l('没有需要保存的字段'), 2);
    }

    handleCallback('empty');
    return;
  }

  (isPublicForm ? publicWorksheetApi : worksheetAjax)
    .updateWorksheetRow(apiargs)
    .then((res: UpdateRowResult) => {
      if (res && res.data) {
        const row = res.data;
        handleCallback(null, res.data, res.requestLogId);
        if (typeof updateSuccess === 'function') {
          updateSuccess(
            [recordId as string],
            _.assign({}, ...updatedControls.map(control => ({ [control.controlId]: row[control.controlId] }))),
            row,
          );
        }
      } else {
        if (res.resultCode === 6) {
          const lockText = updateType === 41 ? _l('锁定') : _l('解锁');
          alert(_l('记录已%0，请勿重复操作', lockText), 3);
        } else if (res.resultCode === 11) {
          // 同级的几个回调都写了 `= () => {}` 默认值，只有它没有，
          // 而 controllers/record.ts 的调用点确实不传 —— 那条路径撞上 resultCode 11 会抛。
          // 这里用可选调用，行为与其它几个对齐。
          triggerUniqueError?.(res.badData);
        } else if (res.resultCode === 22) {
          setSubListUniqueError(res.badData);
        } else if (res.resultCode === 31) {
          setServiceError(res.badData);
        } else if (res.resultCode === 32) {
          setRuleError(res.badData);
        } else if (res.resultCode === 72) {
          alertLockError();
        } else {
          handleRecordError(res.resultCode);
        }

        handleCallback(true);
      }
    })
    .catch((err: { status?: number }) => {
      console.error(err);
      handleCallback(err);
      if (err.status !== 401) {
        alert(_l('保存失败，请稍后重试'), 2);
      }
    });
}

interface SubmitDraftOptions {
  worksheetId?: string;
  viewId?: string;
  appId?: string;
  recordId?: string;
  formData?: FormControl[];
  rules?: FormRule[];
  triggerUniqueError?: (badData: BadData) => void;
  setSubListUniqueError?: (badData: BadData) => void;
  /** 注意：这个参数【遮蔽】了本文件顶部从 src/utils/record 导入的同名函数，函数体内调的是它 */
  handleRecordError?: (resultCode?: number) => void;
  setRuleError?: (badData: BadData) => void;
  alertLockError?: () => void;
  onSubmitEnd?: () => void;
  onSubmitSuccess?: (row: RecordRow) => void;
  setServiceError?: (badData: BadData) => void;
}

export function handleSubmitDraft(
  {
    worksheetId,
    viewId,
    appId,
    recordId,
    formData = [],
    rules = [],
    triggerUniqueError = () => {},
    setSubListUniqueError = () => {},
    handleRecordError = () => {},
    setRuleError = () => {},
    alertLockError = () => {},
    onSubmitEnd = () => {},
    onSubmitSuccess = () => {},
    setServiceError = () => {},
  }: SubmitDraftOptions,
  callback: RecordCallback = () => {},
) {
  const handleCallback: RecordCallback = (...args) => {
    try {
      callback(...args);
    } catch (err) {
      console.error(err);
    }
  };

  // 草稿提交仅传业务规则相关字段
  const receiveControlsIds = rules.reduce<string[]>((controlIds, item) => {
    const { filters = [], ruleItems = [] } = item;
    // 声明了但从没往里放东西，末尾 concat 上来是个空数组；保留原样，只是把类型写出来
    const ids: string[] = [];

    if (!_.isEmpty(filters)) {
      filters.forEach(it => {
        controlIds = controlIds.concat((it.groupFilters || []).map(v => v.controlId)).concat(it.controlId);
        if (it.groupFilters && it.groupFilters.length > 0) {
          it.groupFilters.forEach(v => {
            controlIds = controlIds.concat(v.controlId);
            if (v.dynamicSource && v.dynamicSource.length > 0) {
              const cids = v.dynamicSource.reduce((ids: string[], s) => ids.concat(s.cid), []);
              controlIds = controlIds.concat(cids);
            }
          });
        }
      });
    }

    if (!_.isEmpty(ruleItems)) {
      ruleItems.forEach(it => {
        controlIds = controlIds.concat(it.controls.map((it: FormControl) => it.controlId));
      });
    }

    return controlIds.concat(ids);
  }, []);

  const receiveControls = formData
    .filter(
      (item: FormControl) => !_.includes([30, 31, 32, 51], item.type) && _.includes(receiveControlsIds, item.controlId),
    )
    .map(c => formatControlToServer(c, { isNewRecord: true, isDraft: true }));

  const args = {
    worksheetId,
    receiveControls,
    viewId,
    appId,
    pushUniqueId: md.global.Config.pushUniqueId,
    rowStatus: 22,
    draftRowId: recordId,
  };
  worksheetAjax
    .saveDraftRow(args)
    .then((res: UpdateRowResult) => {
      if (res.resultCode === 1) {
        if (!res.data) {
          alert(_l('记录添加成功'));
          onSubmitEnd();
          return;
        }

        onSubmitSuccess(res.data);
        onSubmitEnd();
      } else {
        if (res.resultCode === 11) {
          triggerUniqueError(res.badData);
        } else if (res.resultCode === 22) {
          setSubListUniqueError(res.badData);
        } else if (res.resultCode === 31) {
          setServiceError(res.badData);
        } else if (res.resultCode === 32) {
          setRuleError(res.badData);
        } else if (res.resultCode === 72) {
          alertLockError();
        } else {
          handleRecordError(res.resultCode);
        }

        handleCallback(true);
      }
    })
    .catch((err: unknown) => {
      console.error(err);
      handleCallback(err);
      alert(_l('提交失败，请稍后重试'), 2);
    });
}

interface UpdateRecordControlOptions {
  appId?: string;
  viewId?: string;
  worksheetId?: string;
  recordId?: string;
  /** 单个待更新单元格；cells 为空时会被包成 [cell] */
  cell?: FormControl;
  rules?: FormRule[];
  cells?: FormControl[];
}

export function updateRecordControl({
  appId,
  viewId,
  worksheetId,
  recordId,
  cell,
  rules,
  cells = [],
}: UpdateRecordControlOptions) {
  return new Promise<RecordRow>((resolve, reject) => {
    if (_.isEmpty(cells) && cell) {
      cells = [cell];
    }

    worksheetAjax
      .updateWorksheetRow({
        appId,
        viewId,
        worksheetId: worksheetId,
        rowId: recordId,
        newOldControl: cells,
      })
      .then((data: UpdateRowResult) => {
        if (!data.data) {
          if (data.resultCode === 32) {
            const errorResult = getRuleErrorInfo(rules, data.badData);

            if (_.get(errorResult, '0.errorInfo.0')) {
              alert(_l('编辑失败，%0', _.get(errorResult, '0.errorInfo.0.errorMessage')), 2);
            }

            reject();
            return;
          }

          handleRecordError(data.resultCode, cell);
          reject();
        } else {
          resolve(data.data);
        }
      });
  });
}

interface DeleteRecordOptions {
  worksheetId?: string;
  /** 批量删除用；不传时退回单条 [recordId] */
  recordIds?: string[];
  recordId?: string;
  viewId?: string;
  appId?: string;
  /** 21 = 彻底删除（跳过回收站），其余值一律不下发 */
  deleteType?: number;
}

export function deleteRecord({ worksheetId, recordIds, recordId, viewId, appId, deleteType }: DeleteRecordOptions) {
  return new Promise<void>((resolve, reject) => {
    worksheetAjax
      .deleteWorksheetRows({
        worksheetId,
        rowIds: recordIds || [recordId],
        viewId,
        appId,
        deleteType: deleteType === 21 ? deleteType : undefined,
      })
      .then((data: { isSuccess?: boolean }) => {
        if (data.isSuccess) {
          resolve();
        } else {
          reject();
        }
      })
      .catch(reject);
  });
}

export class RecordApi {
  declare baseArgs: ApiArgs;

  constructor({
    appId,
    worksheetId,
    viewId,
    recordId,
  }: {
    appId?: string;
    worksheetId?: string;
    viewId?: string;
    recordId?: string;
  }) {
    this.baseArgs = {
      appId,
      worksheetId,
      viewId: viewId === 'null' ? '' : viewId,
      rowId: recordId,
      btnType: -1,
    };
  }

  getWorksheetBtns(options?: ApiArgs) {
    return new Promise<WorksheetCustomBtn[]>((resolve, reject) => {
      worksheetAjax
        .getWorksheetBtns(_.assign({}, this.baseArgs, options))
        .then((data: WorksheetCustomBtn[]) => {
          resolve(replaceBtnsTranslateInfo(this.baseArgs.appId, data));
        })
        .catch((err: unknown) => {
          reject(err);
        });
    });
  }
}

interface UpdateRelateRecordsOptions {
  appId?: string;
  viewId?: string;
  recordId?: string;
  worksheetId?: string;
  instanceId?: string;
  workId?: string;
  controlId?: string;
  /** true 关联、false 取消关联 */
  isAdd?: boolean;
  recordIds?: string[];
  /** 21 = 彻底删除被关联记录，其余值不下发 */
  updateType?: number;
}

export function updateRelateRecords({
  appId,
  viewId,
  recordId,
  worksheetId,
  instanceId,
  workId,
  controlId,
  isAdd,
  recordIds,
  updateType,
}: UpdateRelateRecordsOptions) {
  return new Promise<void>((resolve, reject) => {
    // 下面按条件挂 instanceId / workId，推断出的闭合对象类型接不住
    const args: ApiArgs = {
      worksheetId,
      appId,
      viewId,
      rowId: recordId,
      controlId,
      isAdd,
      rowIds: recordIds,
      updateType: updateType === 21 ? updateType : undefined,
    };

    if (instanceId && workId) {
      args.instanceId = instanceId;
      args.workId = workId;
    }

    worksheetAjax
      .updateRowRelationRows(args)
      .then((data: { isSuccess?: boolean }) => {
        if (data.isSuccess) {
          resolve();
        } else {
          reject();
        }
      })
      .catch(reject);
  });
}

/** 人员控件的值元素，这里只关心 accountId */
type OwnerAccount = { accountId?: string };

export function isOwner(ownerAccount: OwnerAccount | undefined, formdata: FormControl[]) {
  let accountsOfOwner: OwnerAccount[][] = [];
  let isSettingOwner = false;

  if (ownerAccount && ownerAccount.accountId === md.global.Account.accountId) {
    return true;
  }

  try {
    accountsOfOwner = formdata
      .filter(c => c.type === 26 && c.userPermission === 2)
      .map(u => JSON.parse(u.value))
      .filter(c => c && c.length);
  } catch (err) {
    console.log(err);
  }

  accountsOfOwner.forEach(accounts => {
    accounts.forEach(account => {
      if (account.accountId === md.global.Account.accountId) {
        isSettingOwner = true;
      }
    });
  });
  return isSettingOwner;
}

export function updateRecordOwner({
  worksheetId,
  recordId,
  accountId,
}: {
  worksheetId?: string;
  recordId?: string;
  accountId?: string;
}) {
  return new Promise<{ account: OwnerAccount; record: RecordRow }>((resolve, reject) => {
    worksheetAjax
      .updateWorksheetRow({
        worksheetId,
        rowId: recordId,
        getType: 3,
        newOldControl: [{ controlId: 'ownerid', type: 26, value: accountId }],
      })
      .then((res: UpdateRowResult) => {
        if (res && res.data) {
          const account = JSON.parse(res.data.ownerid)[0];
          resolve({
            account,
            record: res.data,
          });
        } else {
          reject(res);
        }
      })
      .catch(reject);
  });
}

interface ChangeOwnerOptions {
  recordId?: string;
  ownerAccountId?: string;
  appId?: string;
  projectId?: string;
  /** 选人浮层的锚点元素 */
  target?: HTMLElement | null;
  changeOwner: (users: { accountId?: string; fullname?: string }[], accountId?: string) => void;
}

export function handleChangeOwner({
  recordId,
  ownerAccountId,
  appId,
  projectId,
  target,
  changeOwner,
}: ChangeOwnerOptions) {
  quickSelectUser(target, {
    sourceId: recordId,
    projectId: projectId,

    showMoreInvite: false,
    isTask: false,
    tabType: 3,
    appId,
    includeUndefinedAndMySelf: true,
    selectedAccountIds: [ownerAccountId],
    offset: {
      top: 16,
      left: 0,
    },
    zIndex: 10001,
    SelectUserSettings: {
      unique: true,
      projectId: projectId,
      selectedAccountIds: [ownerAccountId],
      callback(users: { accountId?: string; fullname?: string }[]) {
        if (users[0].accountId === md.global.Account.accountId) {
          users[0].fullname = md.global.Account.fullname;
        }

        changeOwner(users, users[0].accountId);
      },
    },
    selectCb(users: { accountId?: string; fullname?: string }[]) {
      if (users[0].accountId === md.global.Account.accountId) {
        users[0].fullname = md.global.Account.fullname;
      }

      changeOwner(users, users[0].accountId);
    },
  });
}

export async function handleOpenInNew({
  appId,
  worksheetId,
  viewId,
  recordId,
}: {
  appId?: string;
  worksheetId?: string;
  viewId?: string;
  recordId?: string;
}) {
  const url = await getRecordLandUrl({ appId, worksheetId, viewId, recordId });
  window.open(url);
}

/** getWorksheetInfo 返回里这里用到的几个字段 */
interface WorksheetInfoBrief {
  name?: string;
  templateId?: string;
  projectId?: string;
  appId?: string;
  groupId?: string;
}

export function handleCustomWidget(worksheetId: string) {
  getWorksheetInfo({ worksheetId }).then(({ name, templateId, projectId, appId, groupId }: WorksheetInfoBrief) => {
    getCustomWidgetUri({
      sourceName: name,
      templateId,
      sourceId: worksheetId,
      projectId,
      appconfig: {
        appId,
        appSectionId: groupId,
      },
    });
  });
}

interface ExportRelateRecordOptions {
  appId?: string;
  worksheetId?: string;
  viewId?: string;
  projectId?: string;
  exportControlsId?: string[];
  /** 导出服务的地址前缀，由部署配置下发 */
  downLoadUrl?: string;
  /** 传了就走后端批量导出；不传走前端子表导出 */
  rowIds?: string[];
  rowId?: string;
  controlId?: string;
  fileName?: string;
  /** 导出时带上的筛选条件，形状与视图筛选一致 */
  filterControls?: RuleFilterItem[];
  /** 导出结束时回调；失败时把错误对象传进来 */
  onDownload?: (error?: unknown) => void;
}

export async function exportRelateRecordRecords({
  appId,
  worksheetId,
  viewId,
  projectId,
  exportControlsId,
  downLoadUrl,
  rowIds,
  rowId,
  controlId,
  fileName,
  filterControls,
  onDownload,
}: ExportRelateRecordOptions = {}) {
  const token = await appManagement.getToken({ worksheetId, viewId, tokenType: 8 });
  const args = {
    token,
    accountId: md.global.Account.accountId,
    worksheetId,
    appId,
    viewId,
    projectId,
    exportControlsId,
    rowIds,
  };

  if (typeof rowIds !== 'undefined') {
    postWithToken(`${downLoadUrl}/ExportExcel/Export`, { worksheetId, tokenType: 8 }, args, {
      responseType: 'blob',
    });
  } else {
    exportSheet({ worksheetId, rowId, controlId, fileName, filterControls, onDownload })();
  }
}

// 更新记录锁定状态
export function updateRecordLockStatus(args: UpdateRecordOptions, callback?: RecordCallback) {
  updateRecord(
    {
      ...args,
      allowEmptySubmit: true,
      data: [],
    },
    callback,
  );
}
