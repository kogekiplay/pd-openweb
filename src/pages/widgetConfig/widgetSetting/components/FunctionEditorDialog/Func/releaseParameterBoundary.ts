import type { ControlAdvancedSetting } from 'src/utils/controlTypes';
import type { FunctionEvaluationControl, FunctionOption } from 'src/utils/functionLibraryTypes';

export interface FunctionLibraryParameters {
  control: FunctionEvaluationControl;
  formData: FunctionEvaluationControl[];
  langCode?: unknown;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const optionalNumber = (value: unknown): boolean => value === undefined || typeof value === 'number';
const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';
function advanced(value: unknown): value is ControlAdvancedSetting {
  return object(value) && Object.values(value).every(optionalString);
}
function option(value: unknown): value is FunctionOption {
  return (
    object(value) &&
    optionalString(value['key']) &&
    optionalString(value['value']) &&
    (value['isDeleted'] === undefined || typeof value['isDeleted'] === 'boolean')
  );
}
function control(value: unknown): value is FunctionEvaluationControl {
  return (
    object(value) &&
    ['type', 'enumDefault', 'enumDefault2', 'sourceControlType'].every(key => optionalNumber(value[key])) &&
    ['unit', 'controlId'].every(key => optionalString(value[key])) &&
    (value['advancedSetting'] === undefined || advanced(value['advancedSetting'])) &&
    (value['options'] === undefined || (Array.isArray(value['options']) && value['options'].every(option))) &&
    (value['sourceControl'] === undefined ||
      (object(value['sourceControl']) &&
        (value['sourceControl']['advancedSetting'] === undefined ||
          advanced(value['sourceControl']['advancedSetting']))))
  );
}
function numberValue(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number') throw new TypeError('Invalid function control number');
  return value;
}
function stringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') throw new TypeError('Invalid function control text');
  return value;
}
function settings(value: unknown): ControlAdvancedSetting | undefined {
  if (value == null) return undefined;
  if (advanced(value)) return value;
  if (!object(value)) throw new TypeError('Invalid function advanced setting');
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stringValue(entry)]));
}
function options(value: unknown): FunctionOption[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new TypeError('Invalid function control options');
  return value.map((entry: unknown) => {
    if (option(entry)) return entry;
    if (!object(entry)) throw new TypeError('Invalid function option');
    const deletedValue = entry['isDeleted'];
    if (deletedValue != null && typeof deletedValue !== 'boolean') throw new TypeError('Invalid function option status');
    const deleted = typeof deletedValue === 'boolean' ? deletedValue : undefined;
    return {
      ...entry,
      key: stringValue(entry['key']),
      value: stringValue(entry['value']),
      ...(deleted === undefined ? {} : { isDeleted: deleted }),
    };
  });
}
function readControl(value: unknown): FunctionEvaluationControl {
  if (control(value)) return value;
  if (!object(value)) throw new TypeError('Invalid function control');
  const source = value['sourceControl'];
  if (source != null && !object(source)) throw new TypeError('Invalid function source control');
  return {
    ...value,
    type: numberValue(value['type']),
    enumDefault: numberValue(value['enumDefault']),
    enumDefault2: numberValue(value['enumDefault2']),
    sourceControlType: numberValue(value['sourceControlType']),
    unit: stringValue(value['unit']),
    controlId: stringValue(value['controlId']),
    advancedSetting: settings(value['advancedSetting']),
    options: options(value['options']),
    sourceControl: object(source) ? { ...source, advancedSetting: settings(source['advancedSetting']) } : undefined,
  };
}
export function readFunctionLibraryParameters(value: unknown): FunctionLibraryParameters {
  if (!object(value)) throw new TypeError('Invalid function request');
  const fields = value['formData'];
  if (fields != null && !Array.isArray(fields)) throw new TypeError('Invalid function form data');
  return {
    control: readControl(value['control']),
    formData: Array.isArray(fields) ? fields.map(readControl) : [],
    langCode: value['langCode'],
  };
}
