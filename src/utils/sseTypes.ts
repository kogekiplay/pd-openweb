import type { AiGenEntityRef, AiRecommendControl, AiRecommendOption } from './controlTypes';

export interface StreamObject {
  [key: string]: unknown;
}
export interface StreamRow extends StreamObject {
  rowid?: string | undefined;
}
export interface GeneratedControlValue {
  controlId?: string | undefined;
  value?: unknown;
  isSmartFill?: boolean | undefined;
  Reason?: string | undefined;
}
export interface GeneratedWidget extends AiRecommendControl {
  rowPosition?: string;
  isExist?: boolean;
}
export interface AppOptimizationValue {
  id?: string | undefined;
  name?: string | undefined;
  icon?: string | undefined;
  reason?: string | undefined;
}
function isObject(value: unknown): value is StreamObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const stringField = (value: unknown) => value === undefined || typeof value === 'string';
const numberField = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value));
const booleanField = (value: unknown) => value === undefined || typeof value === 'boolean';
function isRow(value: unknown): value is StreamRow {
  return isObject(value) && stringField(value['rowid']);
}
export function streamRow(value: unknown): StreamRow | undefined {
  return isRow(value) ? value : undefined;
}
function isControlValue(value: unknown): value is GeneratedControlValue {
  return (
    isObject(value) &&
    stringField(value['controlId']) &&
    booleanField(value['isSmartFill']) &&
    stringField(value['Reason'])
  );
}
export function generatedControlValue(value: unknown): GeneratedControlValue | undefined {
  return isControlValue(value) ? value : undefined;
}
function isOptimization(value: unknown): value is AppOptimizationValue {
  return isObject(value) && ['id', 'name', 'icon', 'reason'].every(key => stringField(value[key]));
}
export function appOptimizationValue(value: unknown): AppOptimizationValue | undefined {
  return isOptimization(value) ? value : undefined;
}
function isOption(value: unknown): value is AiRecommendOption {
  return (
    isObject(value) && stringField(value['label']) && stringField(value['color']) && booleanField(value['isDefault'])
  );
}
function isWidget(value: unknown): value is GeneratedWidget {
  if (!isObject(value)) return false;
  if (
    !['id', 'type', 'name', 'description', 'code', 'formulaExpression', 'rowPosition'].every(key =>
      stringField(value[key]),
    )
  )
    return false;
  const position = value['rowPosition'];
  if (
    typeof position === 'string' &&
    position &&
    (!/^\d+(?:\.\d+)?$/.test(position) || !position.split('.').every(part => Number.isFinite(parseInt(part, 10))))
  )
    return false;
  if (!['isRequired', 'isHeading', 'optionColor', 'isMultiple', 'isExist'].every(key => booleanField(value[key])))
    return false;
  if (!['row', 'col', 'size'].every(key => numberField(value[key]))) return false;
  const options = value['options'],
    fields = value['displayField'],
    related = value['relatedWorksheet'],
    children = value['subFields'];
  return (
    (options === undefined || (Array.isArray(options) && options.every(isOption))) &&
    (fields === undefined ||
      (Array.isArray(fields) && fields.every((field: unknown) => isObject(field) && stringField(field['fieldID'])))) &&
    (related === undefined || related === 'self' || (isObject(related) && stringField(related['id']))) &&
    (children === undefined || (Array.isArray(children) && children.every(isWidget)))
  );
}
export function generatedWidget(value: unknown): GeneratedWidget | undefined {
  return isWidget(value) ? value : undefined;
}

/** Widget-specific formatting validates only the fields it reads and keeps all other metadata opaque. */
export function generatedEntityRecords(value: unknown): AiGenEntityRef[] {
  if (!Array.isArray(value)) throw new TypeError('Generated entities must be an array');
  return value.map(item => {
    if (!isObject(item) || !['id', 'sid', 'name', 'avatar'].every(key => stringField(item[key])))
      throw new TypeError('Invalid generated entity');
    return item;
  });
}
export function generatedAttachmentRecords(value: unknown): Array<{ ext?: string; name?: string; url?: string }> {
  if (!Array.isArray(value)) throw new TypeError('Generated attachments must be an array');
  return value.map(item => {
    if (!isObject(item) || !['ext', 'name', 'url'].every(key => stringField(item[key])))
      throw new TypeError('Invalid generated attachment');
    return item;
  });
}
export function generatedRowRecords(value: unknown): StreamObject[] {
  if (!Array.isArray(value) || !value.every(isObject)) throw new TypeError('Generated rows must be objects');
  return value;
}
