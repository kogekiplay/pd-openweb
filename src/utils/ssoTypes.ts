/** SSO transport only claims envelope fields, leaving endpoint payloads unknown until decoded. */
export interface SsoResult<T = unknown> extends Record<string, unknown> {
  state?: number | boolean | undefined;
  data: T;
  exception?: string | undefined;
}
export interface SsoTransport extends Record<string, unknown> {
  state: number | boolean;
  data: unknown;
  encrypted?: boolean | undefined;
  key?: string | undefined;
  exception?: string | undefined;
}
interface SsoRequestBase {
  url: string;
  data?: unknown;
  async: boolean;
  withCredentials?: boolean | undefined;
  error?: ((this: unknown, failure: unknown) => void) | undefined;
}
export interface SsoDecodedRequest<T> extends SsoRequestBase {
  decodeData: (data: unknown) => T;
  success: (this: unknown, result: SsoResult<T>) => void;
}
export interface SsoOpaqueRequest extends SsoRequestBase {
  decodeData?: undefined;
  success: (this: unknown, result: SsoResult<unknown>) => void;
}
export interface SsoQuery extends Record<string, string | undefined> {
  code?: string | undefined;
  account?: string | undefined;
  password?: string | undefined;
  autoLogin?: string | undefined;
  returnUrl?: string | undefined;
  mdAppId?: string | undefined;
  status?: string | undefined;
  tpType?: string | undefined;
  wxState?: string | undefined;
  state?: string | undefined;
  url?: string | undefined;
  p?: string | undefined;
  ret?: string | undefined;
  pc_slide?: string | undefined;
  appscheme?: string | undefined;
  t?: string | undefined;
  i?: string | undefined;
  s?: string | undefined;
  source?: string | undefined;
  type?: string | undefined;
  loginModeType?: string | undefined;
  loginMode?: string | undefined;
  unionId?: string | undefined;
  projectId?: string | undefined;
  projectid?: string | undefined;
  projectIntergrationType?: string | undefined;
  projectintergrationtype?: string | undefined;
  ReturnUrl?: string | undefined;
  appId?: string | undefined;
  customLink?: string | undefined;
  externalPortalId?: string | undefined;
}
export interface SsoAccountResult {
  accountResult?: number | undefined;
  sessionId?: string | undefined;
}
export interface SsoProviderInfo {
  corpId?: string | undefined;
  clientId?: string | undefined;
  tenantId?: string | undefined;
  agentId?: string | undefined;
  state?: string | undefined;
  callBackUrl?: string | undefined;
  isLark?: boolean | undefined;
  clientWorkingPattern?: number | undefined;
}
export interface SsoWechatSignature {
  corpId?: string | undefined;
  agentId?: string | undefined;
  timestamp?: number | undefined;
  nonceStr?: string | undefined;
  signature?: string | undefined;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';
const optionalNumber = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value));
function transport(value: unknown): value is SsoTransport {
  return (
    record(value) &&
    (typeof value['state'] === 'boolean' || (typeof value['state'] === 'number' && Number.isFinite(value['state']))) &&
    optionalString(value['exception']) &&
    optionalString(value['key']) &&
    (value['encrypted'] === undefined || typeof value['encrypted'] === 'boolean')
  );
}
export function decodeSsoTransport(value: unknown): SsoTransport {
  if (!transport(value)) throw new TypeError('Invalid SSO response envelope');
  return value;
}
function accountResult(value: unknown): value is SsoAccountResult {
  return record(value) && optionalNumber(value['accountResult']) && optionalString(value['sessionId']);
}
export function decodeSsoAccountResult(value: unknown): SsoAccountResult {
  if (!accountResult(value)) throw new TypeError('Invalid SSO login response');
  return value;
}
function providerInfo(value: unknown): value is SsoProviderInfo {
  return (
    record(value) &&
    ['clientId', 'tenantId', 'corpId', 'agentId', 'state', 'callBackUrl'].every(key => optionalString(value[key])) &&
    optionalNumber(value['clientWorkingPattern']) &&
    (value['isLark'] === undefined || typeof value['isLark'] === 'boolean')
  );
}
export function decodeSsoProviderInfo(value: unknown): SsoProviderInfo {
  if (!providerInfo(value)) throw new TypeError('Invalid SSO provider information');
  return value;
}
function signature(value: unknown): value is SsoWechatSignature {
  return (
    record(value) &&
    ['corpId', 'agentId', 'nonceStr', 'signature'].every(key => optionalString(value[key])) &&
    optionalNumber(value['timestamp'])
  );
}
export function decodeSsoWechatSignature(value: unknown): SsoWechatSignature {
  if (!signature(value)) throw new TypeError('Invalid SSO WeChat signature');
  return value;
}
export function decodeSsoLoginStatus(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Invalid SSO login status');
  return value;
}
export function decodeSsoJwt(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid SSO JWT');
  return value;
}
