import dayjs from 'dayjs';
import _, { isNaN } from 'lodash';
import qs from 'query-string';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget';
import type { FormControl } from 'src/utils/controlTypes';
import { formatControlValue } from 'src/utils/function-library';
import { functions } from './enum';
import type {
  FunctionCompletion,
  FunctionRunOptions,
  FunctionRunResult,
  FunctionTask,
  FunctionWorker,
} from './execTypes';
import { initLang } from './local';

function isMessageRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function messageRecord(value: unknown): Record<string, unknown> | undefined {
  return isMessageRecord(value) ? value : undefined;
}
function dateResult(value: unknown): string | number | Date | dayjs.Dayjs | null {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date || dayjs.isDayjs(value)
    ? value
    : null;
}

const execWorkerCode = `onmessage = function (e) {
  try {
  const result = new Function(e.data)();
  if (typeof result === 'object' && typeof result.then === 'function') {
      postMessage('promise begin');
      Promise.all([result]).then(function ([value]) {
        postMessage('promise value ' + value);
        postMessage({
          type: 'over',
          value,
        });
      });
    } else {
      postMessage({
        type: 'over',
        value: new Function(e.data)(),
      });
    }
  } catch (err) {
    postMessage({
      type: 'error',
      err,
    });
  }
};
`;

function genFunctionWorker() {
  return new Worker('data:application/javascript,' + encodeURIComponent(execWorkerCode));
}

class Runner {
  declare max: number;
  declare runningCount: number;
  declare isRunning: boolean;
  declare queue: unknown[];
  declare workers: FunctionWorker[];
  declare list: FunctionTask[];

  constructor({ max = 10 } = {}) {
    this.max = max;
    this.runningCount = 0;
    this.queue = [];
    this.workers = [];
    this.list = [];
    this.isRunning = false;
  }
  getWorker() {
    const idleWorker = this.workers.filter(w => w.idle)[0];

    if (idleWorker) {
      return idleWorker;
    } else if (this.workers.length < this.max) {
      const newWorker = {
        worker: genFunctionWorker(),
        idle: false,
        id: Math.random(),
      };
      this.workers.push(newWorker);
      return newWorker;
    }
    return undefined;
  }
  run() {
    const workerObj = this.getWorker();

    if (!workerObj) {
      return;
    }

    const item = this.list.shift();

    if (!item) {
      this.isRunning = false;
      return;
    }

    const { code, cb, timeout } = item;
    workerObj.idle = false;
    this.isRunning = true;
    this.runningCount++;
    const afterRun = () => {
      workerObj.idle = true;
      this.runningCount--;
      this.run();
    };

    let timer: NodeJS.Timeout | undefined;

    workerObj.worker.onmessage = (msg: MessageEvent<unknown>) => {
      const data = messageRecord(msg.data);
      if (!data) return;
      const outerError: unknown = Reflect.get(msg, 'err');
      if (data['type'] === 'begin') {
        timer = setTimeout(() => {
          workerObj.worker.terminate();
          this.workers = this.workers.filter(w => w.id !== workerObj.id);
          afterRun();
          cb(timeout + 'ms time out');
        }, timeout);
      }

      if (data['type'] === 'over') {
        afterRun();

        cb(null, data['value']);
        clearTimeout(timer);
      }

      if (data['type'] === 'error') {
        console.error(outerError || data['err']);
        afterRun();
        cb(outerError || data['err']);
        clearTimeout(timer);
      }
    };

    workerObj.worker.postMessage(code);
  }
  push({ code, cb, timeout }: FunctionTask) {
    this.list.push({ code, cb, timeout });
    if (this.runningCount < this.max) {
      this.run();
    }
  }
}

const runner = new Runner();

/**
 * 2023 9 25
 * 函数运行方式改为走队列，最多只创建 10 个worker，解决了子表多记录时运行几百个函数导致的卡顿和超时问题。
 * 问题：
 * 现在瓶颈在表格更新端，函数运行挺快的但更新到表格时还是挨个单元格更新。
 */

function asyncRun(code: string, cb: FunctionCompletion, { timeout = 1000 } = {}) {
  runner.push({ code, cb, timeout });
  // 测试使用，下面的写法是同步运行函数。
  // const result = eval('function run() { ' + code + ' } run()');
  // cb(null, result);
}

function replaceControlIdToValue(expression: string, formData: FormControl[], nullzero = '0', inString?: boolean) {
  expression = expression.replace(/\$(.+?)\$/g, matched => {
    const controlId = matched.slice(1, -1);
    const control = _.find(formData, obj => obj.controlId === controlId);

    if (!control) {
      // 找不到控件：原先 return 了 undefined，replace 会把它转成字符串 'undefined' 插进表达式，求值时就是 JS 的 undefined。写明，行为不变
      return 'undefined';
    }

    let value: unknown = formatControlValue(control, nullzero);

    if (typeof value === 'string' && !inString) {
      value = `'${value.replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
    } else if (typeof value === 'object') {
      value = JSON.stringify(value);
    }

    return typeof value === 'string' ? value : `(${value})`;
  });
  if (expression.indexOf('SYSTEM_URL_PARAMS') > -1) {
    try {
      expression = `var SYSTEM_URL_PARAMS=${JSON.stringify(qs.parse(location.search))};` + expression;
    } catch (err) {
      console.log(err);
    }
  }

  return expression;
}

function formatFunctionResult(control: FormControl, value: unknown): unknown {
  const controlType = _.get(control, 'type') === 53 ? _.get(control, 'enumDefault2') : control.type;
  let result = value;

  switch (controlType) {
    case WIDGETS_TO_API_TYPE_ENUM.TEXT:
      result = _.isUndefined(result) ? '' : result;
      break;
    case WIDGETS_TO_API_TYPE_ENUM.SWITCH:
      result = String(result).toLowerCase() === 'true' ? 1 : 0;
      break;
    case WIDGETS_TO_API_TYPE_ENUM.NUMBER:
    case WIDGETS_TO_API_TYPE_ENUM.MONEY:
      try {
        if (!(result === '' || result === undefined || result === null || isNaN(result))) {
          if (typeof result === 'string' && /[^0-9.-]/.test(result || '')) {
            result = (result || '').match(/^-?[\d.]+/)?.[0];
          }

          const numericValue = typeof result === 'string' ? Number(result || 0) : result || 0;
          if (typeof numericValue !== 'number') return result;
          result = numericValue
            .toFixed(12)
            .toString()
            .match(/^-?[\d.]+/)?.[0];
          result = (typeof result === 'string' ? result : '').replace(/\.([0-9]*[1-9])0+$|\.0+$/, (_match, group) => {
            return group ? `.${group}` : '';
          });
        }
      } catch (err) {
        void err;
      }

      break;
    case WIDGETS_TO_API_TYPE_ENUM.DATE:
      result =
        result && dayjs(dateResult(result)).isValid() ? dayjs(dateResult(result)).format('YYYY-MM-DD') : undefined;
      break;
    case WIDGETS_TO_API_TYPE_ENUM.DATE_TIME:
      result =
        result && dayjs(dateResult(result)).isValid()
          ? dayjs(dateResult(result)).format('YYYY-MM-DD HH:mm:ss')
          : undefined;
      break;
    case WIDGETS_TO_API_TYPE_ENUM.FLAT_MENU:
    case WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT:
    case WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN:
      const filterOptions = (control.options || []).filter(i => !i.isDeleted);
      const tempValue = (_.isString(result) ? result.split(',') : Array.isArray(result) ? result : [result])
        .map(item => {
          return _.get(
            _.find(filterOptions, option => option.value === item),
            'key',
          );
        })
        .filter(_.identity);

      result = _.isEmpty(tempValue) ? '' : JSON.stringify(tempValue);
      break;
    case WIDGETS_TO_API_TYPE_ENUM.TIME:
      const formatMode = _.includes(['6', '9'], control.unit) ? 'HH:mm:ss' : 'HH:mm';
      result = result
        ? dayjs(dateResult(result)).year() && dayjs(dateResult(result)).isValid()
          ? dayjs(dateResult(result)).format(formatMode)
          : dayjs(dateResult(result), dayjs(dateResult(result)).second() ? 'HH:mm:ss' : 'HH:mm').format(formatMode)
        : undefined;
      if (result && result.toString().toLowerCase().includes('invalid date')) {
        result = undefined;
      }

      break;
    case WIDGETS_TO_API_TYPE_ENUM.LOCATION:
      const resultArr = _.isString(result) ? result.split(',') : Array.isArray(result) ? result : [result];
      const [x, y, title, address] = resultArr;
      result = x && y && !_.isNaN(Number(x)) && !_.isNaN(Number(y)) ? JSON.stringify({ x, y, title, address }) : '';
      break;
  }

  return result;
}

export default function (
  control: FormControl,
  formData: FormControl[],
  { update, type, forceSyncRun = false, defaultExpression, langCode }: FunctionRunOptions = {},
): FunctionRunResult | undefined {
  initLang(langCode);
  const run = functions;
  let expressionData: Record<string, unknown> = {};

  try {
    const value: unknown = JSON.parse(control.advancedSetting?.['defaultfunc'] || '{}');
    expressionData = messageRecord(value) || {};
  } catch (err) {
    console.log(err);
  }

  let expression =
    defaultExpression || (typeof expressionData['expression'] === 'string' ? expressionData['expression'] : undefined);
  let fnType: unknown = expressionData['type'];

  if (!expression) {
    return {
      error: 'EXPRESSION_IS_UNDEFINED',
      expression,
    };
  }

  let existDeletedControl, existUndefinedFunction;

  if (fnType !== 'javascript') {
    expression = expression.replace(/([A-Z_]+)(?=\()/g, (name: string) => {
      if (Object.entries(run).some(([key, fn]) => key === name && !!fn)) {
        return 'run.' + name;
      } else {
        // 不执行未定义函数
        existUndefinedFunction = true;
        return 'E_R_R_O_R';
      }
    });
  }

  if (existUndefinedFunction) {
    return {
      error: 'EXIST_UNDEFINED_FUNCTION',
      expression,
    };
  }

  expression = replaceControlIdToValue(expression, formData, _.get(control, 'advancedSetting.nullzero'));
  if (!expression || existDeletedControl) {
    return {
      error: 'EXIST_UNDEFINED_CONTROL_OR_VALUE',
      expression,
    };
  }

  return (function () {
    try {
      let result: unknown;

      if (window.isIphone && fnType === 'javascript' && !forceSyncRun) {
        // iOS15以下不支持web worker，改为直接运行
        result = eval('function run() { ' + expression + ' } run()');
        update?.(
          _.isUndefined(result) || _.isNaN(result) || _.isNull(result)
            ? ''
            : String(formatFunctionResult(control, result)),
        );
        return undefined;
      }

      if (type === 'lib' || forceSyncRun) {
        result = eval(fnType === 'javascript' ? 'function run() { ' + expression + ' } run()' : expression);
      } else {
        if (fnType === 'javascript') {
          // 打包函数库时花括号内这段代码注释掉
          result = asyncRun(
            expression,
            (err, value) => {
              if (!err) {
                update?.(
                  _.isUndefined(value) || _.isNaN(value) || _.isNull(value)
                    ? ''
                    : String(formatFunctionResult(control, value)),
                );
              } else {
                console.log(err);
              }
            },
            { timeout: 1000 },
          );
        } else {
          result = eval(expression);
        }
      }

      result = formatFunctionResult(control, result);
      if (_.isNaN(result)) {
        result = undefined;
      }

      if (type === 'lib' && typeof result === 'undefined') {
        result = '';
      }

      return {
        value: result,
        expression,
      };
    } catch (err) {
      return {
        error: err,
        expression,
      };
    }
  })();
}
