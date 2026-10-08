import rawSandboxApi from 'src/api/appSandbox';
import type {
  AppSummary,
  PublishContrastResponse,
  Request,
  SandboxApp,
  SandboxVersion,
  SnapshotDetail,
  WorksheetDetail,
} from 'src/components/AppSandbox/types';
import { objectValue, parseSnapshot } from './types';

interface MutationResponse {
  code?: number | undefined;
  errorMessage?: string | undefined;
  record?: { id: string; status: number } | undefined;
}
interface VersionPage {
  data: SandboxVersion[];
  total: number;
}
interface VersionResponse extends Partial<SandboxVersion> {
  data?: SandboxVersion | undefined;
}
interface AppsPage {
  data: SandboxApp[];
  total: number;
}

/** Keep cancellation available on the decoded promise, including requests superseded by a project switch. */
export function decodeRequest<T>(request: Request<unknown>, decode: (value: unknown) => T): Request<T> {
  return Object.assign(request.then(decode), { abort: () => request.abort?.() });
}
function endpoint<T>(method: (args: ApiArgs, options?: ApiOptions) => Request<unknown>, decode: (value: unknown) => T) {
  return (args: ApiArgs, options: ApiOptions = {}): Request<T> => decodeRequest(method(args, options), decode);
}
function mutation(value: unknown): MutationResponse {
  return typeof value === 'boolean' ? { code: value ? 1 : 0 } : parseSnapshot<MutationResponse>(value);
}
function page(value: unknown): VersionPage {
  const raw = objectValue(value);
  const response = Array.isArray(raw['data']) ? raw : objectValue(raw['data']);
  return {
    data: Array.isArray(response['data']) ? (response['data'] as SandboxVersion[]) : [],
    total: Number(response['total']) || 0,
  };
}
function appsPage(value: unknown): AppsPage {
  const raw = objectValue(value);
  return { data: Array.isArray(raw['data']) ? (raw['data'] as SandboxApp[]) : [], total: Number(raw['total']) || 0 };
}
const api = {
  get: endpoint(rawSandboxApi.get, value => parseSnapshot<VersionResponse>(value)),
  getByAppId: endpoint(rawSandboxApi.getByAppId, page),
  getByProjectId: endpoint(rawSandboxApi.getByProjectId, page),
  getSandboxApps: endpoint(rawSandboxApi.getSandboxApps, appsPage),
  getPublishApps: endpoint(rawSandboxApi.getPublishApps, value => {
    if (Array.isArray(value)) return value as SandboxApp[];
    const raw = objectValue(value);
    return { apps: Array.isArray(raw['apps']) ? (raw['apps'] as SandboxApp[]) : [] };
  }),
  getPublishContrast: endpoint(rawSandboxApi.getPublishContrast, value =>
    parseSnapshot<PublishContrastResponse>(value),
  ),
  getWorksheetContrastDetail: endpoint(rawSandboxApi.getWorksheetContrastDetail, value =>
    parseSnapshot<{ data?: WorksheetDetail | undefined }>(value),
  ),
  getPageCompare: endpoint(rawSandboxApi.getPageCompare, value =>
    parseSnapshot<SnapshotDetail & { data?: SnapshotDetail | string | undefined }>(value),
  ),
  getProcessCompare: endpoint(rawSandboxApi.getProcessCompare, value =>
    parseSnapshot<SnapshotDetail & { data?: SnapshotDetail | string | undefined }>(value),
  ),
  getReviewConfig: endpoint(rawSandboxApi.getReviewConfig, value =>
    parseSnapshot<{ data?: { reviewMode?: number } }>(value),
  ),
  getAppSummary: endpoint(rawSandboxApi.getAppSummary, value => parseSnapshot<{ data?: AppSummary }>(value)),
  getEnableRecord: endpoint(rawSandboxApi.getEnableRecord, value =>
    parseSnapshot<{ code?: number; data?: { id: string; status: number } }>(value),
  ),
  checkAppDataExists: endpoint(rawSandboxApi.checkAppDataExists, value => value),
  checkProjectDataExists: endpoint(rawSandboxApi.checkProjectDataExists, Boolean),
  checkDeploy: endpoint(rawSandboxApi.checkDeploy, Boolean),
  enable: endpoint(rawSandboxApi.enable, mutation),
  disable: endpoint(rawSandboxApi.disable, mutation),
  publish: endpoint(rawSandboxApi.publish, mutation),
  approve: endpoint(rawSandboxApi.approve, mutation),
  reject: endpoint(rawSandboxApi.reject, mutation),
  withdraw: endpoint(rawSandboxApi.withdraw, mutation),
  upgradeVersion: endpoint(rawSandboxApi.upgradeVersion, mutation),
  batchEnable: endpoint(rawSandboxApi.batchEnable, mutation),
  batchDisable: endpoint(rawSandboxApi.batchDisable, mutation),
  batchPublish: endpoint(rawSandboxApi.batchPublish, mutation),
  batchApprove: endpoint(rawSandboxApi.batchApprove, mutation),
  batchReject: endpoint(rawSandboxApi.batchReject, mutation),
  batchUpgradeVersion: endpoint(rawSandboxApi.batchUpgradeVersion, mutation),
  setReviewConfig: endpoint(rawSandboxApi.setReviewConfig, mutation),
};
export default api;
