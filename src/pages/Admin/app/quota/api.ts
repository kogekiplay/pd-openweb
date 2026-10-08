import appManagementApi from 'src/api/appManagement';
import dataLimitApi from 'src/api/dataLimit';
import workflowReadApi from 'src/pages/workflow/api/DataLimit';
import workflowWriteApi from 'src/pages/workflow/apiV2/DataLimit';
import type { LimitPage, QuotaApp, QuotaRow } from './types';

type Request<T> = Promise<T> & { abort?: () => void };
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function decoded<T>(request: Request<unknown>, decode: (value: unknown) => T): Request<T> {
  return Object.assign(request.then(decode), { abort: () => request.abort?.() });
}
function page(value: unknown): LimitPage {
  const body = object(value);
  return { data: Array.isArray(body['data']) ? (body['data'] as QuotaRow[]) : [], total: Number(body['total']) || 0 };
}
function success(value: unknown): boolean {
  return typeof value === 'boolean'
    ? value
    : value === 1 || object(value)['success'] === true || object(value)['code'] === 1;
}
export const getLimits = (args: ApiArgs): Request<LimitPage> => decoded(dataLimitApi.getUageLimits(args), page);
export const getWorkflowLimits = (args: ApiArgs): Request<LimitPage> =>
  decoded(workflowReadApi.GetUageLimits(args), page);
export const editLimits = (args: ApiArgs): Request<boolean> => decoded(dataLimitApi.editUageLimit(args), success);
export const editWorkflowLimits = (args: ApiArgs): Request<boolean> =>
  decoded(workflowWriteApi.EditUageLimit(args, {}), success);
export const resetUsage = (args: ApiArgs): Request<boolean> => decoded(dataLimitApi.resetUsage(args), success);
export const resetWorkflowUsage = (args: ApiArgs): Request<boolean> =>
  decoded(workflowWriteApi.resetUageLimit(args, {}), success);
export const getApps = (args: ApiArgs): Request<{ apps: QuotaApp[] }> =>
  decoded(appManagementApi.getAppsByProject(args), value => {
    const body = object(value);
    return { apps: Array.isArray(body['apps']) ? (body['apps'] as QuotaApp[]) : [] };
  });
export const getWorksheets = (
  args: ApiArgs,
): Request<Record<string, Array<{ worksheetId: string; worksheetName: string }>>> =>
  decoded(
    appManagementApi.getWorksheetsUnderTheApp(args),
    value => object(value) as Record<string, Array<{ worksheetId: string; worksheetName: string }>>,
  );
export const getLimitRowTotal = (args: ApiArgs): Request<{ limitWorksheetRowCount: number }> =>
  decoded(dataLimitApi.getLimitRowTotal(args), value => ({
    limitWorksheetRowCount: Number(object(value)['limitWorksheetRowCount']) || 0,
  }));
export const getOverview = (args: ApiArgs): Request<Record<string, Record<string, number>>> =>
  decoded(dataLimitApi.getListPage(args), value =>
    Object.fromEntries(
      Object.entries(object(value)).map(([key, group]) => [
        key,
        Object.fromEntries(Object.entries(object(group)).map(([size, count]) => [size, Number(count) || 0])),
      ]),
    ),
  );
