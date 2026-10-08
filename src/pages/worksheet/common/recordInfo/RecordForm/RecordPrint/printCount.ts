import worksheetAjax from 'src/api/worksheet';
import { VersionProductType } from 'src/utils/domain/shared/productFeatures';
import { getFeatureStatus } from 'src/utils/project';

export interface PrintContext {
  projectId: string;
  worksheetId: string;
}
export interface PrintPrecheckArgs extends PrintContext {
  printId: string;
  rowIds: string[];
}
export interface PrintPrecheckRow {
  rowId: string;
  rowTitle: string;
}
export interface PrintPrecheckResult {
  successRows: PrintPrecheckRow[];
  failedRows: PrintPrecheckRow[];
}
export interface TemplatePrintCount {
  printId: string;
  printCount: number;
  printLimitCount: number;
  printLimitEnabled: boolean;
  leftPrintCount: number;
}
export interface RowPrintCount {
  totalPrintCount: number;
  templates: TemplatePrintCount[];
}
export interface BatchPrintError {
  templateName: string;
  recordNames: string[];
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function count(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
function precheckRows(value: unknown): PrintPrecheckRow[] {
  if (!Array.isArray(value)) throw new Error('Invalid print precheck response');
  return (value as unknown[]).map(item => {
    const row = record(item);
    if (!row || typeof row['rowId'] !== 'string') throw new Error('Invalid print precheck row');
    return { rowId: row['rowId'], rowTitle: typeof row['rowTitle'] === 'string' ? row['rowTitle'] : '' };
  });
}
export function parsePrintPrecheck(value: unknown): PrintPrecheckResult {
  const response = record(value);
  if (!response) throw new Error('Invalid print precheck response');
  return { successRows: precheckRows(response['successRows']), failedRows: precheckRows(response['failedRows']) };
}
export function printCountFeatureAvailable(projectId: string): boolean {
  return getFeatureStatus(projectId, VersionProductType.printCountLimit) !== '2';
}
export async function precheckPrint(args: PrintPrecheckArgs): Promise<PrintPrecheckResult> {
  if (!printCountFeatureAvailable(args.projectId)) {
    return { successRows: args.rowIds.map(rowId => ({ rowId, rowTitle: '' })), failedRows: [] };
  }
  const response: unknown = await worksheetAjax.precheckPrint(args);
  return parsePrintPrecheck(response);
}
export async function precheckTemplatePrint(args: PrintPrecheckArgs): Promise<boolean> {
  try {
    const result = await precheckPrint(args);
    if (result.failedRows.length) {
      alert(_l('当前模板已达到打印上限'), 2);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
export function parseRowPrintCount(value: unknown): RowPrintCount {
  const first: unknown = Array.isArray(value) ? value[0] : undefined;
  const response = record(first);
  const templates: TemplatePrintCount[] = [];
  const items = response?.['templates'];
  if (Array.isArray(items)) {
    for (const item of items as unknown[]) {
      const template = record(item);
      if (!template || typeof template['printId'] !== 'string') continue;
      templates.push({
        printId: template['printId'],
        printCount: count(template['printCount']),
        printLimitCount: count(template['printLimitCount']),
        printLimitEnabled: template['printLimitEnabled'] === true,
        leftPrintCount: count(template['leftPrintCount']),
      });
    }
  }
  return { totalPrintCount: count(response?.['totalPrintCount']), templates };
}
export async function getRowPrintCount(args: PrintContext & { rowIds: string[] }): Promise<RowPrintCount> {
  const response: unknown = await worksheetAjax.getRowPrintCount(args);
  return parseRowPrintCount(response);
}
