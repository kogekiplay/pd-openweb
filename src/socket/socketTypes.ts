export interface SocketLike {
  on(event: string, handler: (data: unknown) => void): SocketLike;
  connect?: () => void;
}
export interface CustomNoticeData {
  id: string;
  status: number;
  title: string;
  msg: string;
  link?: string | undefined;
  linkText?: string | undefined;
  color?: string | undefined;
  type?: number | undefined;
}
export interface MarketNoticeData {
  noticeId: string;
  displayType?: number | undefined;
  desc?: string | undefined;
  type?: number | undefined;
  createTime?: string | undefined;
  title?: string | undefined;
  link?: string | undefined;
  linkText?: string | undefined;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
export function decodeCustomNotice(value: unknown): CustomNoticeData | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['status'] !== 'number' || typeof value['title'] !== 'string' || typeof value['msg'] !== 'string') return null;
  return { id: value['id'], status: value['status'], title: value['title'], msg: value['msg'], link: text(value['link']), linkText: text(value['linkText']), color: text(value['color']), type: typeof value['type'] === 'number' ? value['type'] : undefined };
}
export function decodeMarketNotice(value: unknown): MarketNoticeData | null {
  if (!isRecord(value) || typeof value['noticeId'] !== 'string') return null;
  return { noticeId: value['noticeId'], displayType: typeof value['displayType'] === 'number' ? value['displayType'] : undefined, desc: text(value['desc']), type: typeof value['type'] === 'number' ? value['type'] : undefined, createTime: text(value['createTime']), title: text(value['title']), link: text(value['link']), linkText: text(value['linkText']) };
}
