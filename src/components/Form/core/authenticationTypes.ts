export interface NativeSignature {
  timestamp: string | number;
  signature: string;
}
export interface AppSignature extends NativeSignature {
  appId: string;
  noncestr: string;
}
export interface WechatSignature extends NativeSignature {
  appId: string;
  nonceStr: string;
}
export interface WorkWechatSignature extends NativeSignature {
  corpId: string;
  nonceStr: string;
}
export interface DingSignature extends NativeSignature {
  agentId: string | number;
  corpId: string;
  noncestr: string;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function timestamp(value: unknown): value is string | number {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}
function signed(value: unknown): value is NativeSignature & Record<string, unknown> {
  return object(value) && timestamp(value['timestamp']) && typeof value['signature'] === 'string';
}
export function wechatSignature(value: unknown): WechatSignature {
  if (!object(value) || value['code'] !== 1) throw 1;
  const data = value['data'];
  if (!signed(data) || typeof data['appId'] !== 'string' || typeof data['nonceStr'] !== 'string')
    throw new TypeError('Invalid WeChat signature');
  return { appId: data['appId'], timestamp: data.timestamp, nonceStr: data['nonceStr'], signature: data.signature };
}
export function workWechatSignature(value: unknown): WorkWechatSignature {
  if (!value) throw 1;
  if (!signed(value) || typeof value['corpId'] !== 'string' || typeof value['nonceStr'] !== 'string')
    throw new TypeError('Invalid work WeChat signature');
  return {
    corpId: value['corpId'],
    timestamp: value.timestamp,
    nonceStr: value['nonceStr'],
    signature: value.signature,
  };
}
export function appSignature(value: unknown): AppSignature {
  if (!signed(value) || typeof value['appId'] !== 'string' || typeof value['noncestr'] !== 'string')
    throw new TypeError('Invalid native app signature');
  return { appId: value['appId'], timestamp: value.timestamp, noncestr: value['noncestr'], signature: value.signature };
}
export function dingSignature(value: unknown): DingSignature {
  if (
    !signed(value) ||
    !timestamp(value['agentId']) ||
    typeof value['corpId'] !== 'string' ||
    typeof value['noncestr'] !== 'string'
  )
    throw new TypeError('Invalid DingTalk signature');
  return {
    agentId: value['agentId'],
    corpId: value['corpId'],
    timestamp: value.timestamp,
    noncestr: value['noncestr'],
    signature: value.signature,
  };
}
/** Keep the SDK's original error object when it can carry the diagnostic URL. */
export function reportNativeConfigError(error: unknown, url: string): void {
  let diagnostic: unknown = { error, mdurl: url };
  if (object(error)) {
    try {
      error['mdurl'] = url;
      diagnostic = error;
    } catch {
      // Some native SDK errors are frozen; reporting must still allow the binding to reject.
    }
  }
  try {
    window.nativeAlert(JSON.stringify(diagnostic));
  } catch (failure) {
    console.error(failure);
  }
}
