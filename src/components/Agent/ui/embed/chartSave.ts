import homeAppAjax from 'src/api/homeApp';
import worksheetAjax from 'src/api/worksheet';
import reportConfigAjax from 'src/pages/Statistics/api/reportConfig';
import { canEditApp } from 'src/utils/domain/permission/app';

export interface ChartSaveSpec {
  type?: string | undefined;
  title?: string | undefined;
  percent?: unknown;
  stack?: unknown;
  _source?: unknown;
}
export interface CreateChartPayload extends Record<string, unknown> {
  worksheetId: string;
  chartType: string;
  chartName: string;
  dataScope: string;
}
export type SaveChartResult = { ok: true; data: unknown } | { ok: false; message: string };
const CHART_TYPES: Readonly<Record<string, string>> = {
  pie: 'pieChart',
  column: 'columnChart',
  bar: 'barChart',
  line: 'lineChart',
  area: 'lineChart',
  funnel: 'funnelChart',
  radar: 'radarChart',
  wordcloud: 'wordCloud',
  scatter: 'scatterChart',
  bullet: 'progressChart',
  dualAxes: 'dualAxisChart',
  statistic: 'numberChart',
  gauge: 'gaugeChart',
};
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function source(spec: ChartSaveSpec): Record<string, unknown> | undefined {
  return record(spec._source);
}
export function getChartWorksheetId(spec: ChartSaveSpec): string {
  const value = source(spec);
  return text(value?.['worksheetId']) || text(value?.['worksheet_id']);
}
export function getChartAppId(spec: ChartSaveSpec): string {
  return text(source(spec)?.['appId']);
}
export function canSaveChart(spec: ChartSaveSpec): boolean {
  const value = source(spec);
  return Boolean(value && getChartWorksheetId(spec) && (text(value['chartType']) || CHART_TYPES[spec.type || '']));
}
export function buildCreateChartPayload(
  spec: ChartSaveSpec,
  { customPageId }: { customPageId?: string | undefined } = {},
): CreateChartPayload | null {
  const value = source(spec);
  const worksheetId = getChartWorksheetId(spec);
  const chartType = text(value?.['chartType']) || CHART_TYPES[spec.type || ''];
  if (!value || !worksheetId || !chartType) return null;
  const rest = { ...value };
  delete rest['worksheet_id'];
  const percent = value['percent'] ?? spec.percent;
  const stack = value['stack'] ?? spec.stack;
  const style = text(value['style']) || (spec.type === 'line' ? 'smooth' : spec.type === 'area' ? 'area' : '');
  return {
    ...rest,
    worksheetId,
    chartType,
    chartName: text(value['chartName']) || spec.title?.trim() || _l('未命名图表'),
    dataScope: text(value['dataScope']) || 'permission',
    ...(percent ? { percent: true, stack: false } : stack ? { stack: true } : {}),
    ...(style ? { style } : {}),
    ...(customPageId ? { addToCustomPageId: customPageId } : {}),
  };
}
export async function saveChart(payload: CreateChartPayload): Promise<SaveChartResult> {
  try {
    const response: unknown = await reportConfigAjax.createChart(payload, { customParseResponse: true, silent: true });
    const result = record(response);
    if (result?.['status'] === 1) return { ok: true, data: result['data'] ?? {} };
    const msg = text(result?.['msg']);
    const details = result?.['data'];
    const detail = Array.isArray(details) && details.length ? String(details[0]) : '';
    return { ok: false, message: msg && detail ? `${msg}（${detail}）` : msg || detail || _l('请稍后重试') };
  } catch (error) {
    const response = record(error);
    const data = record(response?.['data']);
    return {
      ok: false,
      message:
        text(data?.['msg']) ||
        text(data?.['message']) ||
        (response?.['status'] === 401 ? _l('账号已退出，请重新登录') : _l('请求失败，请稍后重试')),
    };
  }
}
const appEditableCache = new Map<string, Promise<boolean>>();
const worksheetAppCache = new Map<string, Promise<string>>();
async function fetchChartAppId(spec: ChartSaveSpec): Promise<string> {
  const appId = getChartAppId(spec);
  if (appId) return appId;
  const worksheetId = getChartWorksheetId(spec);
  if (!worksheetId) return '';
  let request = worksheetAppCache.get(worksheetId);
  if (!request) {
    request = homeAppAjax
      .getAppSimpleInfo({ workSheetId: worksheetId }, { silent: true })
      .then((value: unknown) => text(record(value)?.['appId']))
      .catch(() => '');
    worksheetAppCache.set(worksheetId, request);
  }
  return request;
}
export async function fetchChartPageSavable(spec: ChartSaveSpec): Promise<boolean> {
  const appId = await fetchChartAppId(spec);
  if (!appId) return true;
  let request = appEditableCache.get(appId);
  if (!request) {
    request = homeAppAjax
      .getApp({ appId }, { silent: true })
      .then(detail => (detail ? canEditApp(detail.permissionType, detail.isLock) : true))
      .catch(() => true);
    appEditableCache.set(appId, request);
  }
  return request;
}
export function fetchWorksheetName(worksheetId: string): Promise<string> {
  if (!worksheetId) return Promise.resolve('');
  return worksheetAjax
    .getWorksheetInfo({ worksheetId }, { silent: true })
    .then((value: unknown) => text(record(value)?.['name']))
    .catch(() => '');
}
