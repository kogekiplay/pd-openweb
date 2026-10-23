import type { ChildSDKCondition as SDKCondition } from 'src/utils/subListStoreTypes';
import _ from 'lodash';
import DataFormat from 'src/components/Form/core/DataFormat';
import type { FormConditionRule } from 'src/components/Form/core/formUtils/types';
import type { MasterData } from 'src/components/Form/core/types';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget';
import { checkCellIsEmpty, controlState } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import { filterEmptyChildTableRows } from 'src/utils/record';
import { checkRulesErrorOfRow } from 'src/utils/rule';
import { FORM_ERROR_TYPE, FORM_ERROR_TYPE_TEXT, FROM } from '../../../core/config';
import { checkRuleLocked, checkValueByFilterRegex } from '../../../core/formUtils';

interface ChildRow {
  rowid?: string | undefined;
  [controlId: string]: unknown;
}
interface ChildColumn {
  controlId?: string | undefined;
  controlName?: string | undefined;
  width?: number | undefined;
}

type ErrorResult = Record<string, string | undefined>;
const { DATE_TIME_RANGE: dateTimeRangeMessage, ...controlErrorMessages } = FORM_ERROR_TYPE_TEXT;
const errorMessages: Readonly<Partial<Record<string, string | ((control: FormControl) => string | undefined)>>> =
  controlErrorMessages;

function property(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined;
}

function getControlCompareValue(c: FormControl, value: unknown): unknown {
  const key =
    c.type === 26
      ? 'accountId'
      : c.type === 29
        ? 'sid'
        : c.type === 27
          ? 'departmentId'
          : c.type === 48
            ? 'organizeId'
            : undefined;
  if (!key) return value;
  const parsed: unknown = safeParse(value, 'array');
  if (!Array.isArray(parsed)) throw new TypeError('Invalid child table selected values');
  return parsed
    .map((item: unknown) => property(item, key))
    .sort()
    .join('');
}

/** Collect field/rule errors and duplicate values for visible subtable fields. */
export function getSubListError(
  { rows, rules }: { rows: ChildRow[]; rules: FormConditionRule[] },
  controls: FormControl[] = [],
  showControls: string[] = [],
  from = 3,
  masterData?: MasterData,
): ErrorResult {
  const result: ErrorResult = {};

  try {
    // Every operation is synchronous. Do not turn thrown validation errors into unobserved rejected promises.
    filterEmptyChildTableRows(rows).forEach(row => {
      const rulesResult = checkRulesErrorOfRow({
        from,
        rules,
        controls: controls.filter(
          c =>
            c.controlId !== undefined &&
            (showControls.includes(c.controlId) ||
              rules.some(rule => (JSON.stringify(rule.filters) || '').includes(c.controlId || ''))),
        ),
        row,
      });
      const controldata = rulesResult.formData.filter(
        c =>
          c.controlId !== undefined &&
          showControls.includes(c.controlId) &&
          controlState(c).visible &&
          controlState(c).editable,
      );
      const isLock = checkRuleLocked(
        rules,
        rulesResult.formData.filter(
          c => c.controlId !== undefined && showControls.includes(c.controlId) && controlState(c).visible,
        ),
        row.rowid,
      );
      if (isLock) return;
      const formdata = new DataFormat({
        data: controldata.map(c => ({ ...c, isSubList: true })),
        from: FROM.NEWRECORD,
        masterData,
      });
      rulesResult.errors.forEach(errorItem => {
        if (showControls.includes(errorItem.controlId))
          result[row.rowid + '-' + errorItem.controlId] = errorItem.errorMessage;
      });
      formdata.getErrorControls().forEach(errorItem => {
        const errorControl = controldata.find(c => c.controlId === errorItem.controlId);
        if (!errorControl || !errorItem.errorType) return;
        const value: unknown = errorControl.value;
        const message = errorMessages[errorItem.errorType];

        if (errorItem.errorType === FORM_ERROR_TYPE.CUSTOM) {
          result[row.rowid + '-' + errorItem.controlId] = checkValueByFilterRegex(
            errorControl,
            typeof value === 'string' ? value : value === undefined ? undefined : String(value),
            controldata,
          );
        } else if (errorItem.errorType === FORM_ERROR_TYPE.DATE_TIME_RANGE) {
          result[row.rowid + '-' + errorItem.controlId] =
            errorItem.errorMessage || dateTimeRangeMessage(String(value ?? ''));
        } else if (typeof message === 'string') {
          result[row.rowid + '-' + errorItem.controlId] = message;
        } else if (message) {
          result[row.rowid + '-' + errorItem.controlId] = message(errorControl);
        } else {
          throw new TypeError('Unknown child table validation error');
        }
      });
    });
    controls
      .filter(c => c.controlId !== undefined && showControls.includes(c.controlId) && (c.unique || c.uniqueInRecord))
      .forEach(c => {
        const controlId = c.controlId;
        if (controlId === undefined) return;
        const hadValueRows = rows.filter(row => {
          const value = row[controlId];
          return (
            value !== undefined &&
            !checkCellIsEmpty(value) &&
            !(typeof value === 'string' && value.startsWith('deleteRowIds'))
          );
        });
        const uniqueValueRows = _.uniqBy(hadValueRows, row => getControlCompareValue(c, row[controlId]));

        if (hadValueRows.length !== uniqueValueRows.length) {
          const duplicateValueRows = hadValueRows.filter(vr => !uniqueValueRows.some(r => r.rowid === vr.rowid));
          duplicateValueRows.forEach(row => {
            const sameValueRows = hadValueRows.filter(
              r => getControlCompareValue(c, r[controlId]) === getControlCompareValue(c, row[controlId]),
            );
            if (sameValueRows.length > 1)
              sameValueRows.forEach(r => {
                result[r.rowid + '-' + controlId] = FORM_ERROR_TYPE_TEXT.UNIQUE();
              });
          });
        }
      });
    return result;
  } catch (err) {
    alert(_l('失败'), 3);
    console.log(err);
    throw err;
  }
}

export const addWidthToColumns = <T extends ChildColumn>(columns: T[], dataSource: ChildRow[]): T[] => {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.visibility = 'hidden';
  wrapper.style.whiteSpace = 'nowrap';
  wrapper.style.fontSize = '16px';
  document.body.appendChild(wrapper);
  const tempDiv = document.createElement('div');
  tempDiv.style.fontSize = '1em';
  wrapper.appendChild(tempDiv);
  try {
    return columns.map(col => {
      if (col.controlId === 'delete') return col;
      const values = [col.controlName, ...dataSource.map(row => row[String(col.controlId)] ?? '')];
      let maxTextWidth = 0;
      values.forEach(value => {
        tempDiv.innerText = String(value);
        maxTextWidth = Math.max(maxTextWidth, tempDiv.offsetWidth);
      });
      return { ...col, width: Math.min(200, Math.max(80, maxTextWidth + 30)) };
    });
  } finally {
    document.body.removeChild(wrapper);
  }
};

const RELATION_FILTER_TYPES = [
  WIDGETS_TO_API_TYPE_ENUM.USER_PICKER,
  WIDGETS_TO_API_TYPE_ENUM.DEPARTMENT,
  WIDGETS_TO_API_TYPE_ENUM.RELATE_SHEET,
  WIDGETS_TO_API_TYPE_ENUM.CASCADER,
  WIDGETS_TO_API_TYPE_ENUM.AREA_PROVINCE,
  WIDGETS_TO_API_TYPE_ENUM.AREA_CITY,
  WIDGETS_TO_API_TYPE_ENUM.AREA_COUNTY,
  WIDGETS_TO_API_TYPE_ENUM.ORG_ROLE,
];

function normalizeSDKFilterValueItem(v: unknown): unknown {
  if (typeof v === 'object' && v !== null) {
    return (
      property(v, 'accountId') ||
      property(v, 'id') ||
      property(v, 'departmentId') ||
      property(v, 'organizeId') ||
      property(v, 'rowid')
    );
  }

  if (typeof v === 'string' && v.startsWith('{')) {
    const parsed: unknown = safeParse(v);
    if (parsed && typeof parsed === 'object') return property(parsed, 'id') || property(parsed, 'accountId');
  }

  return v;
}

function sdkCondition(value: unknown): value is SDKCondition {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const get = (key: string): unknown => Reflect.get(value, key);
  const groups = get('groupFilters');
  return (
    (get('controlId') == null || typeof get('controlId') === 'string') &&
    ['dataType', 'spliceType', 'filterType', 'dateRange', 'dateRangeType'].every(
      k => get(k) == null || typeof get(k) === 'number',
    ) &&
    ['maxValue', 'minValue'].every(k => get(k) == null || typeof get(k) === 'string' || typeof get(k) === 'number') &&
    ['isGroup', 'isDynamicsource'].every(k => get(k) == null || typeof get(k) === 'boolean') &&
    ['values', 'dynamicSource'].every(k => get(k) == null || Array.isArray(get(k))) &&
    (groups == null || (Array.isArray(groups) && Array.from(groups).every(sdkCondition)))
  );
}

function normalizeSDKCondition(fc: SDKCondition): SDKCondition {
  const result: SDKCondition = {
    controlId: fc.controlId,
    dataType: fc.dataType,
    spliceType: fc.spliceType || 1,
    filterType: fc.filterType,
    dateRange: fc.dateRange,
    dateRangeType: fc.dateRangeType,
    maxValue: fc.maxValue,
    minValue: fc.minValue,
    isDynamicsource: fc.isDynamicsource,
    dynamicSource: fc.dynamicSource || [],
    value: fc.value,
    values: fc.values || [],
  };
  Object.keys(result).forEach(k => result[k] === undefined && delete result[k]);
  if (result.maxValue === '') delete result.maxValue;
  if (result.minValue === '') delete result.minValue;
  if (_.includes([15, 16], result.dataType) && result.filterType === 17 && result.dateRange === 18) {
    result.filterType = 37;
    result.dateRangeType = 1;
  }

  if (_.includes(RELATION_FILTER_TYPES, result.dataType) && result.values?.length) {
    result.values = result.values.map(normalizeSDKFilterValueItem).filter(Boolean);
  }

  return result;
}

/** Decode the SDK boundary before flattening conditions to the API's grouped representation. */
export function normalizeSDKFilterControls(filterControls: unknown): SDKCondition[] | null | undefined {
  if (filterControls === null) return null;
  if (filterControls === undefined) return undefined;
  if (!Array.isArray(filterControls) || !Array.from(filterControls).every(sdkCondition))
    throw new TypeError('Invalid SDK filter conditions');
  if (!filterControls.length) return filterControls;
  if (filterControls.some(fc => fc.isGroup && fc.groupFilters)) {
    return filterControls.map(fc =>
      fc.isGroup && fc.groupFilters
        ? { ...fc, groupFilters: fc.groupFilters.map(normalizeSDKCondition) }
        : normalizeSDKCondition(fc),
    );
  }

  const normalizedConditions = filterControls.map(normalizeSDKCondition);
  return [{ isGroup: true, spliceType: normalizedConditions[0]?.spliceType || 1, groupFilters: normalizedConditions }];
}
