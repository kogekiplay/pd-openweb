import _ from 'lodash';
import publicWorksheetApi from 'src/api/publicWorksheet';
import worksheetAjax from 'src/api/worksheet';
import { SYSTEM_CONTROL } from 'src/pages/widgetConfig/config/widget';
import { FORM_HIDDEN_CONTROL_IDS } from 'src/pages/widgetConfig/config/widget';
import { isSheetDisplay } from 'src/pages/widgetConfig/util';
import { ensureAppLangData } from 'src/utils/app';
import { browserIsMobile } from 'src/utils/common';
import { replaceAdvancedSettingTranslateInfo, replaceControlsTranslateInfo } from 'src/utils/translate';
import type { FormControl } from 'src/utils/controlTypes';

function getTableAdvancedSettingOfControl(control) {
  let { advancedSetting = {} } = control;
  const isPublicForm = _.get(window, 'shareState.isPublicForm') && window.shareState.shareId;

  if (isPublicForm && control.type === 29) {
    advancedSetting.allowlink = '0';
    advancedSetting.allowedit = '0';
    if (_.includes(['2', '5', '6'], control.advancedSetting.showtype) && browserIsMobile()) {
      advancedSetting = {
        ...advancedSetting,
        showtype: '1',
        originShowType: control.advancedSetting.showtype,
      };
    } else if (_.includes(['2', '6'], _.get(control, 'advancedSetting.showtype'))) {
      advancedSetting = {
        ...advancedSetting,
        showtype: '5',
      };
    }
  }

  return advancedSetting;
}

/**
 * getRowDetail 解析、翻译、拼装之后吐出来的记录详情。
 *
 * 和 FormControl 一样【故意不完备】：字段是按本仓实际读到的点补的。
 * 碰到没列的就往这里加一行，不要退回 any —— 一旦退回去，
 * 各处 data.xxx 又整片变成不受检的黑洞。
 */
export interface RecordDetail {
  /** 1 正常，4 记录不存在/无权限，71 仅部分字段有权限 */
  resultCode?: number;
  /** 0 表示当前用户在这条记录上没有角色 */
  roleType?: number;
  /** 由 templateControls + 行数据拼出来的表单字段 */
  formData?: FormControl[];
  /** 字段显隐规则；由 loadRecord 在 getRules 为真时合并进来 */
  rules?: any[];
  allowEdit?: boolean;
  allowDelete?: boolean;
  /** 记录是否落在当前视图的数据范围内 */
  isViewData?: boolean;
  isLock?: boolean;
  updateTime?: string;
  ownerAccount?: { accountId?: string; fullname?: string; avatar?: string };
  /** 表单级高级设置（含编辑锁 roweditlock 等），值都是字符串 */
  advancedSetting?: { [key: string]: string };
  /** 后端原样返回的行数据 JSON 串，formData 就是从它解析出来的 */
  rowData?: string;
  templateControls?: FormControl[];
  appId?: string;
  appTimeZone?: string;
  projectId?: string;
  worksheetId?: string;
  viewId?: string;
  rowid?: string;
  requestLogId?: string;
  /** 请求异常时后端给的错误码，与 resultCode 不是一回事 */
  errorCode?: number;
}

export function getRowDetail(params, controls, options = {}) {
  return new Promise<RecordDetail>((resolve, reject) => {
    if (!controls) {
      params.getTemplate = true;
    }

    const isPublicForm = _.get(window, 'shareState.isPublicForm') && window.shareState.shareId;

    (isPublicForm
      ? publicWorksheetApi.getRowDetail({
          rowId: params.rowId,
          worksheetId: params.worksheetId,
          getType: 1,
          checkView: true,
          getTemplate: true,
        })
      : worksheetAjax.getRowDetail(params, options)
    )
      .then(async data => {
        const rowData = safeParse(data.rowData);
        let controlPermissions = safeParse(rowData.controlpermissions);
        window[`timeZone_${data.appId}`] = data.appTimeZone;
        // 跨应用打开记录（如关联记录）时，被关联应用的语言包未预加载，需按 data.appId 按需补齐后再翻译控件
        if (!controls) {
          await ensureAppLangData(data.appId);
        }

        data.advancedSetting = replaceAdvancedSettingTranslateInfo(
          data.appId,
          params.worksheetId,
          data.advancedSetting || {},
        );
        data.formData = (
          controls ||
          replaceControlsTranslateInfo(data.appId, params.worksheetId, data.templateControls || []).concat(
            SYSTEM_CONTROL,
          ) ||
          []
        ).map(c => ({
          ...c,
          controlPermissions: controlPermissions[c.controlId] || c.controlPermissions,
          dataSource: c.dataSource || '',
          value: rowData[c.controlId],
          hidden: _.includes(FORM_HIDDEN_CONTROL_IDS, c.controlId),
          count: rowData['rq' + c.controlId],
          required: isSheetDisplay(c) ? false : c.required,
          advancedSetting: getTableAdvancedSettingOfControl(c),
          ...(rowData[`rc${c.controlId}`] ? { rcValue: rowData[`rc${c.controlId}`] } : {}),
        }));
        resolve(data);
      })
      .catch(reject);
  });
}

export function deleteAttachmentOfControl(
  { appId, viewId, worksheetId, recordId, controlId, attachment },
  cb = () => {},
) {
  const deleteObj = [
    {
      fileId: attachment.fileId || attachment.fileID,
      originalFilename: attachment.originalFilename,
    },
  ];

  worksheetAjax
    .updateWorksheetRow({
      appId,
      viewId,
      worksheetId,
      rowId: recordId,
      newOldControl: [
        {
          controlId,
          editType: 2,
          value: JSON.stringify(
            attachment.refId
              ? {
                  knowledgeAtts: deleteObj,
                }
              : {
                  attachments: deleteObj,
                },
          ),
        },
      ],
    })
    .then(data => (data.resultCode === 1 ? cb(null, data.data) : cb(data.resultCode)))
    .catch(cb);
}
