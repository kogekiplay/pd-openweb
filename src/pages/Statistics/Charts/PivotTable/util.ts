import type { CSSProperties } from 'react';
import _ from 'lodash';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget';
import { dealMaskValue } from 'src/pages/widgetConfig/widgetSetting/components/WidgetSecurity/util';
import {
  addRangeValues,
  cellObject,
  greaterThan,
  greaterThanOrEqual,
  isCellObject,
  lessThan,
  lessThanOrEqual,
  lookup,
  numeric,
  requireItem,
} from './boundary';
import type {
  AxisField,
  ColorRule,
  ColorRuleConfig,
  CompiledColorRule,
  CompiledDataBarRule,
  CompiledStyleRule,
  ControlMinAndMax,
  DataBarRule,
  PivotLineData,
  PivotRecord,
  PivotResultItem,
  PivotSetting,
  Range,
  ScopeRule,
  StyleRule,
} from './types';

interface MergeConfig {
  pageSize?: number | undefined;
  defaultEmpty?: string | undefined;
  mergeCell?: boolean | undefined;
}
interface MergeColumn {
  index?: number;
  data: unknown[];
  xaxisEmptyType?: number | boolean | undefined;
}
interface MergeLinesConfig {
  pageSize?: number | undefined;
  freeze?: boolean | undefined;
  freezeIndex?: number | undefined;
  mergeCell?: boolean | undefined;
}

/**
 * 将连续的单元格合并
 */
export const uniqMerge = (data: unknown[], config: MergeConfig): unknown[] => {
  const { pageSize, defaultEmpty, mergeCell = true } = config;
  data = data.map(item => item || defaultEmpty);
  for (let i = data.length - 1; i >= 0; i--) {
    let current = data[i];
    let last = data[i - 1];

    if (mergeCell && current == last && (pageSize ? i % pageSize : true)) {
      data[i] = null;
      data[i - 1] = {
        value: last,
        length: 2,
      };
    }

    if (isCellObject(current) && mergeCell && current.value === last && (pageSize ? i % pageSize : true)) {
      data[i - 1] = {
        value: last,
        length: numeric(current.length) + 1,
      };
      data[i] = null;
    }
  }

  return data;
};

/**
 * 多维度单元格合并
 */
export function mergeTableCell(list: PivotLineData[], pageSize?: number, mergeCell?: boolean): PivotLineData[];
export function mergeTableCell(list: MergeColumn[], pageSize?: number, mergeCell?: boolean): MergeColumn[];
export function mergeTableCell(list: MergeColumn[], pageSize?: number, mergeCell?: boolean): MergeColumn[] {
  list.map((item, index: number) => {
    const last = list[index - 1];
    const defaultEmpty = item.xaxisEmptyType ? '--' : ' ';

    if (last) {
      let data = last.data.map((n, i) => {
        if (isCellObject(n)) {
          if (n.sum) {
            return item.data[i];
          }

          let end = i + numeric(n.length);
          return uniqMerge(item.data.slice(i, end), { pageSize, defaultEmpty, mergeCell });
        } else if (_.isString(n)) {
          return item.data[i] || defaultEmpty;
        } else {
          return false;
        }
      });
      item.data = _.flatten(data.filter(item => item));
    } else {
      item.data = uniqMerge(item.data, { pageSize, defaultEmpty, mergeCell });
    }

    return item;
  });
  return list;
}

/**
 * 合并列
 */
export const mergeColumnsCell = (
  data: PivotResultItem[],
  columns: AxisField[],
  yaxisList: AxisField[],
): PivotResultItem[] => {
  data = _.cloneDeep(data).filter(item => {
    const yaxis = _.find(yaxisList, { controlId: item.t_id });
    return yaxis ? !yaxis.hide : true;
  });
  const length = data.find(item => item.summary_col === false)?.y.length || 0;
  const result: MergeColumn[] = [];

  for (let i = 0; i < length; i++) {
    result.push({
      index: i,
      xaxisEmptyType: requireItem(columns[i]).xaxisEmptyType,
      data: [],
    });
    data
      .filter(item => !item.summary_col)
      .forEach(item => {
        if (item.y && item.y.length) {
          requireItem(result[i]).data.push(item.y[i]);
        }
      });
  }

  mergeTableCell(result).forEach((item, index: number) => {
    item.data.forEach((n, i) => {
      requireItem(data.filter(item => !item.summary_col)[i]).y[index] = n;
    });
  });

  return data;
};

export const renderValue = (value: unknown, advancedSetting: PivotSetting): unknown => {
  const result: unknown = dealMaskValue({ value, advancedSetting });
  return result;
};

const getTotalCount = (data: Record<string, string[]>[], index: number): (string | null)[] => {
  return data
    .map(item => {
      const key = requireItem(Object.keys(item)[0]);
      const res = requireItem(item[key]);
      const value = requireItem(res[index]);
      return value.includes('subTotal') ? value : null;
    })
    .filter(_ => _);
};

/**
 * 合并行
 */
export const mergeLinesCell = (
  data: Record<string, string[]>[],
  lines: AxisField[],
  valueMap: Record<string, Record<string, unknown>>,
  config: MergeLinesConfig,
): PivotLineData[] => {
  const { pageSize, freeze, freezeIndex, mergeCell = true } = config;
  const fIndex = numeric(freezeIndex) + 1;
  const isFreeze = freeze && _.isNumber(freezeIndex);

  const sourceLines: PivotLineData[] = data.map((item, index: number) => {
    const key = requireItem(Object.keys(item)[0]);
    const res = requireItem(item[key]).map((value, valueIndex) => {
      if (value.includes('subTotal')) {
        const freezeData = isFreeze && freezeIndex ? data.slice(0, index <= freezeIndex ? fIndex : index) : data;
        const rightLength = getTotalCount(freezeData.slice(index + 1, freezeData.length), valueIndex).length + 1;
        const leftLength = getTotalCount(freezeData.slice(0, index), valueIndex).length;

        if (!leftLength && rightLength) {
          const showLine = requireItem(data[data.length - rightLength]);
          const showId = requireItem(Object.keys(showLine)[0]);
          return {
            value,
            length: rightLength,
            sum: true,
            subTotalName: lines.find(line => line.cid === showId)?.subTotalName || _l('总计'),
          };
        } else {
          if (isFreeze && freezeIndex) {
            return index <= freezeIndex ? `subTotalEmpty-${valueIndex}` : `subTotalFreezeEmpty-${valueIndex}`;
          }

          return `subTotalEmpty-${valueIndex}`;
        }
      }

      return value;
    });
    const target: Partial<AxisField> = lines.find(line => line.cid === key) || {};
    const name = target.rename || target.controlName;
    const { xaxisEmptyType } = target;
    /*
      if (isTime) {
        return {
          key,
          xaxisEmptyType,
          name: target.particleSizeType
            ? `${name}(${_.find(timeParticleSizeDropdownData, { value: target.particleSizeType }).text})`
            : name,
          data: res,
        };
      }
      if (isArea) {
        return {
          key,
          xaxisEmptyType,
          name: target.particleSizeType
            ? `${name}(${_.find(areaParticleSizeDropdownData, { value: target.particleSizeType }).text})`
            : name,
          data: res,
        };
      }
      */
    return {
      key,
      xaxisEmptyType,
      name,
      data: res,
    };
  });
  const result = mergeTableCell(sourceLines, pageSize, mergeCell);

  const parse = (value: unknown): unknown => {
    let result = value;

    try {
      let res: unknown = JSON.parse(String(value));

      if (_.isArray(res)) {
        res = res.map(item => {
          return parse(item);
        });
      }

      result = res;
    } catch (err) {
      console.log(err);
    }

    return result;
  };

  result.forEach(item => {
    const control: Partial<AxisField> = lines.find(line => line.cid === item.key) || {};
    const advancedSetting = control.advancedSetting || {};
    const defaultEmpty = item.xaxisEmptyType ? '--' : ' ';
    item.data = item.data.map(n => {
      if (_.isNull(n)) return n;
      // 异化下，检查项不匹配 valueMap
      const valueKey =
        control.displayMode === 'fieldStyle' &&
        control.controlType === WIDGETS_TO_API_TYPE_ENUM.SWITCH &&
        advancedSetting.showtype === '0'
          ? {}
          : valueMap[item.key];

      if (isCellObject(n)) {
        const raw = cellObject(n);
        const value = raw.value;
        const defaultValue = typeof value === 'string' && value.includes('subTotal') ? value : defaultEmpty;
        return {
          ...raw,
          value: valueKey
            ? lookup(valueKey, value)
              ? renderValue(lookup(valueKey, value), advancedSetting)
              : value || defaultValue
            : renderValue(value, advancedSetting),
        };
      } else {
        const defaultValue = typeof n === 'string' && n.includes('subTotal') ? n : defaultEmpty;
        return valueKey
          ? lookup(valueKey, n)
            ? renderValue(lookup(valueKey, n), advancedSetting)
            : n || defaultValue
          : renderValue(n, advancedSetting);
      }
    });
    if (control.controlType === 29) {
      item.data = item.data.map(item => {
        if (isCellObject(item)) {
          return {
            ...item,
            value: parse(item.value),
          };
        } else {
          return parse(item);
        }
      });
    }
  });

  return result;
};

export const getColumnName = (column: Partial<AxisField>) => {
  const { rename, controlName } = column;
  const name = rename || controlName;
  /*
  const isTime = isTimeControl(controlType);
  const isArea = isAreaControl(controlType);
  if (isTime) {
    return particleSizeType
      ? `${name}(${_.find(timeParticleSizeDropdownData, { value: particleSizeType }).text})`
      : name;
  }
  if (isArea) {
    return particleSizeType
      ? `${name}(${_.find(areaParticleSizeDropdownData, { value: particleSizeType }).text})`
      : name;
  }
  */
  return name;
};

export const getControlMinAndMax = (yaxisList: AxisField[], data: PivotResultItem[]): ControlMinAndMax => {
  const result: ControlMinAndMax = {};
  const valuesMap: Record<string, unknown[][]> = {};

  yaxisList.forEach(item => {
    valuesMap[item.controlId] = [];
  });

  data.forEach(item => {
    if (!item.summary_col && Object.prototype.hasOwnProperty.call(valuesMap, item.t_id)) {
      valuesMap[item.t_id]?.push(item.data);
    }
  });

  yaxisList.forEach(item => {
    const values: unknown[] = _.flatten(valuesMap[item.controlId] || []);
    const min = _.min(values) || 0;
    const max = _.max(values);
    const center = numeric(addRangeValues(max, min)) / 2;

    result[item.controlId] = {
      min,
      max,
      center,
    };
  });

  return result;
};

const isApplyStyle = (applyValue: number | undefined, recordKey: string | number | undefined) => {
  if (applyValue === 1) {
    return recordKey !== 'sum';
  }

  if (applyValue === 2) {
    return true;
  }

  if (applyValue === 3) {
    return recordKey === 'sum';
  }
  return undefined;
};

const getCompiledScopeRuleColor = (
  value: unknown,
  controlMinAndMax: Range = {},
  scopeRules: ScopeRule[] = [],
  emptyShowType?: number,
) => {
  let result: string | null | undefined = null;

  scopeRules.forEach(rule => {
    const { type, and, color } = rule;
    const minValue = rule.dynamicMin ? controlMinAndMax.min || 0 : rule.min;
    const maxValue = rule.dynamicMax ? controlMinAndMax.max || 0 : rule.max;

    if (type === 1 && greaterThan(value, minValue)) {
      if (and === 5 && lessThan(value, maxValue)) {
        result = color;
      }

      if (and === 6 && lessThanOrEqual(value, maxValue)) {
        result = color;
      }
    }

    if (type === 2 && greaterThanOrEqual(value, minValue)) {
      if (and === 5 && lessThan(value, maxValue)) {
        result = color;
      }

      if (and === 6 && lessThanOrEqual(value, maxValue)) {
        result = color;
      }
    }

    if (type === 3 && value === rule.value) {
      result = color;
    }

    if (type === 4 && (emptyShowType === 1 ? _.isNull(value) : !value)) {
      result = color;
    }
  });

  return result;
};

export const getCompiledStyleColor = ({
  value = 0,
  controlMinAndMax = {},
  rule,
  controlId,
  record = {},
  emptyShowType,
}: {
  value?: unknown;
  controlMinAndMax?: ControlMinAndMax;
  rule: CompiledStyleRule;
  controlId?: string | undefined;
  record?: Partial<PivotRecord>;
  emptyShowType?: number | undefined;
}) => {
  const { model, applyValue } = rule;

  if (model === 1 && isApplyStyle(applyValue, record.key)) {
    const applyControl = rule.rangeControlId ? controlMinAndMax[rule.rangeControlId] : undefined;
    const minValue = _.isNumber(rule.minValue) ? rule.minValue : applyControl ? applyControl.min : 0;
    const maxValue = _.isNumber(rule.maxValue) ? rule.maxValue : applyControl ? applyControl.max : 0;
    const centerValue = _.isNumber(rule.centerValue) ? rule.centerValue : applyControl ? applyControl.center : 0;
    let percent = 0;

    if (rule.centerVisible) {
      percent = ((numeric(value) - numeric(centerValue)) / (numeric(maxValue) - numeric(centerValue))) * 50 + 50;
    } else {
      percent = ((numeric(value) - numeric(minValue)) / (numeric(maxValue) - numeric(minValue))) * 100;
    }

    percent = parseInt(String(percent));
    if (lessThanOrEqual(value, minValue)) {
      percent = 0;
    }

    if (value === centerValue) {
      percent = 50;
    }

    if (greaterThanOrEqual(value, maxValue)) {
      percent = 100;
    }

    if (percent >= 100) {
      percent = 99;
    }

    if (percent <= 0) {
      percent = 0;
    }

    return requireItem(rule.colors)[percent];
  }

  if (model === 2) {
    return getCompiledScopeRuleColor(
      value,
      controlMinAndMax[String(rule.rangeControlId || controlId)],
      rule.scopeRules,
      emptyShowType,
    );
  }
  return undefined;
};

export const getCompiledBarStyleColor = ({
  value,
  controlMinAndMax = {},
  rule,
}: {
  value: unknown;
  controlMinAndMax?: Range | undefined;
  rule: CompiledDataBarRule;
}): CSSProperties => {
  const minValue = _.isNumber(rule.minValue) ? rule.minValue : rule.useDefaultMin ? 0 : controlMinAndMax.min || 0;
  const maxValue = _.isNumber(rule.maxValue) ? rule.maxValue : controlMinAndMax.max || 0;
  const barStyle: CSSProperties = {};

  if (rule.direction === 1) {
    barStyle.left = 0;
  }

  if (rule.direction === 2) {
    barStyle.right = 0;
  }

  let percent = parseInt(
    String(((numeric(value) - numeric(minValue)) / (numeric(maxValue) - numeric(minValue))) * 100),
  );

  if (percent >= 100) {
    percent = 100;
  }

  if (percent <= 0) {
    percent = 0;
  }

  if (lessThan(value, minValue)) {
    percent = 0;
  }

  if (rule.axisColor) {
    barStyle[rule.direction === 1 ? 'borderLeft' : 'borderRight'] = `1px dashed ${rule.axisColor}`;
  }

  barStyle.width = `${percent}%`;
  barStyle.backgroundColor = numeric(value) >= 0 ? rule.positiveNumberColor : rule.negativeNumberColor;
  return barStyle;
};

export const getStyleRuleValue = ({
  rule,
  value,
  controlId,
  columnIndex,
  record,
  recordIndex,
  result,
}: {
  rule: CompiledStyleRule;
  value: unknown;
  controlId: string;
  columnIndex: number;
  record: PivotRecord;
  recordIndex: number;
  result: PivotResultItem[];
}): unknown => {
  if (controlId === rule.sourceControlId) {
    return value;
  }

  if (record.type === 'line') {
    const colorRuleData = result[columnIndex + numeric(rule.sourceIndex)];
    return colorRuleData?.sum;
  } else {
    const colorRuleData = result[columnIndex + numeric(rule.sourceIndex)]?.data || [];
    return colorRuleData[recordIndex];
  }
};

export const compileColorRuleConfig = (yaxisList: AxisField[], colorRules: ColorRule[] = []): ColorRuleConfig => {
  const yaxisMap: Record<string, AxisField> = {};
  const yaxisIndexMap: Record<string, number> = {};
  const colorRuleMap: Record<string, CompiledColorRule> = {};
  const rangeControlIdMap: Record<string, boolean> = {};

  const addRangeControlId = (id: string | undefined): void => {
    if (id) {
      rangeControlIdMap[id] = true;
    }
  };

  yaxisList.forEach((item, index: number) => {
    yaxisMap[item.controlId] = item;
    yaxisIndexMap[item.controlId] = index;
  });

  const compileStyleRule = (rule: StyleRule | undefined, defaultControlId: string): CompiledStyleRule => {
    if (!rule || !rule.model) {
      return {};
    }

    const sourceControlId = rule.controlId;
    const sourceIndex =
      typeof yaxisIndexMap[String(sourceControlId)] === 'number' ? yaxisIndexMap[String(sourceControlId)] : -1;
    const data = {
      ...rule,
      sourceControlId,
      sourceIndex,
    };

    if (rule.model === 1) {
      const { min = {}, max = {}, center = {}, centerVisible, controlId } = rule;
      const needMinMax = !_.isNumber(min.value) || !_.isNumber(max.value);
      const needCenter = centerVisible && !_.isNumber(center.value);

      if (needMinMax || needCenter) {
        addRangeControlId(controlId);
      }

      return {
        ...data,
        rangeControlId: controlId,
        minValue: _.isNumber(min.value) ? min.value : undefined,
        maxValue: _.isNumber(max.value) ? max.value : undefined,
        centerValue: _.isNumber(center.value) ? center.value : undefined,
      };
    }

    if (rule.model === 2) {
      const rangeControlId = rule.controlId || defaultControlId;
      const scopeRules = (rule.scopeRules || []).map(item => {
        return {
          ...item,
          dynamicMin: item.type !== undefined && [1, 2].includes(item.type) && !_.isNumber(item.min),
          dynamicMax: item.type !== undefined && [1, 2].includes(item.type) && !_.isNumber(item.max),
        };
      });
      const needRange = scopeRules.some(item => item.dynamicMin || item.dynamicMax);

      if (needRange) {
        addRangeControlId(rangeControlId);
      }

      return {
        ...data,
        rangeControlId,
        scopeRules,
      };
    }

    return data;
  };

  const compileDataBarRule = (rule: DataBarRule | undefined, controlId: string): CompiledDataBarRule | undefined => {
    if (!rule) {
      return undefined;
    }

    const useDefaultMin = _.isUndefined(rule.min);
    const dynamicMin = !useDefaultMin && !_.isNumber(rule.min);
    const dynamicMax = !_.isNumber(rule.max);

    if (dynamicMin || dynamicMax) {
      addRangeControlId(controlId);
    }

    return {
      ...rule,
      rangeControlId: controlId,
      useDefaultMin,
      dynamicMin,
      dynamicMax,
      minValue: _.isNumber(rule.min) ? rule.min : undefined,
      maxValue: _.isNumber(rule.max) ? rule.max : undefined,
    };
  };

  colorRules.forEach(item => {
    if (item && item.controlId) {
      colorRuleMap[item.controlId] = {
        ...item,
        textColorRule: compileStyleRule(item.textColorRule, item.controlId),
        bgColorRule: compileStyleRule(item.bgColorRule, item.controlId),
        dataBarRule: compileDataBarRule(item.dataBarRule, item.controlId),
      };
    }
  });

  return {
    yaxisMap,
    yaxisIndexMap,
    colorRuleMap,
    rangeControlIds: yaxisList.map(item => item.controlId).filter(id => rangeControlIdMap[id]),
  };
};

export const getLineSubTotal = (data: unknown[] = [], index: number): string => {
  let count = '';

  for (let i = index; i < data.length; i++) {
    const value = data[i];
    if (typeof value === 'string' && value && value.includes('subTotal')) {
      count = value;
      break;
    }
  }

  return count;
};
