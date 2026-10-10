import type {
  FilterCondition,
  FilterDynamicSource,
  FilterEvaluationInput,
  FilterScalar,
  FilterWireItem,
  SavedFilter,
} from './filterModelTypes';

export function filterRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function filterScalar(value: unknown): value is FilterScalar {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}
const number = (value: unknown): value is number | undefined => value === undefined || typeof value === 'number';
const string = (value: unknown): value is string | undefined => value === undefined || typeof value === 'string';
const boolean = (value: unknown): value is boolean | undefined => value === undefined || typeof value === 'boolean';
function dense(value: unknown): value is unknown[] {
  return Array.isArray(value) && Array.from({ length: value.length }, (_, index) => index in value).every(Boolean);
}
function dynamicSource(value: unknown): value is FilterDynamicSource {
  return (
    filterRecord(value) &&
    string(value['cid']) &&
    string(value['rcid']) &&
    (string(value['staticValue']) || number(value['staticValue']))
  );
}
function values(value: Record<string, unknown>, dynamic: (value: unknown) => boolean = boolean): boolean {
  return (
    ['value', 'minValue', 'maxValue'].every(key => filterScalar(value[key])) &&
    ['values', 'fullValues'].every(key => value[key] === undefined || dense(value[key])) &&
    ['dateRange', 'emptyRule'].every(key => number(value[key])) &&
    (number(value['dateRangeType']) || string(value['dateRangeType'])) &&
    dynamic(value['isDynamicsource']) &&
    boolean(value['folded']) &&
    (value['dynamicSource'] === undefined ||
      (dense(value['dynamicSource']) && value['dynamicSource'].every(dynamicSource)))
  );
}
function wire(value: unknown, ancestors: Set<object>): value is FilterWireItem {
  if (
    !filterRecord(value) ||
    ancestors.has(value) ||
    !values(value) ||
    !string(value['controlId']) ||
    !['dataType', 'filterType', 'spliceType'].every(key => number(value[key])) ||
    !boolean(value['isGroup'])
  )
    return false;
  if (value['isGroup'] !== true) return true;
  ancestors.add(value);
  const groups = value['groupFilters'];
  const valid = groups === undefined || (dense(groups) && groups.every(item => wire(item, ancestors)));
  ancestors.delete(value);
  return valid;
}
export function filterWireItems(value: unknown): FilterWireItem[] {
  if (!dense(value) || !value.every(item => wire(item, new Set())))
    throw new TypeError('Invalid worksheet filter items');
  return value;
}
export function savedFilter(value: unknown): SavedFilter {
  if (
    !filterRecord(value) ||
    !['filterId', 'name', 'createAccountId'].every(key => string(value[key])) ||
    !number(value['type']) ||
    !(
      value['items'] === undefined ||
      value['items'] === null ||
      (dense(value['items']) && value['items'].every(item => wire(item, new Set())))
    )
  )
    throw new TypeError('Invalid saved worksheet filter');
  return value;
}
/** The legacy UI callback is not trusted to provide a whole control DTO. */
export function filterConditionPatch(value: unknown): Partial<FilterCondition> {
  if (
    !filterRecord(value) ||
    !values(value) ||
    !['controlId', 'keyStr', 'lastAction'].every(key => string(value[key])) ||
    !['controlType', 'dataType', 'type', 'filterType', 'spliceType', 'conditionGroupType'].every(key =>
      number(value[key]),
    ) ||
    value['control'] !== undefined
  )
    throw new TypeError('Invalid worksheet filter condition update');
  return value;
}
export function filterConditionEvaluation(value: unknown): FilterEvaluationInput {
  if (
    !filterRecord(value) ||
    !['value', 'minValue', 'maxValue'].every(key => filterScalar(value[key])) ||
    !(value['values'] === undefined || dense(value['values'])) ||
    !number(value['dateRange']) ||
    !(boolean(value['isDynamicsource']) || number(value['isDynamicsource'])) ||
    !(
      value['dynamicSource'] === undefined ||
      (dense(value['dynamicSource']) &&
        value['dynamicSource'].every(source => filterRecord(source) && string(source['cid']) && string(source['rcid'])))
    ) ||
    !['type', 'controlType', 'dataType', 'conditionGroupType'].every(key => number(value[key]))
  )
    throw new TypeError('Invalid filter condition evaluation fields');
  return value;
}
export function parsedFilterProperty(value: unknown, key: string): unknown {
  if (value === null || value === undefined) throw new TypeError('Missing parsed worksheet filter value');
  const receiver: unknown = Object(value);
  if ((typeof receiver !== 'object' || receiver === null) && typeof receiver !== 'function')
    throw new TypeError('Invalid worksheet filter property receiver');
  const result: unknown = Reflect.get(receiver, key);
  return result;
}
export function filterJSON(value: unknown): unknown {
  const result: unknown = Reflect.apply(JSON.parse, JSON, [value]);
  return result;
}
