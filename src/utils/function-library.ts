import dayjs from 'dayjs';
import _ from 'lodash';
import { isChildTableStore } from 'src/utils/subListStoreTypes';
import {
  functionNumeric,
  functionObject,
  functionRows,
  functionString,
  functionValue,
  parseFunctionValue,
} from './functionLibraryBoundary';
import type {
  CalculatedDate,
  CoordinateInput,
  FormattedFunctionValue,
  FunctionControl,
  FunctionDateInput,
  FunctionOption,
  FunctionRow,
} from './functionLibraryTypes';

function filterEmptyChildTableRows(rows: FunctionRow[] = []) {
  try {
    return rows.filter(row => !(row.rowid || '').startsWith('empty'));
  } catch (err) {
    console.error(err);
    return [];
  }
}

const isCustomOptionKey = (key: string) => key.indexOf('other') > -1 || key.indexOf('add_') > -1;

/** 获取选项 */
function getSelectedOptions(
  options: FunctionOption[] = [],
  value: unknown,
  control: FunctionControl,
): FunctionOption[] {
  if (!value || value === '[]') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(typeof value === 'string' ? value : String(value));
    if (!Array.isArray(parsed) || !parsed.every((key: unknown) => typeof key === 'string')) return [];
    const selectedKeys = parsed;
    const optionList = options || [];
    const optionMap = new Map<string | undefined, FunctionOption>();

    optionList.forEach(option => {
      if (!optionMap.has(option.key)) {
        optionMap.set(option.key, option);
      }
    });

    const selectedKeySet = new Set(selectedKeys.filter(key => !isCustomOptionKey(key)));
    const customSelectedKeys = selectedKeys.filter(isCustomOptionKey);

    const findOptionByKey = (key: string) => {
      if (isCustomOptionKey(key)) {
        return optionList.find(option => typeof option.key === 'string' && key.indexOf(option.key) > -1);
      }

      return optionMap.get(key);
    };

    const keys =
      control.advancedSetting?.checktype === '0'
        ? optionList
            .filter(
              option =>
                ((typeof option.key === 'string' && selectedKeySet.has(option.key)) ||
                  customSelectedKeys.some(
                    selectedKey => typeof option.key === 'string' && selectedKey.indexOf(option.key) > -1,
                  )) &&
                !option.isDeleted,
            )
            .flatMap(option => (typeof option.key === 'string' ? [option.key] : []))
        : selectedKeys;

    return keys.map(findOptionByKey).filter((option): option is FunctionOption => !!option);
  } catch (err) {
    console.log(err);
    return [];
  }
}

function transformLat(lng: number, lat: number) {
  let pi = 3.14159265358979324;
  let dLat = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  dLat += ((20.0 * Math.sin(6.0 * lng * pi) + 20.0 * Math.sin(2.0 * lng * pi)) * 2.0) / 3.0;
  dLat += ((20.0 * Math.sin(lat * pi) + 40.0 * Math.sin((lat / 3.0) * pi)) * 2.0) / 3.0;
  dLat += ((160.0 * Math.sin((lat / 12.0) * pi) + 320 * Math.sin((lat * pi) / 30.0)) * 2.0) / 3.0;
  return dLat;
}

function transformLng(lng: number, lat: number) {
  let pi = 3.14159265358979324;
  let dLng = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  dLng += ((20.0 * Math.sin(6.0 * lng * pi) + 20.0 * Math.sin(2.0 * lng * pi)) * 2.0) / 3.0;
  dLng += ((20.0 * Math.sin(lng * pi) + 40.0 * Math.sin((lng / 3.0) * pi)) * 2.0) / 3.0;
  dLng += ((150.0 * Math.sin((lng / 12.0) * pi) + 300.0 * Math.sin((lng / 30.0) * pi)) * 2.0) / 3.0;
  return dLng;
}

export function wgs84togcj02(longitude: CoordinateInput, latitude: CoordinateInput): [number, number] {
  let lng = parseFloat(typeof longitude === 'string' ? longitude : String(longitude));
  let lat = parseFloat(typeof latitude === 'string' ? latitude : String(latitude));
  let a = 6378245.0;
  let ee = 0.00669342162296594323;
  let pi = 3.14159265358979324;
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  let radLat = (lat / 180.0) * pi;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  let sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * pi);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * pi);
  let mgLat = lat + dLat;
  let mgLng = lng + dLng;
  return [mgLng, mgLat];
}

export function calcDate(date: FunctionDateInput, expression: string): CalculatedDate {
  if (!date) {
    return { error: true };
  }

  if (!/^[+-]/.test(expression)) {
    expression = '+' + expression;
  }

  try {
    let result = dayjs(date);
    const regexp = /([/+/-]){1}(\d+(\.\d+)?)+([YQMwdhms]){1}/g;
    let match = regexp.exec(expression);

    while (match) {
      const operator = match[1];
      const number = Number(match[2]);
      const unit = match[4];

      if ((operator === '+' || operator === '-') && number && unit) {
        const rounded = Math.round(number);
        if (unit === 'Q') {
          // Q is part of the saved expression protocol. Preserve the actual Dayjs method call
          // without installing a plugin that would change existing quarter expressions.
          const next: unknown = Reflect.apply(result[operator === '+' ? 'add' : 'subtract'], result, [rounded, unit]);
          if (!dayjs.isDayjs(next)) throw new TypeError('Date expression must return a Dayjs value');
          result = next;
        } else if (
          unit === 'Y' ||
          unit === 'M' ||
          unit === 'w' ||
          unit === 'd' ||
          unit === 'h' ||
          unit === 'm' ||
          unit === 's'
        ) {
          result = result[operator === '+' ? 'add' : 'subtract'](rounded, unit === 'Y' ? 'y' : unit);
        }
      }

      match = regexp.exec(expression);
    }

    return { result };
  } catch (err) {
    return { error: err };
  }
}

export function countChar(str = '', char: string) {
  if (!str || !char) {
    return 0;
  }

  try {
    return str.match(new RegExp(char, 'g'))?.length ?? 0;
  } catch (err) {
    console.log(err);
    return 0;
  }
}

/**
 * 对将复杂字段数据处理成简单数据 用来呈现或参与计算
 * return undefined string number bool [string] [number]
 */
export function formatControlValue(cell: FunctionControl | undefined, nullzero = '0'): FormattedFunctionValue {
  try {
    if (!cell) {
      return undefined;
    }

    let { type } = cell;
    let value: unknown = cell.value;

    if (type === 37) {
      if (cell.advancedSetting && cell.advancedSetting.summaryresult === '1') {
        type = 2;
        if (typeof value === 'symbol') throw new TypeError('Cannot convert a Symbol value to a string');
        value = Math.round(parseFloat(typeof value === 'string' ? value : String(value)) * 100) + '%';
      } else {
        type = cell.enumDefault2 || 6;
      }
    }

    if (type === 53) {
      type = cell.enumDefault2;
    }

    // 公式（数值）恒为数值；公式（日期）中"日期间的时长(1)/距离此刻的时长(3)"输出数值，"为日期加减时间(2)"输出日期
    if (type === 31 || (type === 38 && (cell.enumDefault === 1 || cell.enumDefault === 3))) {
      type = 6;
    }

    switch (type) {
      case 6: // NUMBER 数值
      case 8: // MONEY 金额
        return String(value).trim() !== '' && _.isNumber(Number(value)) && !_.isNaN(Number(value))
          ? Number(value)
          : nullzero === '1'
            ? 0
            : undefined;
      case 19: // AREA_INPUT 地区
      case 23: // AREA_INPUT 地区
      case 24: // AREA_INPUT 地区
        const area = parseFunctionValue(value);
        return functionObject(area) ? functionValue(area['name']) : undefined;
      case 17: // DATE_TIME_RANGE 时间段
      case 18: // DATE_TIME_RANGE 时间段
        if (value === '' || value === '["",""]') {
          return undefined;
        }

        return parseFunctionValue(value);
      case 40: // LOCATION 定位
        const location = parseFunctionValue(value) || {};
        if (!functionObject(location) && !Array.isArray(location)) {
          return undefined;
        }

        const rawCoordinate = functionObject(location) ? location['coordinate'] : undefined;
        const coordinate = rawCoordinate ? functionString(rawCoordinate) : '';
        if ((coordinate || '').toLowerCase() === 'wgs84') {
          const x = functionObject(location) ? location['x'] : undefined;
          const y = functionObject(location) ? location['y'] : undefined;
          if (
            (x !== undefined && x !== null && typeof x !== 'number' && typeof x !== 'string') ||
            (y !== undefined && y !== null && typeof y !== 'number' && typeof y !== 'string')
          )
            return undefined;
          const newPos = wgs84togcj02(x, y);
          return {
            ...location,
            x: newPos[0],
            y: newPos[1],
          };
        }

        return location;
      // 组件
      case 9: // OPTIONS 单选 平铺
      case 10: // MULTI_SELECT 多选
      case 11: // OPTIONS 单选 下拉
        const selectedOptions = getSelectedOptions(cell.options, cell.value, cell);
        return selectedOptions.map(option => {
          if (option.key === 'other') {
            const selected = parseFunctionValue(cell.value || '[]');
            if (!Array.isArray(selected) || !selected.every(item => typeof item === 'string'))
              throw new TypeError('Selected options must contain string keys');
            const matchText = selected.find(i => typeof i === 'string' && i.indexOf('other:') > -1);
            return matchText ? matchText.replace('other:', '') : option.value;
          }

          return option.value;
        });
      case 26: // USER_PICKER 成员
        const users = parseFunctionValue(value);
        return (Array.isArray(users) ? users : [users])
          .filter(user => !!user)
          .map(user => {
            if (typeof user === 'string') return user;
            if (!functionObject(user)) throw new TypeError('Member value must be a name or object');
            return functionString(user['fullname']);
          });
      case 27: // GROUP_PICKER 部门
        const departments = parseFunctionValue(value);
        if (!Array.isArray(departments)) return undefined;
        return departments.map(department => {
          if (typeof department === 'string') {
            return department;
          }

          if (!functionObject(department)) throw new TypeError('Department value must be a name or object');
          const departmentName = functionString(department['departmentName']);
          const departmentPath = department['departmentPath'];
          if (Array.isArray(departmentPath)) {
            return departmentPath
              .reverse()
              .map((path: unknown) => {
                if (!functionObject(path)) throw new TypeError('Department path must contain objects');
                return functionString(path['departmentName']);
              })
              .concat([departmentName])
              .join('/');
          }

          return departmentName ? departmentName : _l('该部门已删除');
        });
      case 48: // ORG_ROLE 组织角色
        const organizations = parseFunctionValue(value);
        if (!Array.isArray(organizations)) return undefined;
        return organizations.map(organization => {
          if (typeof organization === 'string') {
            return organization;
          }

          if (!functionObject(organization)) throw new TypeError('Organization value must be a name or object');
          const name = functionString(organization['organizeName']);
          return name ? name : _l('该组织已删除');
        });
      case 36: // SWITCH 检查框
        return value === '1' || value === 1;
      case 14: // ATTACHMENT 附件
        const attachments = parseFunctionValue(value);
        if (!Array.isArray(attachments)) return undefined;
        return attachments.map(attachment => {
          if (!functionObject(attachment)) throw new TypeError('Attachment value must be an object');
          const filename = functionString(attachment['originalFilename']);
          const ext = functionString(attachment['ext']);
          // Keep the original addition, including NaN for two absent fields and
          // the "undefined" prefix/suffix when just one filename part is absent.
          return filename === undefined && ext === undefined ? 'NaN' : (filename ?? 'undefined') + (ext ?? 'undefined');
        });
      case 35: // CASCADER 级联
        const cascader = parseFunctionValue(value);
        if (!Array.isArray(cascader) || !cascader.length) return undefined;
        const first = cascader[0];
        return functionObject(first) ? functionValue(first['name']) : undefined;
      case 29: // RELATESHEET 关联表
        let relateItems: FormattedFunctionValue[] | false;
        if (_.isNumber(functionNumeric(value)) && !_.isNaN(functionNumeric(value))) {
          relateItems = new Array<undefined>(functionNumeric(value)).fill(undefined);
        } else {
          const records = parseFunctionValue(value);
          relateItems =
            Array.isArray(records) &&
            records
              .map(record => {
                if (!functionObject(record)) throw new TypeError('Related value must be an object');
                return formatControlValue({ ...cell, type: cell.sourceControlType || 2, value: record['name'] });
              })
              .filter(_.identity);
        }

        if (cell.enumDefault === 1) {
          if (!Array.isArray(relateItems)) return undefined;
          return relateItems.slice(0, 1);
        }
        return relateItems;
      case 34: // SUBLIST 子表
        if (_.isObject(value)) {
          const rows = functionObject(value) ? value['rows'] : undefined;
          return filterEmptyChildTableRows(functionRows(rows === undefined ? [] : rows));
        } else if (isChildTableStore(cell.store)) {
          return filterEmptyChildTableRows(cell.store.getState()?.rows || []);
        } else {
          return [...new Array<undefined>(value ? Number(value) : 0)];
        }

      case 30: // SHEETFIELD 他表字段
        return formatControlValue({
          ...cell,
          type: cell.sourceControlType || 2,
          advancedSetting: cell.sourceControl?.advancedSetting || {},
        });
      case 46: // TIME 时间
        if (_.isEmpty(value)) {
          return '';
        }

        if (typeof value !== 'string') return undefined;
        return dayjs(value, countChar(value, ':') === 2 ? 'HH:mm:ss' : 'HH:mm').format(
          cell.unit === '6' || cell.unit === '9' ? 'HH:mm:ss' : 'HH:mm',
        );
      default:
        return functionValue(value);
    }
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.log(err);
    }

    return undefined;
  }
}
