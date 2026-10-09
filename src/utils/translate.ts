import _ from 'lodash';
import { getTranslateInfo } from 'src/utils/app';
import type { TranslateInfo } from 'src/utils/app';
import type { ControlAdvancedSetting, FormControl, WorksheetCustomBtn } from 'src/utils/controlTypes';
import { isTranslationConfirmation, isTranslationItems } from './translateTypes';
import type { TranslationAdvancedSetting } from './translateTypes';

type TranslatedControl = FormControl & { advancedSetting?: TranslationAdvancedSetting | undefined };

const replaceOptionControlTranslateInfo = (
  data: TranslatedControl,
  { translateInfo, optionTranslateInfo }: { translateInfo: TranslateInfo; optionTranslateInfo: TranslateInfo },
) => {
  if (!data.options) throw new TypeError('Option controls require options');
  data.options = data.options.map(item => {
    return {
      ...item,
      value: item.value ? optionTranslateInfo[item.key] || item.value : '',
    };
  });
  if (data.advancedSetting?.otherhint) {
    data.advancedSetting.otherhint = translateInfo.otherhint || data.advancedSetting.otherhint;
  }
};

export const replaceControlsTranslateInfo = (
  appId: string,
  worksheetId: string | undefined,
  controls: FormControl[] = [],
) => {
  if (!window[`langData-${appId}`]) return controls;
  return controls.map(c => {
    const translateInfo = getTranslateInfo(appId, worksheetId, c.controlId);
    const { advancedSetting = {} } = c;
    const data = {
      ...c,
      controlName: translateInfo.name || c.controlName,
      hint: c.hint ? translateInfo.hintText || c.hint : '',
    };

    // 选项
    if ([9, 10, 11].some(type => type === c.type)) {
      const optionTranslateInfo = c.dataSource ? getTranslateInfo(appId, null, c.dataSource) : translateInfo;
      replaceOptionControlTranslateInfo(data, { translateInfo, optionTranslateInfo });
    }

    // 检查项
    if (c.type === 36 && advancedSetting.itemnames) {
      const itemnames: unknown = safeParse(advancedSetting.itemnames, null);

      if (isTranslationItems(itemnames)) {
        const newItemnames = itemnames.map(item => {
          return {
            ...item,
            value: item.value ? translateInfo[item.key] || item.value : '',
          };
        });
        advancedSetting.itemnames = JSON.stringify(newItemnames);
      }
    }

    // 数值
    if ([6, 8, 31].some(type => type === c.type) && (advancedSetting.suffix || advancedSetting.prefix)) {
      if (advancedSetting.suffix) {
        advancedSetting.suffix = translateInfo.suffix || advancedSetting.suffix;
      }

      if (advancedSetting.prefix) {
        advancedSetting.prefix = translateInfo.prefix || advancedSetting.prefix;
      }
    }

    // 子表 || 关联表
    if (c.type === 34 || c.type === 29) {
      if (data.sourceBtnName) {
        const translateInfo = getTranslateInfo(appId, null, data.dataSource);
        data.sourceBtnName = translateInfo.createBtnName || data.sourceBtnName;
      }

      data.relationControls = replaceControlsTranslateInfo(appId, data.dataSource, data.relationControls);
    }

    // 他表字段
    if (c.type === 30) {
      if (typeof c.dataSource !== 'string') throw new TypeError('Source controls require a data source');
      const { dataSource } = _.find(controls, { controlId: c.dataSource.replace(/\$/g, '') }) || {};

      // 选项集
      if (c.sourceControl?.dataSource && [9, 10, 11].some(type => type === c.sourceControlType)) {
        const optionTranslateInfo = getTranslateInfo(appId, null, c.sourceControl.dataSource);
        replaceOptionControlTranslateInfo(data, { translateInfo, optionTranslateInfo });
      } else {
        // 普通控件
        if (dataSource && [9, 10, 11].some(type => type === c.sourceControlType)) {
          const optionTranslateInfo = getTranslateInfo(appId, dataSource, data.sourceControlId);
          replaceOptionControlTranslateInfo(data, { translateInfo, optionTranslateInfo });
        }
      }
    }

    // 填充备注字段内容
    if (c.type === 10010) {
      data.dataSource = c.dataSource ? translateInfo.remark || c.dataSource : '';
    } else {
      data.desc = c.desc ? translateInfo.description || c.desc : '';
    }

    return data;
  });
};

export const replaceAdvancedSettingTranslateInfo = (
  appId: string,
  worksheetId: string,
  advancedSetting: ControlAdvancedSetting = {},
) => {
  const translateInfo = getTranslateInfo(appId, null, worksheetId);
  const data: TranslationAdvancedSetting = {
    ...advancedSetting,
    title: advancedSetting.title ? translateInfo.formTitle || advancedSetting.title : '',
    sub: advancedSetting.sub ? translateInfo.formSub || advancedSetting.sub : '',
    continue: advancedSetting.continue ? translateInfo.formContinue || advancedSetting.continue : '',
    deftabname: advancedSetting.deftabname ? translateInfo.defaultTabName || advancedSetting.deftabname : '',
    btnname: advancedSetting.btnname ? translateInfo.createBtnName || advancedSetting.btnname : '',
  };

  if (data.doubleconfirm) {
    const doubleconfirm: unknown = safeParse(data.doubleconfirm, null);

    if (isTranslationConfirmation(doubleconfirm)) {
      data.doubleconfirm = JSON.stringify({
        confirmMsg: doubleconfirm.confirmMsg ? translateInfo.confirmMsg || doubleconfirm.confirmMsg : '',
        confirmContent: doubleconfirm.confirmContent
          ? translateInfo.confirmContent || doubleconfirm.confirmContent
          : '',
        sureName: doubleconfirm.sureName ? translateInfo.sureName || doubleconfirm.sureName : '',
        cancelName: doubleconfirm.cancelName ? translateInfo.cancelName || doubleconfirm.cancelName : '',
      });
    }
  }

  return data;
};

/** 规则里被翻译的是 ruleItems[0].message（只有 type === 1 的校验规则有） */
type TranslatableRule = {
  ruleId?: string | undefined;
  type?: number | undefined;
  ruleItems?: Array<{ message?: string | undefined }> | undefined;
};

// 【泛型而不是 any[]】函数原地改 message 再把同一批对象还回去，用 T 能保住调用方的规则类型
export const replaceRulesTranslateInfo = <T extends TranslatableRule>(
  appId: string,
  worksheetId: string,
  rules: T[],
) => {
  return rules.map(rule => {
    const translateInfo = getTranslateInfo(appId, worksheetId, rule.ruleId);

    if (rule.type === 1 && rule.ruleItems && rule.ruleItems[0] && rule.ruleItems[0].message) {
      rule.ruleItems[0].message = translateInfo.message || rule.ruleItems[0].message;
    }

    return rule;
  });
};

// 【不用泛型】按钮的消费方（RecordOperate / BatchOperate / recordInfo）读的是同一组
// 固定字段，直接标成 WorksheetCustomBtn 更准；泛型反而会在推不出 T 时退回约束本身，
// 把 disabled / clickType 这些字段挡掉。
export const replaceBtnsTranslateInfo = (appId: string, btns: WorksheetCustomBtn[] = []) => {
  if (!window[`langData-${appId}`]) return btns;
  return btns.map(btn => {
    const translateInfo = getTranslateInfo(appId, null, btn.btnId);
    return {
      ...btn,
      name: translateInfo.name || btn.name,
      desc: btn.desc ? translateInfo.description || btn.desc : '',
    };
  });
};
