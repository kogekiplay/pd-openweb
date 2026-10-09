import type { FilterSelectedEntity, QuickFilterCondition, QuickFilterDynamicSource } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number';
}
function optionalScalar(value: unknown): value is string | number | undefined {
  return value === undefined || typeof value === 'string' || typeof value === 'number';
}
function isDynamicSource(value: unknown): value is QuickFilterDynamicSource {
  if (!isObject(value)) return false;
  return (
    optionalString(value['rcid']) &&
    optionalString(value['cid']) &&
    optionalString(value['staticValue']) &&
    optionalNumber(value['type']) &&
    (value['isAsync'] === undefined || typeof value['isAsync'] === 'boolean')
  );
}
export function isQuickFilterCondition(value: unknown): value is QuickFilterCondition {
  if (!isObject(value)) return false;
  return (
    optionalString(value['controlId']) &&
    ['dataType', 'spliceType', 'filterType', 'dateRange', 'dateRangeType', 'originalFilterType', 'dateType'].every(
      key => optionalNumber(value[key]),
    ) &&
    ['value', 'minValue', 'maxValue'].every(key => optionalScalar(value[key])) &&
    (value['values'] === undefined ||
      (Array.isArray(value['values']) && value['values'].every(item => typeof item === 'string'))) &&
    (value['dynamicSource'] === undefined ||
      (Array.isArray(value['dynamicSource']) && value['dynamicSource'].every(isDynamicSource))) &&
    (value['isGroup'] === undefined || typeof value['isGroup'] === 'boolean') &&
    (value['groupFilters'] === undefined ||
      (Array.isArray(value['groupFilters']) && value['groupFilters'].every(isQuickFilterCondition))) &&
    (value['navNames'] === undefined ||
      (Array.isArray(value['navNames']) && value['navNames'].every(item => typeof item === 'string'))) &&
    (value['advancedSetting'] === undefined ||
      (isObject(value['advancedSetting']) && Object.values(value['advancedSetting']).every(optionalString)))
  );
}
/** safeParse is a runtime global returning unknown; only these three string fields feed selected-entity display values. */
export function readSelectedEntity(value: unknown): FilterSelectedEntity {
  if (!isObject(value)) return {};
  return {
    ...(typeof value['id'] === 'string' ? { id: value['id'] } : {}),
    ...(typeof value['name'] === 'string' ? { name: value['name'] } : {}),
    ...(typeof value['avatar'] === 'string' ? { avatar: value['avatar'] } : {}),
  };
}
