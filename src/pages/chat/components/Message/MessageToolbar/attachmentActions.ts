import type { KcNodeDetail } from 'src/api/kcTypes';
import type { ShareAttachmentInput } from 'src/components/shareAttachment/shareAttachment';
/** A finite consumption view of either existing source; no clone or second business DTO. */
export type MessageShareView = Pick<ShareAttachmentInput, 'id' | 'name' | 'ext' | 'size'> &
  Pick<KcNodeDetail, 'previewUrl'> & { path?: ShareAttachmentInput['qiniuPath'] };
const nativeUri: { encodeURIComponent(value: unknown): string } = globalThis;
const nativeOperations: {
  get(target: unknown, key: PropertyKey, receiver: unknown): unknown;
  apply(target: unknown, receiver: unknown, args: unknown[]): unknown;
} = Reflect;
export function encodeAttachmentName(value: string | undefined): string {
  const encode = nativeUri.encodeURIComponent;
  return encode(value);
}
export function storagePath(prefix: string | undefined, key: string | undefined): string | number {
  if (prefix === undefined) {
    if (key === undefined) return NaN;
    return prefix + key;
  }
  return prefix + key;
}
/** Exactly the existing split()/[0]/template operation, including getter receivers and native missing/malformed failures. */
export function shareImageSource(value: string | number | undefined): string {
  const method = nativeOperations.get(value === null || value === undefined ? value : Object(value), 'split', value);
  const parts = nativeOperations.apply(method, value, ['imageView2']);
  const first = nativeOperations.get(parts === null || parts === undefined ? parts : Object(parts), 0, parts);
  return `${first}imageView2/2/w/490`;
}
