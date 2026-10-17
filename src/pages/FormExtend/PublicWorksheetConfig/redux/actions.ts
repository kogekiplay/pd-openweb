import _ from 'lodash';
import formAjax from 'src/api/form';
import publicWorksheetAjax from 'src/api/publicWorksheet';
import { getDisabledControls, getNewControlColRow } from '../../utils';
import type { AppDispatch, GetState } from 'src/redux/types';
import type { FormControl } from 'src/utils/controlTypes';
import type { HidedControlId, PublicWorksheetExtendDatas } from './types';

/**
 * 把前端字段名改写成接口字段名（原地修改并返回同一对象 —— 原实现即如此）。
 *
 * 【为什么参数是 `Record<string, unknown>`】调用方传的是各不相同的局部对象
 * （`{controls}` / `{hidedControlIds, controls}` / `{visibleType}` / 信息补丁），
 * 形状随调用点变化；限定成某个固定接口会把**范围外调用方**一起卡住。
 *
 * 【为什么这里对取值做标量窄化】原实现直接 `value.coverUrl.split('?')[0]`：
 * 键存在时按 URL 字符串处理。标量窄化只声明"存在时是字符串"这一协议事实，
 * **不改变失败路径**（若真不是字符串，`.split` 仍会抛错，与原实现一致）。
 * 这里只窄化单个标量，不做整对象断言。
 */
function changeKeyToServer(value: Record<string, unknown>): Record<string, unknown> {
  const coverUrl = value['coverUrl'] as string | undefined;

  if (!_.isUndefined(coverUrl)) {
    value['cover'] = coverUrl.split('?')[0];
    delete value['coverUrl'];
  }

  const logoUrl = value['logoUrl'] as string | undefined;

  if (!_.isUndefined(logoUrl)) {
    value['logo'] = logoUrl.split('?')[0];
    delete value['logoUrl'];
  }

  const themeIndex = value['themeIndex'] as number | undefined;

  if (!_.isUndefined(themeIndex)) {
    value['themeColor'] = themeIndex;
    delete value['themeIndex'];
  }

  return value;
}

export const updateSettings =
  (value: Record<string, unknown>, cb: (success: boolean) => void = () => {}) =>
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
          dispatch({ type: 'PUBLICWORKSHEET_UPDATE_SETTINGS', value });
        }
      })
      .catch(() => {
        cb(false);
      });
  };

function updateBaseConfig(
  _dispatch: AppDispatch,
  getState: GetState,
  value: Record<string, unknown>,
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
    publicWorksheetAjax.refreshPublicWorksheetUrl({ worksheetId }).then(data => {
      alert(_l('刷新成功'));
      dispatch({ type: 'PUBLICWORKSHEET_UPDATE_URL', url: data.url });
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
        dispatch({ type: 'PUBLICWORKSHEET_ADD_CONTROL', control: data });
        dispatch(hideControl(data.controlId));
        cb(data);
      })
      .catch(() => {
        alert(_l('添加文本字段失败'), 3);
      });
  };
}

/**
 * 把接口返回的公开表单 DTO 映射成 `PUBLICWORKSHEET_LOAD_SUCCESS` 载荷。
 *
 * 【入参类型用仓内生成类型】`src/api/publicWorksheet.ts` 的 `getPublicWorksheetInfo`
 * 返回 `ApiResultOf<PublicWorksheet...PublicFormDomainDto>`，`types/hap-api.d.ts` 里
 * 有完整声明（`themeColor`/`visibleType`/`controls`/`originalControls`/`url`/
 * `hidedControlIds`/`advancedSetting` … 都在其中）。原先写成 `Record<string, any>`
 * 才导致 `data.extendDatas` 这类访问触发 `noPropertyAccessFromIndexSignature`。
 *
 * 【缺字段时保持原失败路径】原实现直接 `data.originalControls.map(...)`，
 * 缺字段会抛 TypeError；这里显式抛同类型错误而不是静默兜底成 `[]`。
 */
type PublicFormDispatchSource = HapApi.MD.Web.Ajax.ResultModel.Worksheet.PublicForm.PublicFormDomainDto;

const getDispatchData = (data: PublicFormDispatchSource) => {
  // `extendDatas` 由接口扩展下发，DTO 未声明该键 → 保留索引访问语义但给出真实局部类型
  const extendDatas: PublicWorksheetExtendDatas =
    (data as unknown as { extendDatas?: PublicWorksheetExtendDatas }).extendDatas || {};
  const shareConfig = safeParse(extendDatas.shareConfig) || {};
  shareConfig.title = shareConfig.title || `${data.name} - ${_l('公开填写')}`;
  shareConfig.desc = shareConfig.desc || _l('请填写内容');
  extendDatas.shareConfig = JSON.stringify(shareConfig);

  return {
    type: 'PUBLICWORKSHEET_LOAD_SUCCESS',
    controls: data.controls,
    originalControls: (() => {
      const source = data.originalControls;

      if (!source) {
        // 原实现会在此处抛 `Cannot read properties of undefined (reading 'map')`
        throw new TypeError("Cannot read properties of undefined (reading 'map')");
      }

      return source;
    })().map(c => ({
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
  };
};

export function loadPublicWorksheet({
  worksheetId,
}: {
  worksheetId?: string | undefined;
}) {
  return (dispatch: AppDispatch) => {
    publicWorksheetAjax.getPublicWorksheetInfo({ worksheetId }).then(data => {
      dispatch(getDispatchData(data));
    });
  };
}

export const changeControls =
  (controls: FormControl[], isSave = true) =>
  (dispatch: AppDispatch, getState: GetState) => {
    dispatch({ type: 'PUBLICWORKSHEET_UPDATE_CONTROLS', controls });
    isSave &&
      updateBaseConfig(dispatch, getState, {
        controls: controls.map(c => _.pick(c, ['controlId', 'col', 'row', 'size'])),
      });
  };

export const updateWorksheetInfo =
  (value: Record<string, unknown>) => (dispatch: AppDispatch, getState: GetState) => {
  dispatch({ type: 'PUBLICWORKSHEET_UPDATE_INFO', value });
  updateBaseConfig(dispatch, getState, value);
};

export const updateWorksheetVisibleType =
  (value: number, cb: () => void = () => {}) =>
  (dispatch: AppDispatch, getState: GetState) => {
    updateBaseConfig(dispatch, getState, { visibleType: value }, (worksheetId: string | undefined) => {
      cb();
      if (value === 1) {
        dispatch({ type: 'PUBLICWORKSHEET_UPDATE_INFO', value: { visibleType: value } });
      } else {
        dispatch(loadPublicWorksheet({ worksheetId }));
      }
    });
  };

export const hideControl = (controlId: string) => (dispatch: AppDispatch, getState: GetState) => {
  const {
    publicWorksheet: { hidedControlIds, controls, worksheetSettings, originalControls },
  } = getState();

  //每次更改字段显隐时，需要将禁用的字段隐藏
  /**
   * 【范围外签名不足，在此边界标注】`getDisabledControls`（`src/pages/FormExtend/utils.tsx:49`）
   * 的 `controls` 形参未标注，其内部 `_.uniqBy(...)` 被推断成 `unknown[]`。
   * 它按契约返回**控件 id 数组**，这里在调用边界声明该事实（运行时不改变任何东西）。
   * **范围外签名由 lead 统一处理**，我不改那个文件。
   */
  const disabledControlIds = getDisabledControls(
    originalControls,
    worksheetSettings,
  ) as HidedControlId[];
  // 【等价修法】`_.uniqBy(arr)` 不带 iteratee 时按自身去重；类型要求显式传恒等函数。
  const newHidedControlIds = _.uniqBy(
    hidedControlIds.concat(controlId).concat(disabledControlIds),
    (id: string) => id,
  );
  const newControls: FormControl[] = controls.filter(item => !_.includes(newHidedControlIds, item.controlId));

  updateBaseConfig(dispatch, getState, { hidedControlIds: newHidedControlIds, controls: newControls });
  dispatch({ type: 'WORKSHEET_HIDE_CONTROL', controlId });
  dispatch({ type: 'PUBLICWORKSHEET_UPDATE_CONTROLS', controls: newControls });
};

export function showControl(showControls: FormControl[] = []) {
  return (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const {
      publicWorksheet: { controls, hidedControlIds, originalControls, worksheetSettings },
    } = state;

    // 【显式泛型】原 `reduce(…, [])` 的累加器被推断成 `never[]`；
    // 声明为 `FormControl[]` 后 `acc.concat(...)` 与后续 `control.controlId` 才成立，
    // 运行行为不变。
    const newShowControls = showControls.reduce<FormControl[]>((acc, control) => {
      // 将原始 controls 和已经处理过的控件合并，用于计算新控件位置
      const currentControls: FormControl[] = controls.concat(acc);
      const rowCol = getNewControlColRow(currentControls, control.half);
      return acc.concat({ ...control, col: rowCol.col, row: rowCol.row });
    }, []);

    //每次更改字段显隐时，需要将禁用的字段隐藏
    // 同 hideControl：范围外 helper 返回 unknown[]，在边界声明其契约类型
    const disabledControlIds = getDisabledControls(
      originalControls,
      worksheetSettings,
    ) as HidedControlId[];
    // 【等价修法】同 hideControl：显式传恒等 iteratee。
    const newHidedControlIds = _.uniqBy(
      hidedControlIds
        .concat(disabledControlIds)
        .filter((controlId: string) => !_.find(newShowControls, { controlId })),
      (id: string) => id,
    );
    const newControls: FormControl[] = controls.concat(
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
    });
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
export const clear = () => ({ type: 'PUBLICWORKSHEET_CLEAR' });
