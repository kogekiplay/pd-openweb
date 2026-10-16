/** Only fields consumed by the mobile preview are decoded; other node metadata is retained. */
export interface ShareNode extends Record<string, unknown> {
  data?: ShareNode | null | undefined;
  fileID?: string | undefined;
  id?: string | undefined;
  name?: string | undefined;
  ext?: string | undefined;
  originalFilename?: string | undefined;
  thumbnailPath?: string | undefined;
  thumbnailName?: string | undefined;
  downloadUrl?: string | undefined;
  viewUrl?: string | undefined;
  size?: number | string | null | undefined;
  filesize?: number | string | null | undefined;
  canDownload?: boolean | undefined;
  allowDown?: boolean | undefined;
  deadLine?: Date | string | number | null | undefined;
  isValid?: boolean | undefined;
  attachmentType?: number | undefined;
}
export interface ShareOptions {
  container?: string | undefined;
  node?: unknown;
  shareFolderId?: string | undefined;
  projectId?: string | undefined;
}
export interface ShareFile {
  fileID?: string | undefined;
  id?: string | undefined;
  name?: string | undefined;
  ext?: string | undefined;
  size?: string | number | null | undefined;
  canDownload?: boolean | undefined;
  downloadUrl?: string | undefined;
  viewUrl?: string | undefined;
  imageSrc?: string | undefined;
  qiniuPath?: string | undefined;
}
export interface SaveSource {
  fileID?: string | undefined;
  nodeId?: string | undefined;
  name?: string | undefined;
  filePath?: string | undefined;
  isShareFolder?: boolean | undefined;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function objectReply(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new TypeError('Invalid share response');
  return value;
}

export function deadline(value: unknown): Date | string | number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Date) return value;
  throw new TypeError('Invalid share deadline');
}

function node(value: unknown, seen: Set<object>): value is ShareNode {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || seen.has(value)) return false;
  seen.add(value);
  const valid =
    [
      'fileID',
      'id',
      'name',
      'ext',
      'originalFilename',
      'thumbnailPath',
      'thumbnailName',
      'downloadUrl',
      'viewUrl',
    ].every(key => Reflect.get(value, key) === undefined || typeof Reflect.get(value, key) === 'string') &&
    ['canDownload', 'allowDown', 'isValid'].every(
      key => Reflect.get(value, key) === undefined || typeof Reflect.get(value, key) === 'boolean',
    ) &&
    ['size', 'filesize'].every(key => {
      const v: unknown = Reflect.get(value, key);
      return v === undefined || v === null || typeof v === 'number' || typeof v === 'string';
    }) &&
    (Reflect.get(value, 'attachmentType') === undefined || typeof Reflect.get(value, 'attachmentType') === 'number') &&
    (Reflect.get(value, 'data') == null || node(Reflect.get(value, 'data'), seen));
  seen.delete(value);
  if (valid) deadline(Reflect.get(value, 'deadLine'));
  return valid;
}

export function shareNode(value: unknown): ShareNode {
  if (!node(value, new Set())) throw new TypeError('Invalid share node');
  return value;
}

export function optionalUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string') throw new TypeError('Invalid preview URL');
  return value;
}

export function queryText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError('Ambiguous share query parameter');
  return value;
}

interface WeixinSignature {
  timestamp: string | number;
  nonceStr: string;
  signature: string;
}
interface ShareMenu {
  title: string | undefined;
  link: string;
  desc?: string;
  success(): void;
}
interface ShareSdk {
  config(options: WeixinSignature & { debug: boolean; appId: string; jsApiList: string[] }): void;
  onMenuShareAppMessage(options: ShareMenu): void;
  onMenuShareTimeline(options: ShareMenu): void;
}
export function weixinSignature(value: unknown): WeixinSignature {
  const data = objectReply(value);
  const timestamp = data['timestamp'],
    nonceStr = data['nonceStr'],
    signature = data['signature'];
  if (
    (typeof timestamp !== 'number' && typeof timestamp !== 'string') ||
    typeof nonceStr !== 'string' ||
    typeof signature !== 'string'
  )
    throw new TypeError('Invalid Weixin signature');
  return { timestamp, nonceStr, signature };
}

function sdk(value: unknown): value is ShareSdk {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    ['config', 'onMenuShareAppMessage', 'onMenuShareTimeline'].every(
      key => typeof Reflect.get(value, key) === 'function',
    )
  );
}

export function weixinSdk(value: unknown): ShareSdk {
  if (!sdk(value)) throw new TypeError('Missing Weixin share SDK');
  return value;
}
