import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import type { MomentInput } from 'moment';
import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';
import type {
  ChecklistItem,
  PrintAttachment,
  PrintControl,
  PrintOption,
  PrintRelateRecord,
  PrintRow,
  PrintTaskData,
  PrintTaskItem,
  PrintWorkflowItem,
  PrintWorksheetRow,
  SubTaskItem,
} from './PrintTypes';

export function printObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
function optionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number';
}
function optionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}
function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && Array.from(value).every(item => typeof item === 'string');
}
function isOption(value: unknown): value is PrintOption {
  return (
    printObject(value) &&
    typeof value['key'] === 'string' &&
    optionalString(value['value']) &&
    optionalBoolean(value['isDeleted'])
  );
}
function isAdvancedSetting(value: unknown): value is ControlAdvancedSetting {
  return printObject(value) && Object.values(value).every(optionalString);
}
export function isPrintControl(value: unknown, seen = new WeakSet<object>()): value is PrintControl {
  if (!printObject(value)) return false;
  if (seen.has(value)) return true;
  // Reject invalid declared scalar fields before treating a recursive reference as visited.
  const strings = ['controlId', 'controlName', 'sourceControlId', 'sourceTitleControlId', 'unit', 'formId'];
  const numbers = [
    'type',
    'sourceControlType',
    'innerRow',
    'row',
    'col',
    'attribute',
    'dot',
    'enumDefault',
    'enumDefault2',
    'printDetailType',
  ];
  const booleans = ['printHide', 'isRelateMultipleSheet', 'needEvaluate', 'showMaskValue'];
  if (
    !strings.every(key => optionalString(value[key])) ||
    !numbers.every(key => optionalNumber(value[key])) ||
    !booleans.every(key => optionalBoolean(value[key]))
  )
    return false;
  const dataSource = value['dataSource'];
  if (dataSource !== undefined && typeof dataSource !== 'string' && typeof dataSource !== 'number') return false;
  const options = value['options'];
  if (options !== undefined && (!Array.isArray(options) || !Array.from(options).every(isOption))) return false;
  const showControls = value['showControls'];
  if (showControls !== undefined && !stringArray(showControls)) return false;
  const advancedSetting = value['advancedSetting'];
  if (advancedSetting !== undefined && !isAdvancedSetting(advancedSetting)) return false;
  seen.add(value);
  const sourceControl = value['sourceControl'];
  if (sourceControl !== undefined && !isPrintControl(sourceControl, seen)) return false;
  const relationControls = value['relationControls'];
  if (
    relationControls !== undefined &&
    (!Array.isArray(relationControls) || !Array.from(relationControls).every(item => isPrintControl(item, seen)))
  )
    return false;
  return true;
}
export function printControls(value: unknown): PrintControl[] {
  if (!Array.isArray(value) || !Array.from(value).every(item => isPrintControl(item)))
    throw new TypeError('Invalid print controls');
  return value;
}
export function printRows(value: unknown): PrintRow[] {
  if (!Array.isArray(value) || !Array.from(value).every(printObject)) throw new TypeError('Invalid print rows');
  return value;
}
export function decodePrintRow(value: unknown): PrintWorksheetRow {
  if (!isWorksheetRow(value)) {
    throw new TypeError('Invalid worksheet print row');
  }
  return value;
}
function isWorksheetRow(value: unknown): value is PrintWorksheetRow {
  return (
    printObject(value) &&
    Array.isArray(value['receiveControls']) &&
    Array.from(value['receiveControls']).every(item => isPrintControl(item)) &&
    optionalString(value['shortUrl']) &&
    optionalString(value['titleName']) &&
    optionalString(value['updateTime'])
  );
}
export function decodePrintSheet(value: unknown): { name?: string | undefined } {
  if (!printObject(value) || !optionalString(value['name'])) throw new TypeError('Invalid print worksheet');
  return { name: value['name'] };
}
export function decodePrintLogo(value: unknown): { logo?: string | undefined } {
  if (!printObject(value) || !optionalString(value['logo'])) throw new TypeError('Invalid print logo');
  return { logo: value['logo'] };
}
export function decodePrintTask(value: unknown): PrintTaskData {
  if (!printObject(value) || value['status'] === false || !printObject(value['data']))
    throw new TypeError('Invalid task print response');
  const data = value['data'];
  const controls = printControls(data['controls']);
  const member = data['member'];
  const tag = data['tag'];
  if (!Array.isArray(member) || !Array.isArray(tag)) throw new TypeError('Invalid task print members/tags');
  if (data['checklist'] !== undefined) checklist(data['checklist']);
  if (data['subTask'] !== undefined) subTasks(data['subTask']);
  return { ...data, controls, member, tag };
}
export function decodeRelateRecord(value: unknown): PrintRelateRecord {
  if (!printObject(value) || !printObject(value['template'])) throw new TypeError('Invalid relation print response');
  return { template: { controls: printControls(value['template']['controls']) }, data: printRows(value['data']) };
}
export function printShareUrl(value: unknown): string | undefined {
  if (!optionalString(value)) throw new TypeError('Invalid print share URL');
  return value;
}
export function parsePrintJson(value: unknown): unknown {
  if (typeof value === 'symbol') throw new TypeError('Cannot convert a Symbol value to a string');
  return JSON.parse(typeof value === 'string' ? value : String(value));
}
export function printString(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid print string value');
  return value;
}
function isPrintNode(value: unknown, seen = new WeakSet<object>()): value is ReactNode {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    isValidElement(value)
  )
    return true;
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    const valid = Array.from(value).every(item => isPrintNode(item, seen));
    seen.delete(value);
    return valid;
  }
  return false;
}
export function printNode(value: unknown): ReactNode {
  if (!isPrintNode(value)) throw new TypeError('Invalid print display value');
  return value;
}
export function printDate(value: unknown): MomentInput {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date
  )
    return value;
  if (Array.isArray(value) && Array.from(value).every(item => typeof item === 'number')) return value;
  throw new TypeError('Invalid print date');
}
export function readDateValues(value: unknown): Array<string | number | null> {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(item => item === null || typeof item === 'string' || typeof item === 'number')
  )
    throw new TypeError('Invalid print date range');
  return value;
}
export interface PrintRelationValue {
  type?: number | undefined;
  name?: string | undefined;
}
export function relationValues(value: unknown): PrintRelationValue[] {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(
      (item): item is PrintRelationValue =>
        printObject(item) && optionalNumber(item['type']) && optionalString(item['name']),
    )
  )
    throw new TypeError('Invalid print relationships');
  return value;
}
export function displayName(value: unknown, field: string): string | undefined {
  if (!printObject(value) || !optionalString(value[field])) throw new TypeError('Invalid print display name');
  return value[field];
}
export function locationValue(value: unknown): { title?: string | undefined; address?: string | undefined } {
  if (!printObject(value) || !optionalString(value['title']) || !optionalString(value['address']))
    throw new TypeError('Invalid print location');
  return { title: value['title'], address: value['address'] };
}
function isSubTask(value: unknown): value is SubTaskItem {
  return printObject(value) && optionalString(value['name']);
}
function isChecklist(value: unknown): value is ChecklistItem {
  return (
    printObject(value) &&
    optionalString(value['checkListName']) &&
    Array.isArray(value['checkListData']) &&
    Array.from(value['checkListData']).every(isSubTask)
  );
}
export function checklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value) || !Array.from(value).every(isChecklist)) throw new TypeError('Invalid print checklist');
  return value;
}
export function subTasks(value: unknown): SubTaskItem[] {
  if (!Array.isArray(value) || !Array.from(value).every(isSubTask)) throw new TypeError('Invalid print subtasks');
  return value;
}
export function printAttachments(value: unknown): PrintAttachment[] {
  const parsed = parsePrintJson(value);
  if (
    !Array.isArray(parsed) ||
    !Array.from(parsed).every(
      (item): item is PrintAttachment =>
        printObject(item) &&
        typeof item['originalFilename'] === 'string' &&
        optionalString(item['ext']) &&
        optionalString(item['previewUrl']),
    )
  )
    throw new TypeError('Invalid print attachments');
  return parsed;
}
export function taskItems(value: unknown): PrintTaskItem[] {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(
      (item): item is PrintTaskItem =>
        printObject(item) &&
        typeof item['key'] === 'string' &&
        typeof item['name'] === 'string' &&
        typeof item['show'] === 'boolean' &&
        typeof item['independent'] === 'boolean',
    )
  )
    throw new TypeError('Invalid print task options');
  return value;
}
export function printOptions(value: unknown): { showWorkflowQrCode?: boolean | undefined } | undefined {
  if (value === undefined) return undefined;
  if (!isPrintOptions(value)) throw new TypeError('Invalid print options');
  return value;
}
function isPrintOptions(value: unknown): value is { showWorkflowQrCode?: boolean | undefined } {
  return printObject(value) && optionalBoolean(value['showWorkflowQrCode']);
}
export function workflowItems(value: unknown): PrintWorkflowItem[] {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(
      (item): item is PrintWorkflowItem =>
        printObject(item) &&
        typeof item['show'] === 'boolean' &&
        printObject(item['flowNode']) &&
        typeof item['flowNode']['id'] === 'string' &&
        optionalString(item['flowNode']['name']),
    )
  )
    throw new TypeError('Invalid print workflow options');
  return value;
}
/** This finite adapter retains all fields read by renderText; it does not validate other FormControl fields. */
export function cellTitleControl(control: PrintControl, seen = new WeakMap<PrintControl, FormControl>()): FormControl {
  const prior = seen.get(control);
  if (prior) return prior;
  const result: FormControl = {
    controlId: control.controlId,
    type: control.type,
    value: control.value,
    unit: control.unit,
    advancedSetting: control.advancedSetting,
    options: control.options,
    enumDefault: control.enumDefault,
    enumDefault2: control.enumDefault2,
    sourceControlType: control.sourceControlType,
    sourceControlId: control.sourceControlId,
    sourceTitleControlId: control.sourceTitleControlId,
    attribute: control.attribute,
    dot: control.dot,
    showMaskValue: control.showMaskValue,
  };
  seen.set(control, result);
  if (control.sourceControl) result.sourceControl = cellTitleControl(control.sourceControl, seen);
  if (control.relationControls)
    result.relationControls = control.relationControls.map(item => cellTitleControl(item, seen));
  return result;
}
