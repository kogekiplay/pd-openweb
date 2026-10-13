import { Base64 } from 'js-base64';
import type { FunctionEvaluationControl } from 'src/utils/functionLibraryTypes';
import exec from './exec';
import { readFunctionLibraryParameters } from './releaseParameterBoundary';

function runWithParams(control: FunctionEvaluationControl, formData: FunctionEvaluationControl[], langCode: unknown) {
  if (!control.advancedSetting && control.expression) {
    try {
      control.advancedSetting = {
        defaultfunc: JSON.stringify({ expression: control.expression }),
      };
    } catch (err) {
      console.log(err);
    }
  }

  const result = exec(control, formData, { type: 'lib', langCode });

  if (!result) {
    console.error('Function did not return a synchronous result');
    return '';
  }
  if (!result.error) {
    return result.value;
  } else {
    if (typeof console !== 'undefined') {
      console.log(result.error);
    }

    return '';
  }
}

function mobileRun(base64Str: string) {
  const value: unknown = JSON.parse(Base64.decode(base64Str));
  const params = readFunctionLibraryParameters(value);
  return runWithParams(params.control, params.formData, params.langCode);
}

function strRun(str: string) {
  const value: unknown = JSON.parse(str);
  const params = readFunctionLibraryParameters(value);
  return runWithParams(params.control, params.formData, params.langCode);
}

function objRun(obj: unknown) {
  const params = readFunctionLibraryParameters(obj);
  return runWithParams(params.control, params.formData, params.langCode);
}

export function run(value: unknown, type = 'mobile'): unknown {
  try {
    if (type === 'mobile' || type === 'str') {
      if (typeof value !== 'string') throw new TypeError('Function wire input must be text');
      return type === 'mobile' ? mobileRun(value) : strRun(value);
    }
    if (type === 'obj') return objRun(value);
    return undefined;
  } catch (error) {
    console.log(error);
    return '';
  }
}
