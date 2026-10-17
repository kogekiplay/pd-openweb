import _ from 'lodash';
import formAjax from 'src/api/form';
import publicWorksheetAjax from 'src/api/publicWorksheet';
import type { AppDispatch, GetState } from 'src/redux/types';
import type { FormControl } from 'src/utils/controlTypes';
import { getDisabledControls, getNewControlColRow } from '../../utils';
import type {
  HidedControlId,
  PublicFormSource,
  PublicWorksheetAction,
  PublicWorksheetExtendDatas,
  PublicWorksheetInfo,
  PublicWorksheetPayload,
} from './types';

type BaseConfigPatch = Partial<PublicWorksheetInfo> & {
  controls?: FormControl[] | undefined;
  hidedControlIds?: HidedControlId[] | undefined;
  cover?: string | undefined;
  logo?: string | undefined;
  themeColor?: number | undefined;
};

function changeKeyToServer(value: BaseConfigPatch) {
  if (!_.isUndefined(value.coverUrl)) {
    value.cover = value.coverUrl.split('?')[0];
    delete value.coverUrl;
  }

  if (!_.isUndefined(value.logoUrl)) {
    value.logo = value.logoUrl.split('?')[0];
    delete value.logoUrl;
  }

  if (!_.isUndefined(value.themeIndex)) {
    value.themeColor = value.themeIndex;
    delete value.themeIndex;
  }

  return value;
}

export const updateSettings =
  (
    value: PublicWorksheetPayload<'PUBLICWORKSHEET_UPDATE_SETTINGS'>['value'],
    cb: (success: boolean) => void = () => {},
  ) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const {
      publicWorksheet: {
        worksheetInfo: { worksheetId, projectId },
      },
    } = getState();
    publicWorksheetAjax
      .saveSetting({
        projectId,
        worksheetId,
        ...value,
      })
      .then(data => {
        if (data) {
          cb(true);
          console.log('save success');
          dispatch({ type: 'PUBLICWORKSHEET_UPDATE_SETTINGS', value } satisfies PublicWorksheetAction);
        }
      })
      .catch(() => {
        cb(false);
      });
  };

function updateBaseConfig(
  _dispatch: AppDispatch,
  getState: GetState,
  value: BaseConfigPatch,
  cb?: ((worksheetId: string | undefined) => void) | undefined,
) {
  const {
    publicWorksheet: {
      worksheetInfo: { worksheetId, projectId },
    },
  } = getState();
  const serverValue = changeKeyToServer(value);
  const params = {
    ...serverValue,
  };
  publicWorksheetAjax
    .saveWorksheet({
      projectId,
      worksheetId,
      ...params,
    })
    .then(() => {
      if (_.isFunction(cb)) {
        cb(worksheetId);
      }
    })
    .catch(() => {
      alert(_l('保存失败'), 3);
    });
}

export function refreshShareUrl() {
  return (dispatch: AppDispatch, getState: GetState) => {
    const {
      publicWorksheet: {
        worksheetInfo: { worksheetId },
      },
    } = getState();
    publicWorksheetAjax
      .refreshPublicWorksheetUrl({ worksheetId })
      .then(data => {
        alert(_l('刷新成功'));
        dispatch({ type: 'PUBLICWORKSHEET_UPDATE_URL', url: data.url } satisfies PublicWorksheetAction);
      })
      .catch(() => {
        alert(_l('刷新失败'), 3);
      });
  };
}

export function addWorksheetControl(controlName: string, cb: (control: FormControl) => void = () => {}) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();

    if (state.publicWorksheet.originalControls.length + 1 > 200) {
      alert(_l('表单中添加字段数量已达上限（200个）'), 3);
      return;
    }

    const {
      publicWorksheet: {
        worksheetInfo: { worksheetId },
      },
    } = state;
    formAjax
      .addTextControl({
        worksheetId,
        name: controlName,
      })
      .then(data => {
        dispatch({ type: 'PUBLICWORKSHEET_ADD_CONTROL', control: data } satisfies PublicWorksheetAction);
        dispatch(hideControl(data.controlId));
        cb(data);
      })
      .catch(() => {
        alert(_l('添加文本字段失败'), 3);
      });
  };
}

const getDispatchData = (data: Partial<PublicFormSource> = {}) => {
  const extendDatas: PublicWorksheetExtendDatas = data.extendDatas || {};
  const shareConfig = safeParse(extendDatas.shareConfig) || {};
  shareConfig.title = shareConfig.title || `${data.name} - ${_l('公开填写')}`;
  shareConfig.desc = shareConfig.desc || _l('请填写内容');
  extendDatas.shareConfig = JSON.stringify(shareConfig);

  return {
    type: 'PUBLICWORKSHEET_LOAD_SUCCESS',
    controls: data.controls,
    // Native map preserves missing/null failure behavior; a successful map yields an array.
    originalControls: data.originalControls!.map(c => ({
      ...c,
      advancedSetting:
        c.type === 29 && _.includes(['2', '6'], _.get(c, 'advancedSetting.showtype'))
          ? { ...(c.advancedSetting || {}), showtype: '5' }
          : c.advancedSetting,
    })),
    shareId: data.shareId,
    url: data.url,
    worksheetInfo: {
      themeIndex: data.themeColor,
      themeBgColor: data.themeBgColor,
      logoUrl: data.logo,
      coverUrl: data.cover,
      ..._.pick(data, [
        'worksheetName',
        'advancedSetting',
        'name',
        'desc',
        'worksheetId',
        'projectId',
        'projectName',
        'visibleType',
        'submitBtnName',
        'appId',
      ]),
    },
    worksheetSettings: {
      extendDatas,
      ..._.pick(data, [
        'limitWriteFrequencySetting',
        'ipControlId',
        'browserControlId',
        'deviceControlId',
        'systemControlId',
        'receipt',
        'extendSourceId',
        'extends',
        'needCaptcha',
        'smsVerification',
        'smsVerificationFiled',
        'smsSignature',
        'writeScope',
        'linkSwitchTime',
        'limitWriteTime',
        'limitWriteCount',
        'limitPasswordWrite',
        'cacheDraft',
        'cacheFieldData',
        'weChatSetting',
        'abilityExpand',
        'completeNumber',
        'boundControlIds',
      ]),
    },
    hidedControlIds: data.hidedControlIds || [],
  } satisfies PublicWorksheetAction;
};

export function loadPublicWorksheet({ worksheetId }: { worksheetId?: string | undefined }) {
  return (dispatch: AppDispatch) => {
    publicWorksheetAjax.getPublicWorksheetInfo({ worksheetId }).then(data => {
      dispatch(getDispatchData(data));
    });
  };
}

export const changeControls =
  (controls: PublicWorksheetPayload<'PUBLICWORKSHEET_UPDATE_CONTROLS'>['controls'], isSave = true) =>
  (dispatch: AppDispatch, getState: GetState) => {
    dispatch({ type: 'PUBLICWORKSHEET_UPDATE_CONTROLS', controls } satisfies PublicWorksheetAction);
    isSave &&
      updateBaseConfig(dispatch, getState, {
        controls: controls.map(c => _.pick(c, ['controlId', 'col', 'row', 'size'])),
      });
  };

export const updateWorksheetInfo =
  (value: PublicWorksheetPayload<'PUBLICWORKSHEET_UPDATE_INFO'>['value']) =>
  (dispatch: AppDispatch, getState: GetState) => {
    dispatch({ type: 'PUBLICWORKSHEET_UPDATE_INFO', value } satisfies PublicWorksheetAction);
    updateBaseConfig(dispatch, getState, value);
  };

export const updateWorksheetVisibleType =
  (value: number, cb: () => void = () => {}) =>
  (dispatch: AppDispatch, getState: GetState) => {
    updateBaseConfig(dispatch, getState, { visibleType: value }, (worksheetId: string | undefined) => {
      cb();
      if (value === 1) {
        dispatch({
          type: 'PUBLICWORKSHEET_UPDATE_INFO',
          value: { visibleType: value },
        } satisfies PublicWorksheetAction);
      } else {
        dispatch(loadPublicWorksheet({ worksheetId }));
      }
    });
  };

export const hideControl =
  (controlId: PublicWorksheetPayload<'WORKSHEET_HIDE_CONTROL'>['controlId']) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const {
      publicWorksheet: { hidedControlIds, controls, worksheetSettings, originalControls },
    } = getState();

    //每次更改字段显隐时，需要将禁用的字段隐藏
    const disabledControlIds = getDisabledControls(originalControls, worksheetSettings);
    const newHidedControlIds = _.uniqBy(hidedControlIds.concat(controlId).concat(disabledControlIds), id => id);
    const newControls: FormControl[] = controls!.filter(item => !_.includes(newHidedControlIds, item.controlId));

    updateBaseConfig(dispatch, getState, { hidedControlIds: newHidedControlIds, controls: newControls });
    dispatch({ type: 'WORKSHEET_HIDE_CONTROL', controlId } satisfies PublicWorksheetAction);
    dispatch({ type: 'PUBLICWORKSHEET_UPDATE_CONTROLS', controls: newControls } satisfies PublicWorksheetAction);
  };

export function showControl(showControls: FormControl[] = []) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const {
      publicWorksheet: { controls, hidedControlIds, originalControls, worksheetSettings },
    } = state;

    const newShowControls = showControls.reduce<FormControl[]>((acc, control) => {
      // 将原始 controls 和已经处理过的控件合并，用于计算新控件位置
      const currentControls: FormControl[] = controls!.concat(acc);
      const rowCol = getNewControlColRow(currentControls, control.half);
      return acc.concat({ ...control, col: rowCol.col, row: rowCol.row });
    }, []);

    //每次更改字段显隐时，需要将禁用的字段隐藏
    const disabledControlIds = getDisabledControls(originalControls, worksheetSettings);
    const newHidedControlIds = _.uniqBy(
      hidedControlIds.concat(disabledControlIds).filter(controlId => !_.find(newShowControls, { controlId })),
      id => id,
    );
    const newControls: FormControl[] = controls!.concat(
      newShowControls.map(control => _.pick(control, ['controlId', 'col', 'row', 'size'])),
    );

    updateBaseConfig(dispatch, getState, { hidedControlIds: newHidedControlIds, controls: newControls });
    if (_.isFunction(window.scrollToFormEnd)) {
      window.scrollToFormEnd();
    }

    dispatch({
      type: 'WORKSHEET_SHOW_CONTROL',
      controlIds: newShowControls.map(control => control.controlId),
      controls: newShowControls.map(control => _.pick(control, ['controlId', 'col', 'row', 'size'])),
    } satisfies PublicWorksheetAction);
  };
}

export function resetControls() {
  return (dispatch: AppDispatch, getState: GetState) => {
    const {
      publicWorksheet: {
        worksheetInfo: { worksheetId },
      },
    } = getState();
    publicWorksheetAjax
      .reset({ worksheetId })
      .then(data => {
        if (data && data.success) {
          dispatch(getDispatchData(data.info));
        }
      })
      .catch(() => {
        alert(_l('重置失败'), 2);
      });
  };
}

// 清空数据
export const clear = () => ({ type: 'PUBLICWORKSHEET_CLEAR' }) satisfies PublicWorksheetAction;
